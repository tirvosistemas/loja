import type { Metadata } from "next";
import { listProducts } from "@/lib/catalog";
import { ProductGrid } from "@/components/store/product-card";
import { CatalogView, loadListing } from "@/components/store/catalog/catalog-view";
import { ListingHeader } from "@/components/store/catalog/headers";
import { activeFilterCount, parseListing, type RawSearchParams } from "@/components/store/catalog/params";

type Props = { searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = parseListing(await searchParams);
  if (!q) return { title: "Todos os produtos", alternates: { canonical: "/busca" } };
  return { title: `Busca: ${q}`, robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: Props) {
  const listing = await loadListing(await searchParams, { basePath: "/busca", keepQuery: true });
  const { q } = listing.state;
  const noMatch = !!q && listing.result.total === 0 && activeFilterCount(listing.cfg, listing.state) === 0;

  let suggestions = null;
  if (noMatch) {
    const best = await listProducts({ sort: "best-sellers", perPage: 4 });
    if (best.items.length)
      suggestions = (
        <section aria-labelledby="busca-sugestoes">
          <h3 id="busca-sugestoes" className="mb-4 text-lg font-semibold">
            Os mais vendidos da loja
          </h3>
          <ProductGrid products={best.items} />
        </section>
      );
  }

  return (
    <CatalogView
      listing={listing}
      header={
        <ListingHeader
          breadcrumbs={[{ label: "Início", href: "/" }, { label: q ? "Busca" : "Todos os produtos" }]}
          eyebrow="Busca"
          title={
            q ? (
              <>
                Resultados para <span className="text-primary">“{q}”</span>
              </>
            ) : (
              "Todos os produtos"
            )
          }
          description={q ? undefined : "Todo o catálogo em um só lugar. Use os filtros para chegar no modelo certo."}
        />
      }
      empty={
        noMatch
          ? {
              title: `Não encontramos nada para “${q}”`,
              description: (
                <>
                  Confira a ortografia, use termos mais gerais (ex.: “geladeira” em vez do modelo) ou busque pela marca.
                </>
              ),
              extra: suggestions,
            }
          : undefined
      }
    />
  );
}
