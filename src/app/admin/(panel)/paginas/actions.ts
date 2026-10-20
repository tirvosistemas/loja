"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, fromZod, isUniqueError, type ActionResult } from "@/lib/action";
import { slugify } from "@/lib/utils";
import { uniqueSlug } from "@/lib/admin/catalog";
import { getSettings } from "@/lib/settings";
import { buildLegalPage } from "@/lib/legal-pages";

// Páginas institucionais (Sobre, Trocas, Privacidade…), escritas em Markdown simples.

const idSchema = z.string().trim().min(1).max(40);

const pageSchema = z
  .object({
    title: z.string().trim().min(2, "Informe o título.").max(120, "Use até 120 caracteres."),
    slug: z.string().trim().max(200).default(""),
    slugAuto: z.boolean().optional(),
    content: z.string().trim().min(1, "Escreva o conteúdo da página.").max(30000, "O texto passou de 30 mil caracteres. Divida em mais de uma página."),
    published: z.boolean(),
    showInFooter: z.boolean(),
    sortOrder: z.number({ error: "Informe um número." }).int("Use um número inteiro.").min(0, "Não pode ser negativo.").max(999, "Use até 999."),
  })
  .transform((v) => ({ ...v, slug: slugify(v.slug || v.title) }))
  .refine((v) => !!v.slug, { path: ["slug"], message: "Informe a URL da página." });

export type PageInput = z.input<typeof pageSchema>;

function refresh(id?: string) {
  revalidatePath("/admin/paginas");
  if (id) revalidatePath(`/admin/paginas/${id}`);
}

function handleError(e: unknown, where: string): ActionResult<never> {
  if (isUniqueError(e, "slug")) return fail("Já existe uma página com essa URL.", { slug: "Essa URL já está em uso por outra página." });
  console.error(`[páginas] falha ao ${where}:`, e);
  return fail("Não foi possível salvar a página agora. Tente de novo.");
}

export async function createPage(input: PageInput): Promise<ActionResult<{ id: string; slug: string }>> {
  await requireAdmin();
  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const { slugAuto, ...data } = parsed.data;
  try {
    const taken = await db.page.findUnique({ where: { slug: data.slug }, select: { id: true } });
    if (taken) {
      if (!slugAuto) return fail("Já existe uma página com essa URL.", { slug: "Essa URL já está em uso por outra página." });
      data.slug = await uniqueSlug(data.slug, async (s) => !!(await db.page.findUnique({ where: { slug: s }, select: { id: true } })));
    }
    const page = await db.page.create({ data, select: { id: true, slug: true } });
    refresh(page.id);
    return { ok: true, data: page, message: "Página criada." };
  } catch (e) {
    return handleError(e, "criar");
  }
}

export async function updatePage(id: string, input: PageInput): Promise<ActionResult<{ id: string; slug: string }>> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Página inválida.");
  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const { slugAuto: _ignored, ...data } = parsed.data;
  try {
    const exists = await db.page.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return fail("Página não encontrada. Ela pode ter sido excluída.");
    const page = await db.page.update({ where: { id }, data, select: { id: true, slug: true } });
    refresh(id);
    return { ok: true, data: page, message: "Página salva." };
  } catch (e) {
    return handleError(e, "atualizar");
  }
}

export async function setPageFlag(id: string, flag: "published" | "showInFooter", value: boolean): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: idSchema, flag: z.enum(["published", "showInFooter"]), value: z.boolean() }).safeParse({ id, flag, value });
  if (!parsed.success) return fail("Dados inválidos.");
  try {
    const r = await db.page.updateMany({ where: { id: parsed.data.id }, data: { [parsed.data.flag]: parsed.data.value } });
    if (!r.count) return fail("Página não encontrada.");
    refresh(parsed.data.id);
    const message =
      parsed.data.flag === "published"
        ? parsed.data.value ? "Página publicada." : "Página despublicada."
        : parsed.data.value ? "Página no rodapé da loja." : "Página fora do rodapé.";
    return { ok: true, message };
  } catch (e) {
    return handleError(e, "atualizar");
  }
}

export async function deletePage(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Página inválida.");
  try {
    const r = await db.page.deleteMany({ where: { id } });
    if (!r.count) return fail("Página não encontrada. Ela pode já ter sido excluída.");
    refresh();
    return { ok: true, message: "Página excluída." };
  } catch (e) {
    return handleError(e, "excluir");
  }
}

// ───────── Páginas legais geradas com os dados da loja

const legalInput = z.object({
  ids: z.array(z.enum(["trocas-e-devolucoes", "politica-de-privacidade", "termos-de-uso", "entregas"])).min(1, "Escolha pelo menos uma página."),
  overwrite: z.boolean(),
  returnDays: z.number().int().min(7, "O mínimo por lei é 7 dias.").max(90),
  defectDays: z.number().int().min(90, "O mínimo por lei para produtos duráveis é 90 dias.").max(365),
});

export async function generateLegalPages(input: z.input<typeof legalInput>): Promise<ActionResult<{ created: number; updated: number; skipped: number }>> {
  await requireAdmin();
  const parsed = legalInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const v = parsed.data;
  try {
    const settings = await getSettings();
    const max = await db.page.aggregate({ _max: { sortOrder: true } });
    let order = (max._max.sortOrder ?? 0) + 1;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const id of v.ids) {
      const p = buildLegalPage(id, settings, { returnDays: v.returnDays, defectDays: v.defectDays });
      const existing = await db.page.findUnique({ where: { slug: p.slug }, select: { id: true } });
      if (existing) {
        if (!v.overwrite) {
          skipped++;
          continue;
        }
        await db.page.update({ where: { id: existing.id }, data: { title: p.title, content: p.content } });
        updated++;
      } else {
        await db.page.create({ data: { slug: p.slug, title: p.title, content: p.content, published: true, showInFooter: true, sortOrder: order++ } });
        created++;
      }
    }
    refresh();
    revalidatePath("/", "layout");
    const parts = [created && `${created} criada${created > 1 ? "s" : ""}`, updated && `${updated} atualizada${updated > 1 ? "s" : ""}`, skipped && `${skipped} mantida${skipped > 1 ? "s" : ""} como estava${skipped > 1 ? "m" : ""}`].filter(Boolean);
    return { ok: true, data: { created, updated, skipped }, message: `Páginas: ${parts.join(", ")}.` };
  } catch (e) {
    return handleError(e, "gerar as páginas legais");
  }
}
