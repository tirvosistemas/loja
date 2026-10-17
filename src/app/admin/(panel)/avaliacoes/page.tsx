import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { MessageSquareText, Star } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { pluralize } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/ui/card";
import { Pagination } from "@/components/ui/nav";
import { buttonVariants } from "@/components/ui/button";
import { ReviewsList, type ReviewRow } from "@/components/admin/catalog/reviews-list";

export const metadata: Metadata = { title: "Avaliações" };

const PER_PAGE = 20;
const TABS = [
  { id: "pendentes", label: "Pendentes" },
  { id: "aprovadas", label: "Aprovadas" },
  { id: "todas", label: "Todas" },
] as const;
type TabId = (typeof TABS)[number]["id"];

type Search = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function href(tab: TabId, rating: number | null, page = 1) {
  const sp = new URLSearchParams();
  if (tab !== "pendentes") sp.set("aba", tab);
  if (rating) sp.set("nota", String(rating));
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return `/admin/avaliacoes${qs ? `?${qs}` : ""}`;
}

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab: TabId = (TABS.find((t) => t.id === first(sp.aba))?.id ?? "pendentes") as TabId;
  const ratingRaw = Number.parseInt(first(sp.nota), 10);
  const rating = ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null;
  const pageRaw = Number.parseInt(first(sp.page), 10);

  const ratingWhere: Prisma.ReviewWhereInput = rating ? { rating } : {};
  const where: Prisma.ReviewWhereInput = { ...ratingWhere, ...(tab === "pendentes" ? { approved: false } : tab === "aprovadas" ? { approved: true } : {}) };

  const [pendingCount, approvedCount, total] = await Promise.all([
    db.review.count({ where: { ...ratingWhere, approved: false } }),
    db.review.count({ where: { ...ratingWhere, approved: true } }),
    db.review.count({ where }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1, pageCount);

  const rows = total
    ? await db.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PER_PAGE,
        take: PER_PAGE,
        include: { product: { select: { id: true, name: true, slug: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } } } },
      })
    : [];
  const reviews: ReviewRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    approved: r.approved,
    createdAt: r.createdAt.toISOString(),
    product: { id: r.product.id, name: r.product.name, slug: r.product.slug, image: r.product.images[0]?.url ?? null },
  }));
  const counts: Record<TabId, number> = { pendentes: pendingCount, aprovadas: approvedCount, todas: pendingCount + approvedCount };

  return (
    <>
      <PageHeader title="Avaliações" description="Aprove o que os clientes escrevem antes de aparecer na loja. Só as aprovadas contam na nota do produto." />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filtrar por situação" className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex min-w-max gap-1.5">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <li key={t.id}>
                  <Link
                    href={href(t.id, rating)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors",
                      active ? "border-transparent bg-inverse text-inverse-foreground" : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
                    )}
                  >
                    {t.label}
                    <span
                      className={cn(
                        "tabular rounded-full px-1.5 text-[11px] font-semibold leading-5",
                        active ? "bg-inverse-foreground/15" : t.id === "pendentes" && counts.pendentes > 0 ? "bg-primary text-primary-foreground" : "bg-elevated text-subtle",
                      )}
                    >
                      {counts[t.id].toLocaleString("pt-BR")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <nav aria-label="Filtrar por nota" className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex min-w-max items-center gap-1">
            <li>
              <Link
                href={href(tab, null)}
                aria-current={!rating ? "page" : undefined}
                className={cn("inline-flex h-10 items-center rounded-xl px-3 text-sm transition-colors", !rating ? "bg-elevated font-medium text-foreground ring-1 ring-border" : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground")}
              >
                Todas as notas
              </Link>
            </li>
            {[5, 4, 3, 2, 1].map((n) => (
              <li key={n}>
                <Link
                  href={href(tab, n)}
                  aria-current={rating === n ? "page" : undefined}
                  aria-label={pluralize(n, "estrela", "estrelas")}
                  className={cn(
                    "tabular inline-flex h-10 items-center gap-1 rounded-xl px-3 text-sm transition-colors",
                    rating === n ? "bg-elevated font-medium text-foreground ring-1 ring-border" : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
                  )}
                >
                  {n} <Star className="size-3.5 fill-primary text-primary" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {reviews.length === 0 ? (
        <EmptyState
          icon={<MessageSquareText />}
          title={tab === "pendentes" ? "Nenhuma avaliação esperando aprovação" : "Nenhuma avaliação por aqui"}
          description={
            rating
              ? `Nenhuma avaliação com ${pluralize(rating, "estrela", "estrelas")} nesta lista.`
              : tab === "pendentes"
                ? "Quando um cliente avaliar um produto, a avaliação aparece aqui para você aprovar."
                : "As avaliações aprovadas aparecem na página de cada produto."
          }
          action={
            rating ? (
              <Link href={href(tab, null)} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Ver todas as notas
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {pluralize(total, "avaliação", "avaliações")}
            {pageCount > 1 && ` · página ${page} de ${pageCount}`}
          </p>
          <ReviewsList reviews={reviews} />
          <Pagination className="mt-6" page={page} pageCount={pageCount} hrefFor={(p) => href(tab, rating, p)} />
        </>
      )}
    </>
  );
}
