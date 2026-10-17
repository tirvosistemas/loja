import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArrowRight, PackageSearch, RotateCcw } from "lucide-react";
import { getMenuCategories, listProducts, type ProductListResult } from "@/lib/catalog";
import type { SortValue } from "@/lib/constants";
import { ProductGrid } from "@/components/store/product-card";
import { Pagination } from "@/components/ui/nav";
import { CategoryIcon } from "@/components/ui/category-icon";
import { NextMascot } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/card";
import { pluralize } from "@/lib/format";
import { CatalogNavProvider, CatalogResults } from "./catalog-nav";
import { ActiveFilters, DesktopFilters, MobileFilters, SortSelect } from "./toolbar";
import {
  activeFilterCount,
  clearedListing,
  listingHref,
  parseListing,
  toProductFilters,
  type ListingBase,
  type ListingConfig,
  type ListingState,
  type RawSearchParams,
} from "./params";

// Listagem compartilhada (categoria, marca, busca, ofertas, lançamentos):
// filtros à esquerda no computador, gaveta no celular, chips, ordenação e paginação.

export type Listing = { cfg: ListingConfig; base: ListingBase; state: ListingState; result: ProductListResult };

export async function loadListing(
  searchParams: RawSearchParams,
  opts: { basePath: string; defaultSort?: SortValue; base?: ListingBase; keepQuery?: boolean },
): Promise<Listing> {
  const base = opts.base ?? {};
  const cfg: ListingConfig = {
    basePath: opts.basePath,
    defaultSort: opts.defaultSort ?? "relevance",
    lockBrands: !!base.brand,
    lockOnSale: !!base.onSale,
    keepQuery: opts.keepQuery,
  };
  const state = parseListing(searchParams);
  if (cfg.lockBrands) state.brands = [];
  if (cfg.lockOnSale) state.onSale = true;
  const result = await listProducts(toProductFilters(state, base, cfg.defaultSort));
  return { cfg, base, state, result };
}

function FiltersFallback() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-5 w-24" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

export function CatalogView({
  listing,
  header,
  empty,
  facets,
}: {
  listing: Listing;
  header: ReactNode;
  /** Conteúdo extra no estado vazio (ex.: sugestões da busca). */
  empty?: { title?: string; description?: ReactNode; extra?: ReactNode };
  /** Facetas próprias (ex.: na página da marca). */
  facets?: Partial<ProductListResult["facets"]>;
}) {
  const { cfg, base, state, result } = listing;
  const allFacets = { ...result.facets, ...facets };
  const filtered = activeFilterCount(cfg, state) > 0;
  const hrefFor = (p: number) => listingHref(cfg, state, { page: p });

  return (
    <CatalogNavProvider cfg={cfg} state={state}>
      <div className="container-page pb-16 pt-4 sm:pt-6">
        {header}

        <div className="mt-6 lg:mt-8 lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10">
          <aside className="hidden lg:block" aria-label="Filtros">
            <div className="no-scrollbar sticky top-36 max-h-[calc(100dvh-10rem)] overflow-y-auto pb-6 pr-1">
              <Suspense fallback={<FiltersFallback />}>
                <DesktopFilters facets={allFacets} />
              </Suspense>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <p className="tabular text-sm text-muted-foreground" aria-live="polite">
                <span className="font-semibold text-foreground">{pluralize(result.total, "produto", "produtos")}</span>
                {result.pageCount > 1 && (
                  <span className="text-subtle">
                    {" "}
                    · página {result.page} de {result.pageCount}
                  </span>
                )}
              </p>
              <div className="flex min-w-0 items-center gap-2">
                <Suspense fallback={null}>
                  <MobileFilters facets={allFacets} total={result.total} base={base} />
                  <SortSelect defaultSort={cfg.defaultSort} />
                </Suspense>
              </div>
            </div>

            <Suspense fallback={null}>
              <div className="pt-4 empty:hidden">
                <ActiveFilters facets={allFacets} />
              </div>
            </Suspense>

            <CatalogResults className="pt-5">
              {result.items.length > 0 ? (
                <>
                  <ProductGrid products={result.items} />
                  <Pagination className="mt-10" page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} />
                </>
              ) : (
                <EmptyListing
                  title={empty?.title ?? (filtered ? "Nenhum produto com esses filtros" : "Ainda não há produtos aqui")}
                  description={
                    empty?.description ??
                    (filtered
                      ? "Tente remover algum filtro ou ampliar a faixa de preço."
                      : "Estamos preparando novidades. Enquanto isso, dê uma olhada nas outras categorias.")
                  }
                  clearHref={filtered ? listingHref(cfg, clearedListing(cfg, state)) : undefined}
                  secondary={cfg.basePath === "/ofertas" ? { href: "/busca", label: "Ver todos os produtos" } : { href: "/ofertas", label: "Ver ofertas" }}
                  extra={empty?.extra}
                />
              )}
            </CatalogResults>
          </div>
        </div>
      </div>
    </CatalogNavProvider>
  );
}

export async function EmptyListing({
  title,
  description,
  clearHref,
  secondary = { href: "/ofertas", label: "Ver ofertas" },
  extra,
}: {
  title: string;
  description?: ReactNode;
  clearHref?: string;
  secondary?: { href: string; label: string };
  extra?: ReactNode;
}) {
  const categories = (await getMenuCategories()).slice(0, 8);
  return (
    <div className="space-y-10">
      <div className="relative overflow-hidden rounded-3xl border border-dashed border-border-strong px-6 py-12 text-center sm:py-16">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto flex max-w-md flex-col items-center gap-4">
          <NextMascot className="h-28 sm:h-32" />
          <div>
            <p className="flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-subtle">
              <PackageSearch className="size-4 text-primary" aria-hidden /> Nada por aqui
            </p>
            <h2 className="mt-2 text-xl font-semibold sm:text-2xl">{title}</h2>
            {description && <p className="mt-2 text-sm text-muted-foreground sm:text-[15px]">{description}</p>}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {clearHref && (
              <Link href={clearHref} scroll={false} className="flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary-hover">
                <RotateCcw className="size-4" aria-hidden /> Limpar filtros
              </Link>
            )}
            <Link href={secondary.href} className="flex h-11 items-center gap-2 rounded-xl border border-border-strong px-4 text-[15px] font-medium transition-colors hover:bg-elevated">
              {secondary.label} <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      {categories.length > 0 && (
        <section aria-labelledby="empty-cats">
          <h3 id="empty-cats" className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-subtle">
            Categorias populares
          </h3>
          <ul className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/categoria/${c.slug}`} className="flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm transition-colors hover:border-primary/50 hover:text-primary">
                  <CategoryIcon name={c.icon} className="size-4 text-subtle" />
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {extra}
    </div>
  );
}
