import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts, trackProductView } from "@/lib/catalog";
import { getPublicSettings } from "@/lib/settings";
import { absImage, plainExcerpt } from "@/components/store/catalog/queries";
import { getReviewsPage } from "@/components/store/product/reviews-data";
import { ProductView } from "@/components/store/product/product-view";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Produto não encontrado", robots: { index: false } };
  const title = p.metaTitle || p.name;
  const description =
    p.metaDescription || p.shortDescription || plainExcerpt(p.description) || `${p.name} com entrega por motoboy em Curitiba e região metropolitana.`;
  const images = p.images.slice(0, 4).map((i) => ({ url: absImage(i.url), alt: i.alt || p.name }));
  return {
    title,
    description,
    alternates: { canonical: `/produto/${p.slug}` },
    openGraph: { type: "website", title, description, url: `/produto/${p.slug}`, ...(images.length ? { images } : {}) },
    twitter: { card: "summary_large_image", title, description, ...(images.length ? { images: images.map((i) => i.url) } : {}) },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  trackProductView(product.id);

  const [settings, related, reviews] = await Promise.all([getPublicSettings(), getRelatedProducts(product), getReviewsPage(product.id, 1)]);
  return <ProductView product={product} settings={settings} related={related} reviews={reviews} />;
}
