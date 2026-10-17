import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { markOrderPaid } from "@/lib/orders/status";
import { createStripeCheckout, paymentIntentId, sessionBelongsTo } from "@/lib/orders/stripe-checkout";

// Nova tentativa de pagamento online para um pedido que ainda aguarda pagamento.
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  if (!rateLimit(`pay:${clientIp(req.headers)}`, 10, 60_000).ok) {
    return NextResponse.json({ error: "Muitas tentativas seguidas. Aguarde um pouco." }, { status: 429 });
  }
  const { code: raw } = await ctx.params;
  const code = raw.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 16);

  const order = await db.order.findUnique({ where: { code }, include: { items: { orderBy: { id: "asc" } } } });
  if (!order) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  if (order.paymentMethod !== "ONLINE_STRIPE") {
    return NextResponse.json({ error: "Este pedido não usa pagamento online." }, { status: 409 });
  }
  if (order.paymentStatus === "PAID") return NextResponse.json({ error: "Este pedido já está pago." }, { status: 409 });
  if (order.status === "CANCELED") {
    return NextResponse.json({ error: "Este pedido foi cancelado. Faça um novo pedido pelo site." }, { status: 409 });
  }
  if (order.paymentStatus !== "PENDING") {
    return NextResponse.json({ error: "Não é possível pagar este pedido online. Fale com a loja pelo WhatsApp." }, { status: 409 });
  }

  const stripe = await getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "O pagamento online está indisponível no momento. Fale com a loja." }, { status: 503 });
  }

  try {
    // Reaproveita a sessão anterior enquanto ela estiver aberta.
    if (order.stripeSessionId) {
      const current = await stripe.checkout.sessions.retrieve(order.stripeSessionId).catch(() => null);
      if (current && sessionBelongsTo(current, order)) {
        if (current.payment_status === "paid") {
          await markOrderPaid(order.id, { stripePaymentIntentId: paymentIntentId(current), actor: "Stripe" });
          return NextResponse.json({ error: "O pagamento deste pedido já foi aprovado." }, { status: 409 });
        }
        if (current.status === "complete") {
          return NextResponse.json({ error: "O pagamento já foi iniciado e está aguardando compensação." }, { status: 409 });
        }
        if (current.status === "open" && current.url) return NextResponse.json({ url: current.url });
      }
    }

    const session = await createStripeCheckout({
      id: order.id,
      code: order.code,
      customerEmail: order.customerEmail,
      deliveryType: order.deliveryType,
      distanceKm: order.distanceKm,
      discountCents: order.discountCents,
      couponCode: order.couponCode,
      shippingCents: order.shippingCents,
      totalCents: order.totalCents,
      items: order.items.map((i) => ({
        name: i.name,
        variantName: i.variantName,
        image: i.image,
        unitPriceCents: i.unitPriceCents,
        quantity: i.quantity,
      })),
    });
    await db.order.update({ where: { id: order.id }, data: { stripeSessionId: session.id } });
    await db.orderEvent.create({ data: { orderId: order.id, type: "payment", status: "PENDING", note: "Nova tentativa de pagamento online" } });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[pedidos] falha ao reabrir pagamento:", e);
    return NextResponse.json({ error: "Não foi possível abrir o pagamento agora. Tente de novo em instantes." }, { status: 502 });
  }
}
