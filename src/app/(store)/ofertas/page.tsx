import type { Metadata } from "next";
import { Zap } from "lucide-react";
import { getActivePromotions } from "@/lib/pricing";
import { getPublicSettings } from "@/lib/settings";
import { Breadcrumbs } from "@/components/ui/nav";
import { Countdown } from "@/components/ui/countdown";
import { Badge } from "@/components/ui/badge";
import { CatalogView, loadListing } from "@/components/store/catalog/catalog-view";
import { Eyebrow } from "@/components/store/catalog/headers";
import { OffersPushCta } from "@/components/store/catalog/offers-push";
import { activeFilterCount, canonicalFor, type RawSearchParams } from "@/components/store/catalog/params";

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawSearchParams> }): Promise<Metadata> {
  const [s, sp] = await Promise.all([getPublicSettings(), searchParams]);
  const description = `Ofertas e promoções de eletrônicos na ${s.store.name}, com entrega rápida por motoboy em Curitiba e região metropolitana.`;
  return { title: "Ofertas", description, alternates: { canonical: canonicalFor("/ofertas", sp) }, openGraph: { title: `Ofertas · ${s.store.name}`, description, url: "/ofertas" } };
}

export default async function OffersPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const sp = await searchParams;
  const [listing, promos, settings] = await Promise.all([
    loadListing(sp, { basePath: "/ofertas", defaultSort: "discount", base: { onSale: true } }),
    getActivePromotions(),
    getPublicSettings(),
  ]);

  const flash = promos.filter((p) => p.flash && p.endsAt);
  const flashEndsAt = flash.length ? flash.reduce((min, p) => (p.endsAt! < min ? p.endsAt! : min), flash[0].endsAt!) : null;
  const flashName = flash.find((p) => p.endsAt?.getTime() === flashEndsAt?.getTime());
  const campaigns = [...new Set(promos.filter((p) => !p.flash).map((p) => p.badge || p.name))].slice(0, 6);

  const header = (
    <header>
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Ofertas" }]} />
      <section className="relative mt-4 overflow-hidden rounded-3xl border border-border bg-card sm:mt-5">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="glow-orange pointer-events-none absolute -left-24 -top-32 size-[28rem]" aria-hidden />
        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10 lg:p-10">
          <div className="min-w-0 max-w-2xl">
            <Eyebrow pulse>Ofertas</Eyebrow>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Desconto de verdade, <span className="text-brand">entrega rápida.</span>
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              Eletrônicos com preço baixo e entrega por motoboy em Curitiba e região.
              {settings.payment.pixDiscountPercent > 0 && ` No Pix, você ganha mais ${settings.payment.pixDiscountPercent}% de desconto.`}
            </p>
            {campaigns.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Campanhas ativas">
                {campaigns.map((c) => (
                  <li key={c}>
                    <Badge tone="accent">{c}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {flashEndsAt && (
            <div className="rounded-2xl border border-primary/30 bg-background/70 p-5 backdrop-blur lg:min-w-80">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Zap className="size-4" aria-hidden /> {flashName?.badge || "Oferta relâmpago"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Termina em</p>
              <Countdown endsAt={flashEndsAt.toISOString()} className="mt-3" />
            </div>
          )}
        </div>
        {settings.push.vapidPublicKey && (
          <div className="relative px-6 pb-6 sm:px-8 sm:pb-8 lg:px-10 lg:pb-10">
            <OffersPushCta vapidPublicKey={settings.push.vapidPublicKey} />
          </div>
        )}
      </section>
    </header>
  );

  const nothingOnSale = listing.result.total === 0 && activeFilterCount(listing.cfg, listing.state) === 0;
  return (
    <CatalogView
      listing={listing}
      header={header}
      empty={
        nothingOnSale
          ? {
              title: "Nenhuma oferta no ar agora",
              description: settings.push.vapidPublicKey
                ? "Novas promoções entram toda semana. Ative as notificações para saber primeiro."
                : "Novas promoções entram toda semana. Volte em breve.",
            }
          : undefined
      }
    />
  );
}
