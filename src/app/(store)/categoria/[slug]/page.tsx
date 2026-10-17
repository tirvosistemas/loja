import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { CatalogView, loadListing } from "@/components/store/catalog/catalog-view";
import { CategoryHeader } from "@/components/store/catalog/headers";
import { absImage, getCategoryMeta, plainExcerpt } from "@/components/store/catalog/queries";
import { canonicalFor, type RawSearchParams } from "@/components/store/catalog/params";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [c, s] = await Promise.all([getCategoryMeta(slug), getSettings()]);
  if (!c) return { title: "Categoria não encontrada", robots: { index: false } };
  const description =
    plainExcerpt(c.description) ||
    `${c.name} com entrega rápida por motoboy em Curitiba e região metropolitana. Compare marcas, voltagens e preços na ${s.store.name}.`;
  const image = c.image ? absImage(c.image) : undefined;
  return {
    title: c.name,
    description,
    alternates: { canonical: canonicalFor(`/categoria/${c.slug}`, sp) },
    openGraph: { title: c.name, description, url: `/categoria/${c.slug}`, ...(image ? { images: [{ url: image }] } : {}) },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const meta = await getCategoryMeta(slug);
  if (!meta) notFound();

  const listing = await loadListing(sp, { basePath: `/categoria/${meta.slug}`, base: { category: meta.slug } });
  const category = listing.result.category ?? {
    id: meta.id,
    name: meta.name,
    slug: meta.slug,
    description: meta.description,
    image: meta.image,
    children: [],
    parent: meta.parent,
  };

  const breadcrumbs = [
    { label: "Início", href: "/" },
    ...(category.parent ? [{ label: category.parent.name, href: `/categoria/${category.parent.slug}` }] : []),
    { label: category.name },
  ];

  return (
    <CatalogView
      listing={listing}
      header={
        <CategoryHeader
          category={category}
          icon={meta.icon}
          breadcrumbs={breadcrumbs}
          eyebrow={category.parent ? `Categoria · ${category.parent.name}` : "Categoria"}
        />
      }
    />
  );
}
