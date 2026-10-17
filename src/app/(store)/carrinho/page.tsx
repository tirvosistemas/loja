import type { Metadata } from "next";
import { getPublicSettings } from "@/lib/settings";
import { ListingHeader } from "@/components/store/catalog/headers";
import { CartView } from "@/components/store/cart/cart-view";

export const metadata: Metadata = {
  title: "Carrinho",
  description: "Confira os itens, aplique seu cupom e calcule o frete por motoboy.",
  robots: { index: false, follow: false },
};

function placeLine(a: { street: string; number: string; neighborhood: string; city: string; state: string } | null) {
  if (!a || !a.street) return null;
  return [`${a.street}${a.number ? `, ${a.number}` : ""}`, a.neighborhood, a.city && `${a.city}/${a.state}`].filter(Boolean).join(" · ");
}

export default async function CartPage() {
  const settings = await getPublicSettings();
  const { shipping } = settings;
  return (
    <div className="container-page pb-12 pt-4 sm:pt-6 lg:pb-16">
      <ListingHeader
        breadcrumbs={[{ label: "Início", href: "/" }, { label: "Carrinho" }]}
        eyebrow="Sua compra"
        title="Carrinho"
        description="Preços, estoque e frete conferidos em tempo real. Entrega por motoboy em Curitiba e região."
      />
      <CartView
        freeShipping={{ enabled: shipping.enabled, aboveCents: shipping.freeShippingAboveCents, maxKm: shipping.freeShippingMaxKm }}
        pickup={{ enabled: settings.pickupEnabled, place: placeLine(settings.address) }}
      />
    </div>
  );
}
