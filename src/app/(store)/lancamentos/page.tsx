import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { CatalogView, loadListing } from "@/components/store/catalog/catalog-view";
import { ListingHeader } from "@/components/store/catalog/headers";
import { activeFilterCount, canonicalFor, type RawSearchParams } from "@/components/store/catalog/params";

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawSearchParams> }): Promise<Metadata> {
  const [s, sp] = await Promise.all([getSettings(), searchParams]);
  const description = `Os eletrônicos que acabaram de chegar na ${s.store.name}, com entrega por motoboy em Curitiba e região metropolitana.`;
  return { title: "Lançamentos", description, alternates: { canonical: canonicalFor("/lancamentos", sp) }, openGraph: { title: `Lançamentos · ${s.store.name}`, description, url: "/lancamentos" } };
}

export default async function NewArrivalsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const listing = await loadListing(await searchParams, { basePath: "/lancamentos", defaultSort: "newest", base: { isNew: true } });
  const none = listing.result.total === 0 && activeFilterCount(listing.cfg, listing.state) === 0;
  return (
    <CatalogView
      listing={listing}
      header={
        <ListingHeader
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Lançamentos" }]}
          eyebrow="Novidades"
          title="Lançamentos"
          description="Os modelos mais recentes que chegaram à loja: tecnologia nova, eficiência melhor e o mesmo cuidado na entrega."
        />
      }
      empty={none ? { title: "Nenhum lançamento por enquanto", description: "Os próximos modelos aparecem aqui assim que chegarem." } : undefined}
    />
  );
}
