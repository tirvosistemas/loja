import { db } from "@/lib/db";

// Nota média e quantidade de avaliações do produto, contando só as aprovadas.
// Chamado sempre que uma avaliação é aprovada, ocultada, editada ou excluída.

export async function recalcProductRating(productId: string) {
  const agg = await db.review.aggregate({
    where: { productId, approved: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const avg = agg._avg.rating ?? 0;
  // updateMany não falha se o produto tiver sido excluído nesse meio-tempo.
  await db.product.updateMany({
    where: { id: productId },
    data: { ratingAvg: Math.round(avg * 10) / 10, ratingCount: agg._count._all },
  });
}

export async function recalcProductRatings(productIds: Iterable<string>) {
  for (const id of new Set(productIds)) await recalcProductRating(id);
}
