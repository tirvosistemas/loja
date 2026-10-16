import { DELIVERY_TYPE_LABEL, PAYMENT_METHOD_SHORT, type PaymentMethodKey } from "./constants";
import { formatBRL, formatCep, formatKm, formatPhone } from "./format";
import { onlyDigits } from "./utils";

// Mensagem do pedido que chega no WhatsApp da loja, já organizada.

export type OrderForMessage = {
  code: string;
  storeName: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  deliveryType: "DELIVERY" | "PICKUP";
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  reference?: string | null;
  distanceKm?: number | null;
  items: { name: string; variantName?: string | null; quantity: number; unitPriceCents: number; totalCents: number }[];
  subtotalCents: number;
  discountCents: number;
  couponCode?: string | null;
  pixDiscountCents: number;
  shippingCents: number;
  totalCents: number;
  paymentMethod: PaymentMethodKey;
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";
  changeForCents?: number | null;
  notes?: string | null;
  trackUrl?: string | null;
};

export function buildOrderMessage(o: OrderForMessage): string {
  const L: string[] = [];
  L.push(`🛒 *Novo pedido ${o.storeName} · #${o.code}*`);
  L.push("");
  L.push(`👤 *Cliente:* ${o.customerName}`);
  L.push(`📱 *WhatsApp:* ${formatPhone(o.customerPhone)}`);
  if (o.customerEmail) L.push(`✉️ *E-mail:* ${o.customerEmail}`);
  L.push("");
  L.push("📦 *Itens*");
  for (const it of o.items) {
    const name = it.variantName ? `${it.name} (${it.variantName})` : it.name;
    L.push(`• ${it.quantity}x ${name}`);
    L.push(
      it.quantity > 1
        ? `   ${formatBRL(it.totalCents)} (${formatBRL(it.unitPriceCents)} cada)`
        : `   ${formatBRL(it.totalCents)}`,
    );
  }
  L.push("");
  L.push("💰 *Resumo*");
  L.push(`Subtotal: ${formatBRL(o.subtotalCents)}`);
  if (o.discountCents > 0) L.push(`Cupom${o.couponCode ? ` ${o.couponCode}` : ""}: -${formatBRL(o.discountCents)}`);
  if (o.pixDiscountCents > 0) L.push(`Desconto Pix: -${formatBRL(o.pixDiscountCents)}`);
  if (o.deliveryType === "DELIVERY") {
    const km = o.distanceKm ? ` (${formatKm(o.distanceKm)})` : "";
    L.push(`Frete${km}: ${o.shippingCents > 0 ? formatBRL(o.shippingCents) : "Grátis"}`);
  }
  L.push(`*Total: ${formatBRL(o.totalCents)}*`);
  L.push("");
  if (o.deliveryType === "DELIVERY") {
    L.push(`🛵 *${DELIVERY_TYPE_LABEL.DELIVERY}*`);
    const line1 = [o.street, o.number].filter(Boolean).join(", ") + (o.complement ? ` · ${o.complement}` : "");
    L.push(line1);
    L.push(`${o.neighborhood ?? ""} · ${o.city ?? ""}/${o.state ?? ""}`);
    if (o.cep) L.push(`CEP ${formatCep(o.cep)}`);
    if (o.reference) L.push(`Referência: ${o.reference}`);
  } else {
    L.push(`🏬 *${DELIVERY_TYPE_LABEL.PICKUP}*`);
  }
  L.push("");
  const paid = o.paymentStatus === "PAID" ? " ✅ PAGO" : "";
  L.push(`💳 *Pagamento:* ${PAYMENT_METHOD_SHORT[o.paymentMethod]}${paid}`);
  if (o.paymentMethod === "CASH_ON_DELIVERY") {
    L.push(o.changeForCents && o.changeForCents > o.totalCents ? `Troco para ${formatBRL(o.changeForCents)}` : "Não precisa de troco");
  }
  if (o.paymentMethod === "PIX_MANUAL" && o.paymentStatus !== "PAID") L.push("Vou enviar o comprovante do Pix aqui.");
  if (o.notes) {
    L.push("");
    L.push(`📝 *Observações:* ${o.notes}`);
  }
  if (o.trackUrl) {
    L.push("");
    L.push(`🔗 Acompanhar pedido: ${o.trackUrl}`);
  }
  return L.join("\n");
}

/** Link que abre o WhatsApp com a mensagem pronta. Número só com dígitos, com DDI (55). */
export function whatsappLink(phone: string, text?: string) {
  let digits = onlyDigits(phone);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
