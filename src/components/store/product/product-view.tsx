import { PlayCircle } from "lucide-react";
import type { ProductCardDTO, ProductDetailDTO } from "@/lib/catalog";
import type { PublicSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";
import { Breadcrumbs } from "@/components/ui/nav";
import { Markdown } from "@/components/ui/markdown";
import { ProductRail } from "@/components/store/product-rail";
import { absImage, plainExcerpt } from "@/components/store/catalog/queries";
import { PurchaseProvider } from "./purchase-context";
import { ProductGallery } from "./gallery";
import { BuyBox } from "./buy-box";
import { ShippingEstimator } from "./shipping-estimator";
import { TrustRow } from "./trust-row";
import { SpecsTable, specRows } from "./specs-table";
import { ProductSections } from "./sections";
import { ProductReviews } from "./reviews";
import { RecentlyViewed } from "./recently-viewed";
import type { ReviewsPage } from "./reviews-data";

// Página do produto (sem as consultas): galeria, compra, frete, seções, relacionados e JSON-LD.

export function productJsonLd(p: ProductDetailDTO, storeName: string) {
  const url = absoluteUrl(`/produto/${p.slug}`);
  const prices = p.variants.length ? p.variants.map((v) => v.priceCents) : [p.priceCents];
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const availability = p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  const reais = (c: number) => (c / 100).toFixed(2);
  const ean = p.ean?.replace(/\D/g, "");
  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    url,
    image: p.images.length ? p.images.map((i) => absImage(i.url)) : undefined,
    description: plainExcerpt(p.shortDescription || p.description, 500) || undefined,
    sku: p.sku || undefined,
    mpn: p.model || undefined,
    ...(ean && (ean.length === 13 ? { gtin13: ean } : ean.length === 8 ? { gtin8: ean } : ean.length === 12 ? { gtin12: ean } : {})),
    brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined,
    category: p.category?.name,
    color: p.color || undefined,
    offers:
      low !== high
        ? {
            "@type": "AggregateOffer",
            priceCurrency: "BRL",
            lowPrice: reais(low),
            highPrice: reais(high),
            offerCount: prices.length,
            availability,
            url,
          }
        : {
            "@type": "Offer",
            priceCurrency: "BRL",
            price: reais(low),
            availability,
            itemCondition: "https://schema.org/NewCondition",
            url,
            seller: { "@type": "Organization", name: storeName },
            ...(p.promo?.endsAt ? { priceValidUntil: p.promo.endsAt.slice(0, 10) } : {}),
          },
    ...(p.ratingCount > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.ratingAvg.toFixed(1), reviewCount: p.ratingCount, bestRating: 5, worstRating: 1 } }
      : {}),
  };
  const crumbs = [
    { name: "Início", item: absoluteUrl("/") },
    ...(p.category?.parent ? [{ name: p.category.parent.name, item: absoluteUrl(`/categoria/${p.category.parent.slug}`) }] : []),
    ...(p.category ? [{ name: p.category.name, item: absoluteUrl(`/categoria/${p.category.slug}`) }] : []),
    { name: p.name, item: url },
  ];
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.item })),
  };
  // Evita que "</script>" no texto feche a tag.
  return JSON.stringify([product, breadcrumb]).replace(/</g, "\\u003c");
}

export function ProductView({
  product,
  settings,
  related,
  reviews,
}: {
  product: ProductDetailDTO;
  settings: PublicSettings;
  related: ProductCardDTO[];
  reviews: ReviewsPage;
}) {
  const a = settings.address;
  const pickupPlace = a?.street ? `${a.street}${a.number ? `, ${a.number}` : ""}${a.neighborhood ? ` · ${a.neighborhood}` : ""}${a.city ? `, ${a.city}` : ""}` : null;
  const video = product.videoUrl && /^https?:\/\//i.test(product.videoUrl) ? product.videoUrl : null;

  const breadcrumbs = [
    { label: "Início", href: "/" },
    ...(product.category?.parent ? [{ label: product.category.parent.name, href: `/categoria/${product.category.parent.slug}` }] : []),
    ...(product.category ? [{ label: product.category.name, href: `/categoria/${product.category.slug}` }] : []),
    { label: product.name },
  ];

  const description = (
    <div className="max-w-3xl space-y-6">
      {product.description?.trim() ? (
        <Markdown content={product.description} className="text-[15px] sm:text-base" />
      ) : product.shortDescription ? (
        <p className="text-[15px] leading-relaxed text-muted-foreground sm:text-base">{product.shortDescription}</p>
      ) : (
        <p className="text-sm text-muted-foreground">A descrição detalhada deste produto ainda não foi cadastrada. Veja a ficha técnica ou fale com a gente no WhatsApp.</p>
      )}
      {video && (
        <a
          href={video}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-border-strong px-4 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
        >
          <PlayCircle className="size-4.5" aria-hidden /> Assistir ao vídeo do produto
        </a>
      )}
      {product.tags.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Etiquetas">
          {product.tags.slice(0, 12).map((t) => (
            <li key={t} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd(product, settings.store.name) }} />
      <div className="container-page pb-12 pt-4 sm:pt-6">
        <Breadcrumbs items={breadcrumbs} className="[&_li:last-child]:hidden sm:[&_li:last-child]:flex" />

        <PurchaseProvider
          key={product.id}
          product={product}
          pay={{
            pixDiscountPercent: settings.payment.pixDiscountPercent,
            installmentsMax: settings.payment.installmentsMax,
            installmentsMinCents: settings.payment.installmentsMinCents,
          }}
        >
          <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12 xl:gap-16">
            <div className="min-w-0 lg:sticky lg:top-36 lg:self-start">
              <ProductGallery images={product.images} name={product.name} />
            </div>
            <div className="min-w-0 space-y-5">
              <BuyBox storeWhatsapp={settings.store.whatsapp} productUrl={absoluteUrl(`/produto/${product.slug}`)} />
              <ShippingEstimator
                pickup={{ enabled: settings.pickupEnabled, place: pickupPlace, instructions: settings.pickupInstructions }}
                freeShippingAboveCents={settings.shipping.enabled ? settings.shipping.freeShippingAboveCents : null}
              />
              <TrustRow warrantyMonths={product.warrantyMonths} methods={settings.payment.methods} etaText={settings.shipping.etaText} />
            </div>
          </div>
        </PurchaseProvider>

        <div className="mt-14 lg:mt-20">
          <ProductSections
            key={product.id}
            sections={[
              { id: "descricao", label: "Descrição", content: description },
              { id: "especificacoes", label: "Ficha técnica", count: specRows(product).length || undefined, content: <SpecsTable product={product} /> },
              { id: "avaliacoes", label: "Avaliações", count: reviews.total, content: <ProductReviews key={product.id} productId={product.id} initial={reviews} /> },
            ]}
          />
        </div>
      </div>

      <div className="space-y-14 pb-16 lg:space-y-20">
        <ProductRail
          title="Você também pode gostar"
          eyebrow={product.category ? product.category.name : "Relacionados"}
          href={product.category ? `/categoria/${product.category.slug}` : undefined}
          products={related}
        />
        <RecentlyViewed key={product.id} currentId={product.id} />
      </div>
      {/* Espaço para a barra fixa de compra no celular. */}
      <div className="h-20 lg:hidden" aria-hidden />
    </>
  );
}
