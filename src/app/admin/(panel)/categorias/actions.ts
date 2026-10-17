"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, fromZod, isUniqueError, type ActionResult } from "@/lib/action";
import { isUploadKey } from "@/lib/images";
import { slugify } from "@/lib/utils";
import { CATEGORY_ICONS } from "@/components/ui/category-icon";
import { deleteUnusedUploads } from "@/lib/admin/uploads";

// Categorias em dois níveis (pai › filho). Excluir não apaga produtos: eles ficam sem
// categoria, e as subcategorias sobem para o primeiro nível.

const idSchema = z.string().trim().min(1).max(40);

const categorySchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome da categoria.").max(80, "Use até 80 caracteres."),
    slug: z.string().trim().max(200).default(""),
    description: z
      .string()
      .trim()
      .max(1000, "Use até 1000 caracteres.")
      .nullish()
      .transform((v) => v || null),
    parentId: z.string().trim().max(40).nullish().transform((v) => v || null),
    icon: z
      .string()
      .trim()
      .nullish()
      .refine((v) => !v || v in CATEGORY_ICONS, "Ícone inválido.")
      .transform((v) => v || null),
    image: z
      .string()
      .trim()
      .max(500)
      .nullish()
      .refine((v) => !v || isUploadKey(v) || /^https:\/\/[^\s"'<>]+$/i.test(v), "Imagem inválida.")
      .transform((v) => v || null),
    active: z.boolean(),
    featured: z.boolean(),
  })
  .transform((v) => ({ ...v, slug: slugify(v.slug || v.name) }))
  .refine((v) => !!v.slug, { path: ["slug"], message: "Informe a URL da categoria." });

export type CategoryInput = z.input<typeof categorySchema>;

class RuleError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

function refresh() {
  revalidatePath("/admin/categorias");
  revalidatePath("/admin/produtos");
}

function handleError(e: unknown, where: string): ActionResult<never> {
  if (e instanceof RuleError) return fail(e.message, e.fieldErrors);
  if (isUniqueError(e, "slug")) return fail("Já existe uma categoria com essa URL.", { slug: "Essa URL já está em uso por outra categoria." });
  console.error(`[categorias] falha ao ${where}:`, e);
  return fail("Não foi possível salvar a categoria agora. Tente de novo.");
}

/** O pai precisa existir e estar no primeiro nível; quem tem subcategorias não vira filho. */
async function checkParent(parentId: string | null, selfId: string | null) {
  if (!parentId) return;
  if (parentId === selfId) throw new RuleError("Uma categoria não pode ser pai dela mesma.", { parentId: "Escolha outra categoria." });
  const parent = await db.category.findUnique({ where: { id: parentId }, select: { parentId: true } });
  if (!parent) throw new RuleError("Categoria pai não encontrada.", { parentId: "Categoria pai não encontrada." });
  if (parent.parentId) throw new RuleError("Escolha uma categoria do primeiro nível.", { parentId: "Só categorias do primeiro nível podem ter subcategorias." });
  if (selfId) {
    const children = await db.category.count({ where: { parentId: selfId } });
    if (children) throw new RuleError("Esta categoria tem subcategorias.", { parentId: "Ela tem subcategorias, então precisa ficar no primeiro nível." });
  }
}

async function nextSortOrder(parentId: string | null) {
  const last = await db.category.findFirst({ where: { parentId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  return (last?.sortOrder ?? -1) + 1;
}

export async function createCategory(input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  try {
    await checkParent(parsed.data.parentId, null);
    const category = await db.category.create({
      data: { ...parsed.data, sortOrder: await nextSortOrder(parsed.data.parentId) },
      select: { id: true },
    });
    refresh();
    return { ok: true, data: { id: category.id }, message: "Categoria criada." };
  } catch (e) {
    return handleError(e, "criar");
  }
}

export async function updateCategory(id: string, input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Categoria inválida.");
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  try {
    const before = await db.category.findUnique({ where: { id }, select: { image: true, parentId: true } });
    if (!before) return fail("Categoria não encontrada. Ela pode ter sido excluída.");
    await checkParent(parsed.data.parentId, id);
    const moved = before.parentId !== parsed.data.parentId;
    await db.category.update({
      where: { id },
      data: { ...parsed.data, ...(moved ? { sortOrder: await nextSortOrder(parsed.data.parentId) } : {}) },
    });
    if (before.image && before.image !== parsed.data.image) await deleteUnusedUploads([before.image]);
    refresh();
    return { ok: true, data: { id }, message: "Categoria salva." };
  } catch (e) {
    return handleError(e, "atualizar");
  }
}

export async function setCategoryFlag(id: string, flag: "active" | "featured", value: boolean): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: idSchema, flag: z.enum(["active", "featured"]), value: z.boolean() }).safeParse({ id, flag, value });
  if (!parsed.success) return fail("Dados inválidos.");
  try {
    const r = await db.category.updateMany({ where: { id: parsed.data.id }, data: { [parsed.data.flag]: parsed.data.value } });
    if (!r.count) return fail("Categoria não encontrada.");
    refresh();
    const message =
      parsed.data.flag === "active"
        ? parsed.data.value ? "Categoria visível na loja." : "Categoria oculta na loja."
        : parsed.data.value ? "Categoria em destaque na página inicial." : "Categoria fora da página inicial.";
    return { ok: true, message };
  } catch (e) {
    return handleError(e, "atualizar");
  }
}

/** Sobe ou desce a categoria entre as irmãs (mesmo pai). */
export async function moveCategory(id: string, direction: "up" | "down"): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: idSchema, direction: z.enum(["up", "down"]) }).safeParse({ id, direction });
  if (!parsed.success) return fail("Dados inválidos.");
  try {
    const self = await db.category.findUnique({ where: { id }, select: { parentId: true } });
    if (!self) return fail("Categoria não encontrada.");
    const siblings = await db.category.findMany({ where: { parentId: self.parentId }, select: { id: true, name: true, sortOrder: true } });
    siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"));
    const i = siblings.findIndex((s) => s.id === id);
    const j = parsed.data.direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= siblings.length) return { ok: true };
    [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
    // Renumera todas as irmãs para manter a ordem estável.
    await db.$transaction(siblings.map((s, k) => db.category.update({ where: { id: s.id }, data: { sortOrder: k } })));
    refresh();
    return { ok: true };
  } catch (e) {
    return handleError(e, "reordenar");
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Categoria inválida.");
  try {
    const category = await db.category.findUnique({ where: { id }, select: { image: true } });
    if (!category) return fail("Categoria não encontrada. Ela pode já ter sido excluída.");
    const base = await nextSortOrder(null);
    const children = await db.category.findMany({ where: { parentId: id }, orderBy: { sortOrder: "asc" }, select: { id: true } });
    await db.$transaction([
      ...children.map((c, k) => db.category.update({ where: { id: c.id }, data: { parentId: null, sortOrder: base + k } })),
      db.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } }),
      db.category.delete({ where: { id } }),
    ]);
    await deleteUnusedUploads([category.image]);
    refresh();
    return { ok: true, message: children.length ? "Categoria excluída. As subcategorias foram para o primeiro nível." : "Categoria excluída." };
  } catch (e) {
    return handleError(e, "excluir");
  }
}
