import { getFooterPages, getMenuCategories } from "@/lib/catalog";
import { getPublicSettings } from "@/lib/settings";
import { AnnouncementBar } from "@/components/store/layout/announcement-bar";
import { Header } from "@/components/store/layout/header";
import { Footer } from "@/components/store/layout/footer";
import { CartDrawer } from "@/components/store/layout/cart-drawer";
import { MobileTabBar } from "@/components/store/layout/mobile-tab-bar";
import { WhatsAppFloat } from "@/components/store/layout/whatsapp-float";
import { CookieConsent } from "@/components/store/layout/cookie-consent";
import { DeferredPushPrompt } from "@/components/store/layout/deferred-push-prompt";
import { Analytics } from "@/components/store/layout/analytics";
import { getStoreVapidKey } from "@/components/store/layout/vapid";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories, footerPages, vapidPublicKey] = await Promise.all([
    getPublicSettings(),
    getMenuCategories(),
    getFooterPages(),
    getStoreVapidKey(),
  ]);
  const { store, shipping, push, analytics } = settings;

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only z-[200] rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>

      {store.announcementEnabled && store.announcementText && (
        <AnnouncementBar text={store.announcementText} href={store.announcementHref || undefined} />
      )}
      <Header categories={categories} whatsapp={store.whatsapp} />

      <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>

      <Footer settings={settings} categories={categories} pages={footerPages} />
      <MobileTabBar />

      <CartDrawer freeShipping={shipping.freeShipping} />
      <WhatsAppFloat phone={store.whatsapp} />
      <CookieConsent />
      <DeferredPushPrompt vapidPublicKey={vapidPublicKey} delaySeconds={push.promptDelaySeconds} enabled={push.promptEnabled} />
      <Analytics googleAnalyticsId={analytics.googleAnalyticsId} metaPixelId={analytics.metaPixelId} />
    </div>
  );
}
