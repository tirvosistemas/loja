import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/format";
import { getStripeWebhookSecret } from "@/lib/stripe";
import {
  cancelExpiredStripeOrders,
  markOrderPaid,
  markPaymentProcessing,
  setPaymentStatus,
  updateOrderStatus,
} from "@/lib/orders/status";
import { paymentIntentId } from "@/lib/orders/stripe-checkout";

// Avisos da Stripe (Configurações → Integrações → segredo do webhook). Cadastre na Stripe:
// <site>/api/stripe/webhook com os eventos checkout.session.* e charge.refunded.

type OrderRef = { id: string; status: string; paymentStatus: string; stripeSessionId: string | null; totalCents: number };

const orderSelect = { id: true, status: true, paymentStatus: true, stripeSessionId: true, totalCents: true } as const;

async function orderForSession(session: Stripe.Checkout.Session): Promise<OrderRef | null> {
  const orderId = session.metadata?.orderId;
  if (orderId) {
    const byId = await db.order.findUnique({ where: { id: orderId }, select: orderSelect });
    if (byId) return byId;
  }
  const bySession = await db.order.findUnique({ where: { stripeSessionId: session.id }, select: orderSelect });
  if (bySession) return bySession;
  const code = session.metadata?.code || session.client_reference_id;
  return code ? db.order.findUnique({ where: { code }, select: orderSelect }) : null;
}

async function handleSession(type: string, session: Stripe.Checkout.Session) {
  const order = await orderForSession(session);
  if (!order) {
    console.warn(`[stripe] pedido não encontrado para a sessão ${session.id}`);
    return;
  }
  const pi = paymentIntentId(session);

  switch (type) {
    case "checkout.session.completed":
      if (session.payment_status === "paid") {
        await markOrderPaid(order.id, { stripePaymentIntentId: pi, note: "Pagamento aprovado na Stripe", actor: "Stripe" });
      } else {
        // Boleto ou outro método com compensação posterior.
        if (pi) await db.order.update({ where: { id: order.id }, data: { stripePaymentIntentId: pi } });
        await markPaymentProcessing(order.id);
      }
      break;
    case "checkout.session.async_payment_succeeded":
      await markOrderPaid(order.id, { stripePaymentIntentId: pi, note: "Pagamento compensado na Stripe", actor: "Stripe" });
      break;
    case "checkout.session.async_payment_failed":
      if (order.paymentStatus !== "PAID") {
        await setPaymentStatus(order.id, "FAILED", { note: "O pagamento não foi compensado", actor: "Stripe" });
      }
      break;
    case "checkout.session.expired":
      // Só cancela se esta for a sessão atual do pedido (o cliente pode ter aberto outra).
      if (
        order.status === "NEW" &&
        order.paymentStatus === "PENDING" &&
        (!order.stripeSessionId || order.stripeSessionId === session.id)
      ) {
        await updateOrderStatus(order.id, "CANCELED", { note: "Pagamento expirou", actor: "Stripe" });
        await setPaymentStatus(order.id, "EXPIRED", { note: "Sessão de pagamento expirou", actor: "Stripe" });
      }
      break;
  }
}

async function handleRefund(charge: Stripe.Charge) {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) return;
  const order = await db.order.findFirst({ where: { stripePaymentIntentId: pi }, select: orderSelect });
  if (!order) return;
  if (charge.refunded || charge.amount_refunded >= charge.amount) {
    await setPaymentStatus(order.id, "REFUNDED", { note: "Pagamento reembolsado", actor: "Stripe" });
  } else if (charge.amount_refunded > 0) {
    const note = `Reembolso parcial de ${formatBRL(charge.amount_refunded)} na Stripe`;
    const already = await db.orderEvent.findFirst({ where: { orderId: order.id, type: "payment", note }, select: { id: true } });
    if (!already) await db.orderEvent.create({ data: { orderId: order.id, type: "payment", status: "PARTIAL_REFUND", note } });
  }
}

export async function POST(req: Request) {
  // Só o segredo do webhook é necessário: avisos de pedidos antigos (boleto compensado,
  // reembolso) continuam valendo mesmo se o pagamento online for desligado depois.
  const secret = await getStripeWebhookSecret();
  if (!secret) return NextResponse.json({ error: "Stripe não configurada." }, { status: 503 });

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!signature) return NextResponse.json({ error: "Assinatura ausente." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(body, signature, secret);
  } catch (e) {
    console.warn("[stripe] assinatura inválida:", (e as Error).message);
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":
        await handleSession(event.type, event.data.object);
        break;
      case "charge.refunded":
        await handleRefund(event.data.object);
        break;
    }
  } catch (e) {
    console.error(`[stripe] falha ao processar ${event.type}:`, e);
    // 500 faz a Stripe tentar de novo mais tarde (o processamento é idempotente).
    return NextResponse.json({ error: "Falha ao processar o evento." }, { status: 500 });
  }

  await cancelExpiredStripeOrders();
  return NextResponse.json({ received: true });
}
