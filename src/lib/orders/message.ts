import type { Order, OrderItem } from "@prisma/client";
import { db } from "../db";
import { getSettings } from "../settings";
import { absoluteUrl } from "../utils";
import { buildOrderMessage, type OrderForMessage } from "../whatsapp";

// Mensagem do pedido para o WhatsApp da loja, montada a partir do banco (com o status
// de pagamento atual, para o "✅ PAGO" aparecer depois da confirmação da Stripe).

export function trackUrlFor(code: string) {
  return absoluteUrl(`/pedido/${code}`);
}

export function messageInputFromOrder(order: Order & { items: OrderItem[] }, storeName: string): OrderForMessage {
  return {
    code: order.code,
    storeName,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    deliveryType: order.deliveryType,
    street: order.street,
    number: order.number,
    complement: order.complement,
    neighborhood: order.neighborhood,
    city: order.city,
    state: order.state,
    cep: order.cep,
    reference: order.reference,
    distanceKm: order.distanceKm,
    items: order.items.map((i) => ({
      name: i.name,
      variantName: i.variantName,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
      totalCents: i.totalCents,
    })),
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    couponCode: order.couponCode,
    pixDiscountCents: order.pixDiscountCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    changeForCents: order.changeForCents,
    notes: order.notes,
    trackUrl: trackUrlFor(order.code),
  };
}

/** Remonta a mensagem do WhatsApp com os dados atuais do pedido. */
export async function orderWhatsappMessage(orderId: string): Promise<string> {
  const [order, settings] = await Promise.all([
    db.order.findUnique({ where: { id: orderId }, include: { items: { orderBy: { id: "asc" } } } }),
    getSettings(),
  ]);
  if (!order) return "";
  return buildOrderMessage(messageInputFromOrder(order, settings.store.name || "Tirvo"));
}
