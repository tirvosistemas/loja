"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, fromZod, isUniqueError, type ActionResult } from "@/lib/action";
import { isUploadKey } from "@/lib/images";
import { slugify } from "@/lib/utils";
import { uniqueSlug } from "@/lib/admin/catalog";
import { deleteUnusedUploads } from "@/lib/admin/uploads";

// Marcas: cadastro, edição, ativar/desativar e exclusão (os produtos continuam, sem marca).

const idSchema = z.string().trim().min(1).max(40);

const brandSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome da marca.").max(80, "Use até 80 caracteres."),
    slug: z.string().trim().max(200).default(""),
    logo: z
      .string()
      .trim()
      .max(500)
      .nullish()
      .refine((v) => !v || isUploadKey(v) || /^https:\/\/[^\s"'<>]+$/i.test(v), "Logo inválido.")
      .transform((v) => v || null),
    active: z.boolean(),
  })
  .transform((v) => ({ ...v, slug: slugify(v.slug || v.name) }))
  .refine((v) => !!v.slug, { path: ["slug"], message: "Informe a URL da marca." });

export type BrandInput = z.input<typeof brandSchema>;

function refresh() {
  revalidatePath("/admin/marcas");
  revalidatePath("/admin/produtos");
}

function handleError(e: unknown, where: string): ActionResult<never> {
  if (isUniqueError(e, "slug")) return fail("Já existe uma marca com essa URL.", { slug: "Essa URL já está em uso por outra marca." });
  console.error(`[marcas] falha ao ${where}:`, e);
  return fail("Não foi possível salvar a marca agora. Tente de novo.");
}

export async function createBrand(input: BrandInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  try {
    const brand = await db.brand.create({ data: parsed.data, select: { id: true } });
    refresh();
    return { ok: true, data: { id: brand.id }, message: "Marca cadastrada." };
  } catch (e) {
    return handleError(e, "criar");
  }
}

export async function updateBrand(id: string, input: BrandInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Marca inválida.");
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  try {
    const before = await db.brand.findUnique({ where: { id }, select: { logo: true } });
    if (!before) return fail("Marca não encontrada. Ela pode ter sido excluída.");
    await db.brand.update({ where: { id }, data: parsed.data });
    if (before.logo && before.logo !== parsed.data.logo) await deleteUnusedUploads([before.logo]);
    refresh();
    return { ok: true, data: { id }, message: "Marca salva." };
  } catch (e) {
    return handleError(e, "atualizar");
  }
}

/** Cadastro rápido a partir do formulário de produto (só o nome). */
export async function quickCreateBrand(name: string): Promise<ActionResult<{ id: string; name: string }>> {
  await requireAdmin();
  const parsed = z.string().trim().min(2, "Informe o nome da marca.").max(80, "Use até 80 caracteres.").safeParse(name);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Nome inválido.", { name: parsed.error.issues[0]?.message ?? "Nome inválido." });
  try {
    const existing = await db.brand.findFirst({ where: { name: parsed.data }, select: { id: true, name: true } });
    if (existing) return { ok: true, data: existing, message: `A marca ${existing.name} já existia e foi selecionada.` };
    const slug = await uniqueSlug(parsed.data, async (s) => !!(await db.brand.findUnique({ where: { slug: s }, select: { id: true } })));
    const brand = await db.brand.create({ data: { name: parsed.data, slug, active: true }, select: { id: true, name: true } });
    refresh();
    return { ok: true, data: brand, message: `Marca ${brand.name} cadastrada.` };
  } catch (e) {
    return handleError(e, "criar");
  }
}

export async function setBrandActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: idSchema, active: z.boolean() }).safeParse({ id, active });
  if (!parsed.success) return fail("Dados inválidos.");
  try {
    const r = await db.brand.updateMany({ where: { id: parsed.data.id }, data: { active: parsed.data.active } });
    if (!r.count) return fail("Marca não encontrada.");
    refresh();
    return { ok: true, message: parsed.data.active ? "Marca ativa na loja." : "Marca oculta na loja." };
  } catch (e) {
    return handleError(e, "atualizar");
  }
}

export async function deleteBrand(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Marca inválida.");
  try {
    const brand = await db.brand.findUnique({ where: { id }, select: { logo: true } });
    if (!brand) return fail("Marca não encontrada. Ela pode já ter sido excluída.");
    const [moved] = await db.$transaction([db.product.updateMany({ where: { brandId: id }, data: { brandId: null } }), db.brand.delete({ where: { id } })]);
    await deleteUnusedUploads([brand.logo]);
    refresh();
    return { ok: true, message: moved.count > 0 ? "Marca excluída. Os produtos continuam cadastrados, sem marca." : "Marca excluída." };
  } catch (e) {
    return handleError(e, "excluir");
  }
}
