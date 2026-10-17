"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, fromZod, type ActionResult } from "@/lib/action";
import { pluralize } from "@/lib/format";
import { recalcProductRatings } from "@/lib/admin/ratings";

// Moderação das avaliações. Toda mudança recalcula a nota do produto (só aprovadas contam).

const idsSchema = z.array(z.string().trim().min(1).max(40)).min(1, "Selecione pelo menos uma avaliação.").max(200, "Selecione até 200 avaliações por vez.");

function refresh() {
  revalidatePath("/admin/avaliacoes");
  revalidatePath("/admin", "layout"); // contador de pendentes no menu
}

async function productIdsOf(ids: string[]) {
  const rows = await db.review.findMany({ where: { id: { in: ids } }, select: { productId: true } });
  return rows.map((r) => r.productId);
}

export async function setReviewsApproved(ids: string[], approved: boolean): Promise<ActionResult<{ count: number }>> {
  await requireAdmin();
  const parsed = z.object({ ids: idsSchema, approved: z.boolean() }).safeParse({ ids, approved });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Seleção inválida.");
  try {
    const unique = [...new Set(parsed.data.ids)];
    const products = await productIdsOf(unique);
    const { count } = await db.review.updateMany({ where: { id: { in: unique } }, data: { approved: parsed.data.approved } });
    await recalcProductRatings(products);
    refresh();
    const n = pluralize(count, "avaliação", "avaliações");
    return {
      ok: true,
      data: { count },
      message: parsed.data.approved ? `${n} ${count === 1 ? "aprovada e publicada" : "aprovadas e publicadas"}.` : `${n} ${count === 1 ? "ocultada" : "ocultadas"} da loja.`,
    };
  } catch (e) {
    console.error("[avaliações] falha ao moderar:", e);
    return fail("Não foi possível atualizar as avaliações agora.");
  }
}

export async function deleteReviews(ids: string[]): Promise<ActionResult<{ count: number }>> {
  await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Seleção inválida.");
  try {
    const unique = [...new Set(parsed.data)];
    const products = await productIdsOf(unique);
    const { count } = await db.review.deleteMany({ where: { id: { in: unique } } });
    await recalcProductRatings(products);
    refresh();
    return { ok: true, data: { count }, message: `${pluralize(count, "avaliação", "avaliações")} ${count === 1 ? "excluída" : "excluídas"}.` };
  } catch (e) {
    console.error("[avaliações] falha ao excluir:", e);
    return fail("Não foi possível excluir agora.");
  }
}

const reviewSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(80, "Use até 80 caracteres."),
  city: z
    .string()
    .trim()
    .max(80, "Use até 80 caracteres.")
    .nullish()
    .transform((v) => v || null),
  rating: z.number({ error: "Escolha a nota." }).int().min(1, "Escolha de 1 a 5 estrelas.").max(5, "Escolha de 1 a 5 estrelas."),
  title: z
    .string()
    .trim()
    .max(120, "Use até 120 caracteres.")
    .nullish()
    .transform((v) => v || null),
  comment: z.string().trim().min(3, "Escreva o comentário.").max(3000, "Use até 3000 caracteres."),
});

export type ReviewInput = z.input<typeof reviewSchema>;

export async function updateReview(id: string, input: ReviewInput): Promise<ActionResult> {
  await requireAdmin();
  if (!z.string().trim().min(1).max(40).safeParse(id).success) return fail("Avaliação inválida.");
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  try {
    const review = await db.review.findUnique({ where: { id }, select: { productId: true } });
    if (!review) return fail("Avaliação não encontrada. Ela pode ter sido excluída.");
    await db.review.update({ where: { id }, data: parsed.data });
    await recalcProductRatings([review.productId]);
    refresh();
    return { ok: true, message: "Avaliação atualizada." };
  } catch (e) {
    console.error("[avaliações] falha ao editar:", e);
    return fail("Não foi possível salvar a avaliação agora.");
  }
}
