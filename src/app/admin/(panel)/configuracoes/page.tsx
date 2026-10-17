import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, Bike, CreditCard, KeyRound, MapPin, Search, Store, type LucideIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { RMC_CITIES, getSecretPreviews, getSettings } from "@/lib/settings";
import { ensureVapidKeys } from "@/lib/push";
import { absoluteUrl, cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import { StoreForm } from "@/components/admin/settings/store-form";
import { AddressForm } from "@/components/admin/settings/address-form";
import { ShippingForm } from "@/components/admin/settings/shipping-form";
import { PaymentForm } from "@/components/admin/settings/payment-form";
import { IntegrationsForm } from "@/components/admin/settings/integrations-form";
import { AppForm } from "@/components/admin/settings/app-form";
import { SeoForm } from "@/components/admin/settings/seo-form";

export const metadata: Metadata = { title: "Configurações" };

const TABS: { id: string; label: string; icon: LucideIcon; description: string }[] = [
  { id: "loja", label: "Loja", icon: Store, description: "Nome, WhatsApp dos pedidos, contato e redes sociais." },
  { id: "endereco", label: "Endereço e retirada", icon: MapPin, description: "De onde saem as entregas e onde o cliente retira." },
  { id: "frete", label: "Frete e entrega", icon: Bike, description: "Preço por km, frete grátis, raio e cidades atendidas." },
  { id: "pagamentos", label: "Pagamentos", icon: CreditCard, description: "Stripe, Pix e pagamento na entrega." },
  { id: "integracoes", label: "Integrações", icon: KeyRound, description: "Chaves da Stripe, mapas e análise de visitas." },
  { id: "app", label: "App e notificações", icon: BellRing, description: "Notificações push e instalação do app." },
  { id: "seo", label: "SEO e aparência", icon: Search, description: "Google, compartilhamento e visual da loja." },
];

type SP = Record<string, string | string[] | undefined>;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin(["OWNER", "ADMIN"]);
  const sp = await searchParams;
  const raw = Array.isArray(sp.aba) ? sp.aba[0] : sp.aba;
  const tab = TABS.find((t) => t.id === raw) ?? TABS[0];
  const s = await getSettings();

  let content: React.ReactNode;
  switch (tab.id) {
    case "endereco":
      content = <AddressForm initial={s.address} />;
      break;
    case "frete": {
      const round = [1, 10, 50, 100] as const;
      const roundTo = round.reduce((best, r) => (Math.abs(r - s.shipping.roundToCents) < Math.abs(best - s.shipping.roundToCents) ? r : best), round[0]);
      content = (
        <ShippingForm
          initial={{ ...s.shipping, roundToCents: roundTo, straightLineFactor: s.shipping.straightLineFactor }}
          rmcCities={RMC_CITIES}
          originReady={s.address.lat != null && s.address.lng != null}
        />
      );
      break;
    }
    case "pagamentos":
      content = <PaymentForm initial={s.payment} stripeKeysReady={!!s.integrations.stripePublishableKey && !!s.integrations.stripeSecretKey} />;
      break;
    case "integracoes": {
      const previews = await getSecretPreviews();
      const i = s.integrations;
      content = (
        <IntegrationsForm
          initial={{
            stripePublishableKey: i.stripePublishableKey,
            stripeSecretKey: "",
            clearStripeSecretKey: false,
            stripeWebhookSecret: "",
            clearStripeWebhookSecret: false,
            mapsProvider: i.mapsProvider,
            mapsApiKey: "",
            clearMapsApiKey: false,
            googleAnalyticsId: i.googleAnalyticsId,
            metaPixelId: i.metaPixelId,
          }}
          previews={{ stripeSecretKey: previews.stripeSecretKey, stripeWebhookSecret: previews.stripeWebhookSecret, mapsApiKey: previews.mapsApiKey }}
          webhookUrl={absoluteUrl("/api/stripe/webhook")}
        />
      );
      break;
    }
    case "app": {
      const [vapid, subscribers] = await Promise.all([ensureVapidKeys(), db.pushSubscription.count()]);
      content = (
        <AppForm
          initial={{ subject: s.push.subject, promptEnabled: s.push.promptEnabled, promptDelaySeconds: s.push.promptDelaySeconds, autoNotifyPromotions: s.push.autoNotifyPromotions }}
          vapidPublicKey={vapid.publicKey}
          subscribers={subscribers}
        />
      );
      break;
    }
    case "seo":
      content = <SeoForm initial={{ ...s.seo, ...s.appearance }} siteUrl={absoluteUrl("/")} />;
      break;
    default:
      content = (
        <StoreForm
          initial={{
            name: s.store.name,
            tagline: s.store.tagline,
            description: s.store.description,
            whatsapp: s.store.whatsapp,
            phone: s.store.phone,
            email: s.store.email,
            legalName: s.store.legalName,
            cnpj: s.store.cnpj,
            businessHours: s.store.businessHours,
            instagram: s.store.instagram,
            facebook: s.store.facebook,
            tiktok: s.store.tiktok,
            youtube: s.store.youtube,
            announcementEnabled: s.store.announcementEnabled,
            announcementText: s.store.announcementText,
            announcementHref: s.store.announcementHref,
          }}
        />
      );
  }

  return (
    <>
      <PageHeader title="Configurações" description="Tudo da loja em um lugar. As mudanças valem no site assim que você salva." />

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Seções das configurações" className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:sticky lg:top-24 lg:self-start lg:overflow-visible">
          <ul className="flex min-w-max gap-1.5 lg:min-w-0 lg:flex-col lg:gap-0.5">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = t.id === tab.id;
              return (
                <li key={t.id}>
                  <Link
                    href={`/admin/configuracoes?aba=${t.id}`}
                    aria-current={active ? "page" : undefined}
                    scroll={false}
                    className={cn(
                      "flex h-10 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 text-sm transition-colors",
                      active
                        ? "bg-elevated font-medium text-foreground ring-1 ring-border"
                        : "border border-border text-muted-foreground hover:bg-elevated/60 hover:text-foreground lg:border-transparent",
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-subtle")} aria-hidden />
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">{tab.label}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{tab.description}</p>
          </div>
          {/* key: troca de aba recria o formulário com os valores salvos */}
          <div key={tab.id}>{content}</div>
        </div>
      </div>
    </>
  );
}
