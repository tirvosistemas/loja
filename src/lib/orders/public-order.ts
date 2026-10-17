import type { DeliveryType, OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { db } from "../db";
import { getStripe } from "../stripe";
import { markOrderPaid, markPaymentProcessing, PAYMENT_PROCESSING } from "./status";
import { paymentIntentId, sessionBelongsTo } from "./stripe-checkout";

// Dados do pedido para a página pública /pedido/[código]. Quem tem o código vê o pedido,
// então nada de CPF, e-mail ou telefone completo aqui.

export function normalizeOrderCode(raw: string) {
  let s = raw;
  try {
    s = decodeURIComponent(raw);
  } catch {}
  return s.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 16);
}

/** "41999998888" → "(41) 9••••-8888" */
export function maskPhone(phone: string) {
  const d = phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length < 10) return "••••";
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)}••••-${d.slice(-4)}`;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

export type PublicOrder = {
  id: string;
  code: string;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentProcessing: boolean;
  deliveryType: DeliveryType;
  customerFirstName: string;
  customerPhoneMasked: string;
  address: { street: string; number: string; neighborhood: string; city: string; state: string } | null;
  distanceKm: number | null;
  items: {
    id: string;
    name: string;
    variantName: string | null;
    image: string | null;
    slug: string | null;
    quantity: number;
    unitPriceCents: number;
    originalUnitPriceCents: number;
    totalCents: number;
  }[];
  subtotalCents: number;
  discountCents: number;
  couponCode: string | null;
  pixDiscountCents: number;
  shippingCents: number;
  totalCents: number;
  changeForCents: number | null;
  events: { id: string; type: string; status: string | null; createdAt: string }[];
};

export async function findOrderByCode(code: string) {
  if (code.length < 4) return null;
  return db.order.findUnique({
    where: { code },
    include: {
      items: { orderBy: { id: "asc" }, include: { product: { select: { slug: true, status: true } } } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
}

type OrderWithRelations = NonNullable<Awaited<ReturnType<typeof findOrderByCode>>>;

export function toPublicOrder(o: OrderWithRelations): PublicOrder {
  return {
    id: o.id,
    code: o.code,
    createdAt: o.createdAt.toISOString(),
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    paymentProcessing: o.events.some((e) => e.type === "payment" && e.status === PAYMENT_PROCESSING),
    deliveryType: o.deliveryType,
    customerFirstName: firstName(o.customerName),
    customerPhoneMasked: maskPhone(o.customerPhone),
    address:
      o.deliveryType === "DELIVERY"
        ? {
            street: o.street ?? "",
            number: o.number ?? "",
            neighborhood: o.neighborhood ?? "",
            city: o.city ?? "",
            state: o.state ?? "",
          }
        : null,
    distanceKm: o.distanceKm,
    items: o.items.map((i) => ({
      id: i.id,
      name: i.name,
      variantName: i.variantName,
      image: i.image,
      slug: i.product?.status === "ACTIVE" ? i.product.slug : null,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      originalUnitPriceCents: i.originalUnitPriceCents,
      totalCents: i.totalCents,
    })),
    subtotalCents: o.subtotalCents,
    discountCents: o.discountCents,
    couponCode: o.couponCode,
    pixDiscountCents: o.pixDiscountCents,
    shippingCents: o.shippingCents,
    totalCents: o.totalCents,
    changeForCents: o.changeForCents,
    events: o.events.map((e) => ({ id: e.id, type: e.type, status: e.status, createdAt: e.createdAt.toISOString() })),
  };
}

/**
 * Volta da página da Stripe: confere a sessão no servidor (nunca confia na URL) e, se o
 * pagamento foi aprovado, marca o pedido como pago. Serve de reserva caso o webhook atrase.
 */
export async function confirmStripeReturn(
  order: { id: string; code: string; paymentMethod: PaymentMethod; paymentStatus: PaymentStatus },
  sessionId: string,
): Promise<"paid" | "processing" | "unpaid" | "invalid"> {
  if (order.paymentMethod !== "ONLINE_STRIPE") return "invalid";
  if (order.paymentStatus === "PAID") return "paid";
  if (!/^cs_[A-Za-z0-9_]{8,250}$/.test(sessionId)) return "invalid";
  const stripe = await getStripe();
  if (!stripe) return "invalid";
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!sessionBelongsTo(session, order)) return "invalid";
    if (session.payment_status === "paid") {
      const r = await markOrderPaid(order.id, {
        stripePaymentIntentId: paymentIntentId(session),
        note: "Pagamento aprovado na Stripe",
        actor: "Stripe",
      });
      return r.ok ? "paid" : "unpaid";
    }
    if (session.status === "complete") {
      // Boleto ou Pix gerado: aguarda a compensação (o webhook confirma depois).
      await markPaymentProcessing(order.id);
      return "processing";
    }
    return "unpaid";
  } catch (e) {
    console.warn("[pedidos] não foi possível conferir a sessão da Stripe:", (e as Error).message);
    return "unpaid";
  }
}
