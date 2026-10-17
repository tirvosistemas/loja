import type { Metadata } from "next";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { getPublicSettings } from "@/lib/settings";
import { onlyDigits } from "@/lib/utils";
import { ListingHeader } from "@/components/store/catalog/headers";
import { CheckoutView } from "@/components/store/checkout/checkout-view";

export const metadata: Metadata = {
  title: "Finalizar compra",
  description: "Informe seus dados, escolha a entrega e a forma de pagamento.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const s = await getPublicSettings();
  const a = s.address;
  const place = a && a.street ? [`${a.street}${a.number ? `, ${a.number}` : ""}`, a.neighborhood, a.city && `${a.city}/${a.state}`].filter(Boolean).join(" · ") : null;

  return (
    <div className="container-page pb-10 pt-4 sm:pt-6 lg:pb-16">
      <ListingHeader
        breadcrumbs={[{ label: "Início", href: "/" }, { label: "Carrinho", href: "/carrinho" }, { label: "Finalizar compra" }]}
        eyebrow="Checkout"
        title="Finalizar compra"
        description="Quatro passos rápidos. Os valores são conferidos no servidor a cada mudança."
        aside={
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-subtle">
            <Lock className="size-3.5 text-primary" aria-hidden /> Compra segura
          </p>
        }
      />
      <Suspense fallback={null}>
        <CheckoutView
          config={{
            methods: s.payment.methods,
            pixDiscountPercent: s.payment.pixDiscountPercent,
            deliveryEnabled: s.shipping.enabled,
            pickupEnabled: s.pickupEnabled,
            pickup: { place, instructions: s.pickupInstructions, hours: s.store.businessHours },
            freeShipping: { enabled: s.shipping.enabled, aboveCents: s.shipping.freeShippingAboveCents, maxKm: s.shipping.freeShippingMaxKm },
            hasWhatsapp: onlyDigits(s.store.whatsapp).length >= 10,
          }}
        />
      </Suspense>
    </div>
  );
}
