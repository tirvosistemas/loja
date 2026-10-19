import { getActiveBanners, getHomeData } from "@/lib/catalog";
import { getPublicSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/utils";
import { ProductRail } from "@/components/store/product-rail";
import { HeroCarousel } from "@/components/store/home/hero-carousel";
import { FallbackHero } from "@/components/store/home/fallback-hero";
import { Benefits } from "@/components/store/home/benefits";
import { CategoryGrid } from "@/components/store/home/category-grid";
import { FlashDeals } from "@/components/store/home/flash-deals";
import { StripBanners } from "@/components/store/home/strip-banners";
import { OffersGrid } from "@/components/store/home/offers-grid";
import { ComingSoonSection } from "@/components/store/home/coming-soon-section";
import { BrandsStrip } from "@/components/store/home/brands-strip";
import { AppSection } from "@/components/store/home/app-section";
import { Newsletter } from "@/components/store/home/newsletter";
import { WhatsAppBand } from "@/components/store/home/whatsapp-band";
import { socialUrl } from "@/components/store/layout/social-icons";
import { getStoreVapidKey } from "@/components/store/layout/vapid";

export default async function HomePage() {
  const [data, hero, strip, settings, vapidPublicKey] = await Promise.all([
    getHomeData(),
    getActiveBanners("HERO"),
    getActiveBanners("STRIP"),
    getPublicSettings(),
    getStoreVapidKey(),
  ]);
  const { store, appearance, address, shipping } = settings;

  // "Mais vendidos" só com produtos que realmente venderam.
  const bestSellers = data.bestSellers.filter((p) => p.soldCount > 0);
  // A lista de mais vendidos traz qualquer produto ativo: vazia = loja ainda sem produtos.
  // Nesse caso as seções de produtos aparecem com cartões "Em breve", para a página já ter a cara final.
  const comingSoon = data.bestSellers.length === 0;
  // Sem produto marcado como destaque, os destaques mostram os produtos ativos: o primeiro cadastrado já aparece.
  const highlights = data.featured.length ? data.featured : data.bestSellers;

  const sameAs = (["instagram", "facebook", "tiktok", "youtube"] as const)
    .map((n) => socialUrl(n, store[n]))
    .filter((u): u is string => !!u);
  const phone = store.whatsapp || store.phone;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: store.legalName || store.name,
      alternateName: store.name,
      url: absoluteUrl("/"),
      logo: absoluteUrl("/icon-512.png"),
      description: store.description,
      slogan: store.tagline,
      ...(store.email ? { email: store.email } : {}),
      ...(sameAs.length ? { sameAs } : {}),
      ...(phone
        ? { contactPoint: { "@type": "ContactPoint", telephone: `+55${phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")}`, contactType: "customer service", areaServed: "BR-PR", availableLanguage: "pt-BR" } }
        : {}),
      ...(address
        ? {
            address: {
              "@type": "PostalAddress",
              streetAddress: [address.street, address.number].filter(Boolean).join(", "),
              addressLocality: address.city,
              addressRegion: address.state,
              postalCode: address.cep,
              addressCountry: "BR",
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: store.name,
      url: absoluteUrl("/"),
      inLanguage: "pt-BR",
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl("/busca")}?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="flex flex-col gap-12 md:gap-20">
        <div className="flex flex-col gap-6 md:gap-8">
          {hero.length > 0 ? (
            <>
              <h1 className="sr-only">
                {store.name} · eletrônicos com entrega em Curitiba e região metropolitana
              </h1>
              <HeroCarousel banners={hero} autoplayMs={appearance.heroAutoplayMs} />
            </>
          ) : (
            <FallbackHero
              categoriesHref={data.categories.length ? "#categorias" : "/busca"}
              cities={shipping.allowedCities?.length ?? null}
            />
          )}
          <Benefits settings={settings} />
        </div>

        <CategoryGrid categories={data.categories} />

        {data.flash && <FlashDeals endsAt={data.flash.endsAt} products={data.flash.products} />}

        {comingSoon ? (
          <ComingSoonSection name="destaques" eyebrow="Selecionados" title="Destaques" description="Os produtos escolhidos a dedo aparecem aqui." />
        ) : (
          <ProductRail eyebrow="Selecionados" title="Destaques" products={highlights} />
        )}

        <StripBanners banners={strip} />

        {comingSoon ? (
          <ComingSoonSection name="ofertas" eyebrow="Preço baixo" title="Ofertas da semana" description="As promoções da semana aparecem aqui." />
        ) : (
          <OffersGrid products={data.onSale} />
        )}

        {comingSoon ? (
          <ComingSoonSection name="lancamentos" eyebrow="Chegou agora" title="Lançamentos" description="As novidades da loja aparecem aqui." />
        ) : (
          data.newArrivals.length > 0 && (
            <ProductRail eyebrow="Chegou agora" title="Lançamentos" href="/lancamentos" hrefLabel="Ver lançamentos" products={data.newArrivals} />
          )
        )}

        {comingSoon ? (
          <ComingSoonSection name="mais-vendidos" eyebrow="Os favoritos de Curitiba" title="Mais vendidos" description="Os favoritos dos clientes aparecem aqui." />
        ) : (
          bestSellers.length >= 4 && (
            <ProductRail
              eyebrow="Os favoritos de Curitiba"
              title="Mais vendidos"
              href="/busca?ordem=best-sellers"
              hrefLabel="Ver mais vendidos"
              products={bestSellers}
            />
          )
        )}

        {appearance.showBrands && <BrandsStrip brands={data.brands} />}

        {appearance.showAppSection && <AppSection vapidPublicKey={vapidPublicKey} storeName={store.name} />}

        {appearance.showNewsletter && <Newsletter />}

        <WhatsAppBand phone={store.whatsapp} businessHours={store.businessHours} />
      </div>
    </>
  );
}
