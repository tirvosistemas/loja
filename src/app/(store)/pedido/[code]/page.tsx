import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings, stripeIsReady } from "@/lib/settings";
import { onlyDigits } from "@/lib/utils";
import { buildOrderMessage, whatsappLink } from "@/lib/whatsapp";
import { messageInputFromOrder } from "@/lib/orders/message";
import { cancelExpiredStripeOrders } from "@/lib/orders/status";
import { confirmStripeReturn, findOrderByCode, normalizeOrderCode, toPublicOrder } from "@/lib/orders/public-order";
import { AutoRefresh } from "@/components/store/order/auto-refresh";
import { OrderView, type HeroKind } from "@/components/store/order/order-view";

type Props = {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Pedido #${normalizeOrderCode(code)}`,
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function OrderPage({ params, searchParams }: Props) {
  const [{ code: raw }, sp] = await Promise.all([params, searchParams]);
  const code = normalizeOrderCode(raw);

  // Limpeza barata de pagamentos online abandonados (roda no máximo uma vez por minuto).
  await cancelExpiredStripeOrders();

  let row = await findOrderByCode(code);
  if (!row) notFound();

  const pagamento = first(sp.pagamento);
  const sessionId = first(sp.session_id);
  let stripeReturn: Awaited<ReturnType<typeof confirmStripeReturn>> | null = null;
  if (pagamento === "sucesso" && sessionId && row.paymentMethod === "ONLINE_STRIPE") {
    stripeReturn = await confirmStripeReturn(row, sessionId);
    if (stripeReturn === "paid" || stripeReturn === "processing") row = (await findOrderByCode(code)) ?? row;
  }

  const settings = await getSettings();
  const order = toPublicOrder(row);
  const storeWhatsapp = onlyDigits(settings.store.whatsapp).length >= 10 ? settings.store.whatsapp : "";
  // Mensagem remontada com o status atual do pagamento (aparece "✅ PAGO" depois da Stripe).
  const whatsappUrl = storeWhatsapp ? whatsappLink(storeWhatsapp, buildOrderMessage(messageInputFromOrder(row, settings.store.name || "Tirvo"))) : null;
  const helpUrl = storeWhatsapp ? whatsappLink(storeWhatsapp, `Olá! Tenho uma dúvida sobre o pedido #${order.code}.`) : null;

  const stripePending = order.paymentMethod === "ONLINE_STRIPE" && order.paymentStatus === "PENDING";
  const returnedPaid = pagamento === "sucesso" && order.paymentStatus === "PAID";
  let hero: HeroKind = "default";
  if (order.status === "CANCELED") hero = "canceled";
  else if (order.status === "DELIVERED") hero = "delivered";
  else if (returnedPaid) hero = "paid";
  else if (stripePending && (order.paymentProcessing || pagamento === "sucesso")) hero = "processing";
  else if (stripePending && pagamento === "cancelado") hero = "payment-canceled";
  else if (stripePending) hero = "awaiting-payment";
  else if (first(sp.novo) === "1") hero = "new";

  // No Pix manual o cliente precisa ver a chave antes; o WhatsApp abre pelo botão.
  const autoOpenWhatsapp =
    !!whatsappUrl && (hero === "paid" || (hero === "new" && order.paymentMethod !== "ONLINE_STRIPE" && order.paymentMethod !== "PIX_MANUAL"));

  const a = settings.address;
  const place = a.showOnSite && a.street ? [`${a.street}${a.number ? `, ${a.number}` : ""}`, a.neighborhood, a.city && `${a.city}/${a.state}`].filter(Boolean).join(" · ") : null;
  const pix =
    order.paymentMethod === "PIX_MANUAL"
      ? {
          key: settings.payment.pixManualEnabled ? settings.payment.pixKey : "",
          keyType: settings.payment.pixKeyType,
          holder: settings.payment.pixHolder,
        }
      : null;

  return (
    <>
      <OrderView
        order={order}
        hero={hero}
        whatsappUrl={whatsappUrl}
        helpUrl={helpUrl}
        autoOpenWhatsapp={autoOpenWhatsapp}
        pix={pix}
        pickup={{ place, instructions: settings.address.pickupInstructions, hours: settings.store.businessHours }}
        stripeAvailable={stripeIsReady(settings)}
      />
      <AutoRefresh active={order.status !== "DELIVERED" && order.status !== "CANCELED"} />
    </>
  );
}
