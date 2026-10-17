import type Stripe from "stripe";
import { getStripe } from "../stripe";
import { imageUrl } from "../images";
import { formatKm } from "../format";
import { absoluteUrl } from "../utils";

// Sessão de pagamento da Stripe (página segura da Stripe com cartão, Pix ou boleto,
// conforme os métodos ativos na conta). Os valores vêm do pedido já gravado no banco.

/** A Stripe não cobra menos que R$ 0,50. */
export const STRIPE_MIN_CENTS = 50;
const SESSION_MINUTES = 60;

export type OrderForStripe = {
  id: string;
  code: string;
  customerEmail: string | null;
  deliveryType: "DELIVERY" | "PICKUP";
  distanceKm: number | null;
  discountCents: number;
  couponCode: string | null;
  shippingCents: number;
  totalCents: number;
  items: { name: string; variantName: string | null; image: string | null; unitPriceCents: number; quantity: number }[];
};

export class StripeUnavailableError extends Error {
  constructor() {
    super("A Stripe não está configurada.");
    this.name = "StripeUnavailableError";
  }
}

function publicImage(src: string | null) {
  if (!src) return null;
  const url = /^https?:\/\//i.test(src) ? src : absoluteUrl(imageUrl(src, "md"));
  return url.startsWith("https://") ? url : null;
}

export async function createStripeCheckout(order: OrderForStripe): Promise<{ id: string; url: string }> {
  const stripe = await getStripe();
  if (!stripe) throw new StripeUnavailableError();

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((i) => {
    const image = publicImage(i.image);
    return {
      quantity: i.quantity,
      price_data: {
        currency: "brl",
        unit_amount: i.unitPriceCents,
        product_data: {
          name: (i.variantName ? `${i.name} (${i.variantName})` : i.name).slice(0, 250),
          ...(image ? { images: [image] } : {}),
        },
      },
    };
  });

  if (order.deliveryType === "DELIVERY" && order.shippingCents > 0) {
    const km = order.distanceKm ? ` (${formatKm(order.distanceKm)})` : "";
    line_items.push({
      quantity: 1,
      price_data: { currency: "brl", unit_amount: order.shippingCents, product_data: { name: `Entrega por motoboy${km}` } },
    });
  }

  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  if (order.discountCents > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: order.discountCents,
      currency: "brl",
      duration: "once",
      max_redemptions: 1,
      name: (order.couponCode ? `Cupom ${order.couponCode}` : `Desconto do pedido #${order.code}`).slice(0, 40),
      metadata: { orderId: order.id, code: order.code },
    });
    discounts = [{ coupon: coupon.id }];
  }

  const metadata = { orderId: order.id, code: order.code };
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    currency: "brl",
    locale: "pt-BR",
    line_items,
    ...(discounts ? { discounts } : {}),
    ...(order.customerEmail ? { customer_email: order.customerEmail } : {}),
    client_reference_id: order.code,
    metadata,
    payment_intent_data: { metadata, description: `Pedido #${order.code}` },
    success_url: `${absoluteUrl(`/pedido/${order.code}`)}?pagamento=sucesso&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${absoluteUrl(`/pedido/${order.code}`)}?pagamento=cancelado`,
    expires_at: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
  });
  if (!session.url) throw new Error("A Stripe não devolveu o link de pagamento.");
  return { id: session.id, url: session.url };
}

/** Confere se a sessão da Stripe pertence a este pedido. */
export function sessionBelongsTo(session: Stripe.Checkout.Session, order: { id: string; code: string }) {
  return session.metadata?.orderId === order.id || session.metadata?.code === order.code || session.client_reference_id === order.code;
}

export function paymentIntentId(session: Stripe.Checkout.Session): string | undefined {
  const pi = session.payment_intent;
  if (!pi) return undefined;
  return typeof pi === "string" ? pi : pi.id;
}
