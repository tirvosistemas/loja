import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { VOLTAGE_LABEL } from "@/lib/constants";
import { SmartImage } from "@/components/ui/smart-image";
import { Breadcrumbs } from "@/components/ui/nav";
import { CatalogView, loadListing } from "@/components/store/catalog/catalog-view";
import { Eyebrow } from "@/components/store/catalog/headers";
import { absImage, getBrandFacets, getBrandMeta } from "@/components/store/catalog/queries";
import { activeFilterCount, canonicalFor, type RawSearchParams } from "@/components/store/catalog/params";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [b, s] = await Promise.all([getBrandMeta(slug), getSettings()]);
  if (!b) return { title: "Marca não encontrada", robots: { index: false } };
  const description = `Eletrodomésticos ${b.name} com entrega rápida por motoboy em Curitiba e região metropolitana. Veja preços e ofertas na ${s.store.name}.`;
  return {
    title: `${b.name}: eletrodomésticos`,
    description,
    alternates: { canonical: canonicalFor(`/marca/${b.slug}`, sp) },
    openGraph: { title: b.name, description, url: `/marca/${b.slug}`, ...(b.logo ? { images: [{ url: absImage(b.logo) }] } : {}) },
  };
}

export default async function BrandPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const brand = await getBrandMeta(slug);
  if (!brand) notFound();

  const [listing, facets] = await Promise.all([
    loadListing(sp, { basePath: `/marca/${brand.slug}`, base: { brand: brand.slug } }),
    getBrandFacets(brand.id),
  ]);

  const voltages = facets.volts
    .filter((v) => v.voltage)
    .map((v) => ({ value: v.voltage!, label: VOLTAGE_LABEL[v.voltage!], count: v._count._all }));

  const header = (
    <header>
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Marcas" }, { label: brand.name }]} />
      <div className="relative mt-4 overflow-hidden rounded-3xl border border-border bg-card sm:mt-5">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="glow-orange pointer-events-none absolute -right-24 -top-24 size-80" aria-hidden />
        <div className="relative flex items-center gap-5 p-6 sm:p-8 lg:p-10">
          <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-well sm:size-24">
            {brand.logo ? (
              <SmartImage src={brand.logo} alt={`Logo ${brand.name}`} size="sm" sizes="96px" priority className="size-full object-contain p-3" />
            ) : (
              <span className="font-mono text-3xl font-semibold uppercase text-zinc-900" aria-hidden>
                {brand.name.slice(0, 1)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <Eyebrow>Marca</Eyebrow>
            <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">{brand.name}</h1>
            <p className="mt-1.5 text-[15px] text-muted-foreground">Produtos {brand.name} com entrega por motoboy em Curitiba e região.</p>
          </div>
        </div>
      </div>
    </header>
  );

  return (
    <CatalogView
      listing={listing}
      header={header}
      facets={{ voltages, price: facets.price }}
      empty={
        listing.result.total === 0 && activeFilterCount(listing.cfg, listing.state) === 0
          ? { title: `Nenhum produto ${brand.name} disponível agora`, description: "Logo teremos novidades desta marca. Veja outras categorias enquanto isso." }
          : undefined
      }
    />
  );
}
