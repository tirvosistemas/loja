import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Package, Plus, SearchX, Sheet, Upload } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { pluralize } from "@/lib/format";
import { getBrandOptions, getCategoryOptions } from "@/lib/admin/catalog";
import { listAdminProducts } from "@/lib/admin/products";
import { PageHeader } from "@/components/admin/page-header";
import { SearchBox } from "@/components/admin/search-box";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/card";
import { Pagination } from "@/components/ui/nav";
import { ProductFiltersBar } from "@/components/admin/products/product-filters";
import { ProductsTable } from "@/components/admin/products/products-table";
import { PRODUCT_STATUS_TABS, filtersQuery, hasActiveFilters, parseProductFilters } from "@/components/admin/products/filters";

export const metadata: Metadata = { title: "Produtos" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const filters = parseProductFilters(await searchParams);
  const [{ items, total, page, pageCount, counts }, categories, brands] = await Promise.all([listAdminProducts(filters), getCategoryOptions(), getBrandOptions()]);
  const filtered = hasActiveFilters(filters);
  const emptyCatalog = counts.ALL === 0 && !filtered;

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Cadastre, edite e organize o que aparece na loja."
        actions={
          <>
            <Link href="/admin/produtos/importar" className={buttonVariants({ variant: "secondary" })}>
              <Upload aria-hidden /> Importar
            </Link>
            {!emptyCatalog && (
              <Link href="/admin/produtos/editar-em-massa" className={buttonVariants({ variant: "secondary" })}>
                <Sheet aria-hidden /> Edição em massa
              </Link>
            )}
            <Link href="/admin/produtos/novo" className={buttonVariants()}>
              <Plus aria-hidden /> Novo produto
            </Link>
          </>
        }
      />

      {!emptyCatalog && (
        <>
          <nav aria-label="Filtrar por status" className="no-scrollbar -mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex min-w-max gap-1.5">
              {PRODUCT_STATUS_TABS.map((t) => {
                const active = filters.status === t.status;
                const count = counts[t.status ?? "ALL"] ?? 0;
                return (
                  <li key={t.label}>
                    <Link
                      href={`/admin/produtos${filtersQuery(filters, { status: t.status, page: 1 })}`}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors",
                        active ? "border-transparent bg-inverse text-inverse-foreground" : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
                      )}
                    >
                      {t.label}
                      <span className={cn("tabular rounded-full px-1.5 text-[11px] font-semibold leading-5", active ? "bg-inverse-foreground/15" : "bg-elevated text-subtle")}>
                        {count.toLocaleString("pt-BR")}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Busca e filtros lado a lado só em telas bem largas; antes disso os filtros quebravam linha e a busca encolhia. */}
          <div className="mb-5 flex flex-col gap-2.5 2xl:flex-row 2xl:items-center">
            <Suspense fallback={<Skeleton className="h-11 w-full 2xl:w-80" />}>
              <SearchBox placeholder="Buscar por nome, SKU ou modelo" className="w-full 2xl:w-80 2xl:shrink-0" />
            </Suspense>
            <Suspense fallback={<Skeleton className="h-11 w-full 2xl:w-[720px]" />}>
              <ProductFiltersBar categories={categories.map((c) => ({ id: c.id, label: c.label }))} brands={brands.map((b) => ({ id: b.id, name: b.name }))} />
            </Suspense>
          </div>
        </>
      )}

      {emptyCatalog ? (
        <EmptyState
          icon={<Package />}
          title="Nenhum produto cadastrado"
          description="Cadastre o primeiro produto com fotos, preço e estoque. Ele aparece na loja assim que estiver ativo."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/admin/produtos/novo" className={buttonVariants({ size: "sm" })}>
                <Plus aria-hidden /> Cadastrar produto
              </Link>
              <Link href="/admin/produtos/importar" className={buttonVariants({ size: "sm", variant: "secondary" })}>
                <Upload aria-hidden /> Importar vários
              </Link>
            </div>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title="Nenhum produto encontrado"
          description={filtered ? "Nenhum produto corresponde à busca ou aos filtros escolhidos." : "Não há produtos com esse status."}
          action={
            <Link href="/admin/produtos" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Ver todos os produtos
            </Link>
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {pluralize(total, "produto", "produtos")}
            {pageCount > 1 && ` · página ${page} de ${pageCount}`}
          </p>
          <ProductsTable products={items} />
          <Pagination className="mt-6" page={page} pageCount={pageCount} hrefFor={(p) => `/admin/produtos${filtersQuery(filters, { page: p })}`} />
        </>
      )}
    </>
  );
}
