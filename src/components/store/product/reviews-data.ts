import { db } from "@/lib/db";

// Avaliações aprovadas de um produto (página do produto e GET /api/reviews).

export const REVIEWS_PER_PAGE = 10;

export type ReviewDTO = {
  id: string;
  name: string;
  city: string | null;
  rating: number;
  title: string | null;
  comment: string;
  createdAt: string;
};

export type ReviewSummary = {
  average: number;
  count: number;
  distribution: { stars: number; count: number }[]; // 5 → 1
};

export type ReviewsPage = {
  reviews: ReviewDTO[];
  page: number;
  pageCount: number;
  total: number;
  summary: ReviewSummary;
};

export async function getReviewsPage(productId: string, page = 1): Promise<ReviewsPage> {
  const where = { productId, approved: true };
  const [groups, rows] = await Promise.all([
    db.review.groupBy({ by: ["rating"], where, _count: { _all: true } }),
    db.review.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (Math.max(1, page) - 1) * REVIEWS_PER_PAGE,
      take: REVIEWS_PER_PAGE,
      select: { id: true, name: true, city: true, rating: true, title: true, comment: true, createdAt: true },
    }),
  ]);
  const byStars = new Map(groups.map((g) => [g.rating, g._count._all]));
  const count = groups.reduce((s, g) => s + g._count._all, 0);
  const sum = groups.reduce((s, g) => s + g.rating * g._count._all, 0);
  const pageCount = Math.max(1, Math.ceil(count / REVIEWS_PER_PAGE));
  return {
    reviews: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    page: Math.min(Math.max(1, page), pageCount),
    pageCount,
    total: count,
    summary: {
      average: count ? Math.round((sum / count) * 10) / 10 : 0,
      count,
      distribution: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: byStars.get(stars) ?? 0 })),
    },
  };
}
