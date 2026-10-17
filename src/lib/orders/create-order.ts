import { z } from "zod";
import { db } from "../db";
import { isUniqueError, zodFieldErrors } from "../action";
import { formatBRL } from "../format";
import { getSettings } from "../settings";
import { onlyDigits, randomCode } from "../utils";
import { checkoutSchema } from "../validators";
import { buildOrderMessage, whatsappLink } from "../whatsapp";
import { isValidCpf } from "./cpf";
import { reserveStock, OutOfStockError } from "./inventory";
import { trackUrlFor } from "./message";
import { quoteCart } from "./quote";
import { updateOrderStatus } from "./status";
import { createStripeCheckout, STRIPE_MIN_CENTS } from "./stripe-checkout";

// Criação do pedido pelo site. Tudo é recalculado aqui a partir do banco: preços,
// promoções, cupom, frete e total. O estoque e o uso do cupom são baixados numa transação.

export type CreateOrderContext = { ip: string; userAgent: string | null };

export type CreateOrderResult =
  | { ok: true; orderId: string; code: string; whatsappUrl: string | null; stripeUrl: string | null }
  | { ok: false; status: number; error: string; fieldErrors?: Record<string, string>; issues?: string[] };

const extrasSchema = z.object({
  acceptedTerms: z.literal(true, { error: "Para continuar, aceite os Termos de uso e a Política de privacidade." }),
  expectedTotalCents: z.number().int().min(0).max(1_000_000_000).optional(),
});

class CouponUsageError extends Error {}

const invalid = (fieldErrors: Record<string, string>, error = "Confira os campos destacados."): CreateOrderResult => ({
  ok: false,
  status: 422,
  error,
  fieldErrors,
});

export async function createOrder(raw: unknown, ctx: CreateOrderContext): Promise<CreateOrderResult> {
  // 1) Validação dos campos
  const parsed = checkoutSchema.safeParse(raw);
  const extras = extrasSchema.safeParse(raw ?? {});
  const fieldErrors: Record<string, string> = parsed.success ? {} : zodFieldErrors(parsed.error);
  if (!extras.success) {
    for (const [k, v] of Object.entries(zodFieldErrors(extras.error))) if (!fieldErrors[k]) fieldErrors[k] = v;
  }
  const docDigits = parsed.success ? onlyDigits(parsed.data.customer.doc) : "";
  if (docDigits && !isValidCpf(docDigits)) fieldErrors["customer.doc"] = "CPF inválido. Confira os números ou deixe em branco.";
  if (!parsed.success || !extras.success || Object.keys(fieldErrors).length > 0) {
    if (fieldErrors.items) return { ok: false, status: 422, error: fieldErrors.items, fieldErrors };
    return invalid(fieldErrors);
  }
  const data = parsed.data;

  // 2) Regras da loja
  const settings = await getSettings();
  const quote = await quoteCart(
    {
      items: data.items,
      couponCode: data.couponCode,
      phone: data.customer.phone,
      address: data.deliveryType === "DELIVERY" ? data.address : null,
      deliveryType: data.deliveryType,
      paymentMethod: data.paymentMethod,
    },
    settings,
  );

  if (!quote.methods.includes(data.paymentMethod)) {
    return invalid({ paymentMethod: "Essa forma de pagamento não está disponível. Escolha outra." }, "Forma de pagamento indisponível.");
  }
  if (data.deliveryType === "PICKUP" && !settings.address.pickupEnabled) {
    return invalid({ deliveryType: "A retirada na loja está desativada no momento." }, "Escolha a entrega por motoboy.");
  }
  if (data.paymentMethod !== "ONLINE_STRIPE" && !onlyDigits(settings.store.whatsapp)) {
    return { ok: false, status: 503, error: "A loja ainda não configurou o WhatsApp de pedidos." };
  }

  // 3) Itens: estoque e disponibilidade
  const { cart } = quote;
  if (cart.lines.length === 0) {
    return { ok: false, status: 409, error: "Os itens do seu carrinho não estão mais disponíveis.", issues: cart.issues };
  }
  if (cart.unavailable.length > 0 || cart.lines.some((l) => l.quantity < l.requestedQuantity)) {
    return { ok: false, status: 409, error: "Alguns itens do carrinho mudaram. Confira antes de enviar.", issues: cart.issues };
  }

  // 4) Cupom
  const coupon = quote.coupon;
  if (quote.couponCode && coupon && !coupon.ok) return invalid({ couponCode: coupon.error }, coupon.error);
  const couponOk = coupon?.ok ? coupon : null;

  // 5) Frete
  const shipping = quote.shipping;
  if (data.deliveryType === "DELIVERY") {
    if (!shipping || !shipping.ok || !shipping.available) {
      const reason = shipping?.reason || "Não conseguimos calcular a entrega para esse endereço.";
      return invalid({ address: reason }, reason);
    }
  }

  // 6) Totais
  const { totals } = quote;
  if (data.paymentMethod === "ONLINE_STRIPE" && totals.totalCents < STRIPE_MIN_CENTS) {
    return invalid(
      { paymentMethod: `O pagamento online exige um valor mínimo de ${formatBRL(STRIPE_MIN_CENTS)}. Escolha outra forma.` },
      "Escolha outra forma de pagamento.",
    );
  }
  const changeForCents = data.paymentMethod === "CASH_ON_DELIVERY" && data.changeForCents ? data.changeForCents : null;
  if (changeForCents != null && changeForCents < totals.totalCents) {
    return invalid({ changeForCents: `O troco precisa ser para um valor igual ou maior que ${formatBRL(totals.totalCents)}.` });
  }
  const expected = extras.data.expectedTotalCents;
  if (expected != null && expected !== totals.totalCents) {
    return {
      ok: false,
      status: 409,
      error: "O valor do pedido foi atualizado.",
      issues: [`O total agora é ${formatBRL(totals.totalCents)} (antes ${formatBRL(expected)}). Confira o resumo e envie de novo.`],
    };
  }

  // 7) Gravação
  const address = data.deliveryType === "DELIVERY" ? data.address! : null;
  const customerEmail = data.customer.email ? data.customer.email.toLowerCase() : null;
  const notes = data.notes || null;
  const storeName = settings.store.name || "Tirvo";

  let created: { id: string; code: string; whatsappMessage: string } | null = null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    try {
      created = await db.$transaction(
        async (tx) => {
          let code = "";
          for (let i = 0; i < 8 && !code; i++) {
            const candidate = `TV${randomCode(5)}`;
            const taken = await tx.order.findUnique({ where: { code: candidate }, select: { id: true } });
            if (!taken) code = candidate;
          }
          if (!code) throw new Error("Não foi possível gerar o código do pedido.");

          await reserveStock(
            tx,
            cart.lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              quantity: l.quantity,
              name: l.variantName ? `${l.name} (${l.variantName})` : l.name,
            })),
          );

          if (couponOk) {
            const c = await tx.coupon.findUnique({ where: { id: couponOk.coupon.id }, select: { usageLimit: true, active: true } });
            if (!c?.active) throw new CouponUsageError("Este cupom não está mais disponível.");
            const used = await tx.coupon.updateMany({
              where: { id: couponOk.coupon.id, ...(c.usageLimit != null ? { usedCount: { lt: c.usageLimit } } : {}) },
              data: { usedCount: { increment: 1 } },
            });
            if (used.count === 0) throw new CouponUsageError("Este cupom acabou de atingir o limite de usos.");
          }

          const whatsappMessage = buildOrderMessage({
            code,
            storeName,
            customerName: data.customer.name,
            customerPhone: data.customer.phone,
            customerEmail,
            deliveryType: data.deliveryType,
            street: address?.street,
            number: address?.number,
            complement: address?.complement,
            neighborhood: address?.neighborhood,
            city: address?.city,
            state: address?.state,
            cep: address?.cep,
            reference: address?.reference,
            distanceKm: shipping?.distanceKm ?? null,
            items: cart.lines.map((l) => ({
              name: l.name,
              variantName: l.variantName,
              quantity: l.quantity,
              unitPriceCents: l.unitPriceCents,
              totalCents: l.totalCents,
            })),
            subtotalCents: totals.subtotalCents,
            discountCents: totals.discountCents,
            couponCode: couponOk?.coupon.code ?? null,
            pixDiscountCents: totals.pixDiscountCents,
            shippingCents: totals.shippingCents,
            totalCents: totals.totalCents,
            paymentMethod: data.paymentMethod,
            paymentStatus: "PENDING",
            changeForCents,
            notes,
            trackUrl: trackUrlFor(code),
          });

          return tx.order.create({
            data: {
              code,
              customerName: data.customer.name,
              customerPhone: data.customer.phone,
              customerEmail,
              customerDoc: docDigits || null,
              deliveryType: data.deliveryType,
              cep: address?.cep ?? null,
              street: address?.street ?? null,
              number: address?.number ?? null,
              complement: address?.complement || null,
              neighborhood: address?.neighborhood ?? null,
              city: address?.city ?? null,
              state: address?.state ?? null,
              reference: address?.reference || null,
              lat: address ? (shipping?.destination?.lat ?? null) : null,
              lng: address ? (shipping?.destination?.lng ?? null) : null,
              distanceKm: address ? (shipping?.distanceKm ?? null) : null,
              subtotalCents: totals.subtotalCents,
              discountCents: totals.discountCents,
              pixDiscountCents: totals.pixDiscountCents,
              shippingCents: totals.shippingCents,
              totalCents: totals.totalCents,
              couponCode: couponOk?.coupon.code ?? null,
              couponId: couponOk?.coupon.id ?? null,
              paymentMethod: data.paymentMethod,
              changeForCents,
              notes,
              whatsappMessage,
              ip: ctx.ip.slice(0, 64),
              userAgent: ctx.userAgent?.slice(0, 400) ?? null,
              items: {
                create: cart.lines.map((l) => ({
                  productId: l.productId,
                  variantId: l.variantId,
                  name: l.name,
                  variantName: l.variantName,
                  sku: l.sku,
                  image: l.image,
                  unitPriceCents: l.unitPriceCents,
                  originalUnitPriceCents: l.originalUnitPriceCents,
                  quantity: l.quantity,
                  totalCents: l.totalCents,
                })),
              },
              events: { create: { type: "status", status: "NEW", note: "Pedido criado pelo site" } },
            },
            select: { id: true, code: true, whatsappMessage: true },
          });
        },
        { maxWait: 10_000, timeout: 20_000 },
      );
    } catch (e) {
      if (e instanceof OutOfStockError) {
        return { ok: false, status: 409, error: "Um item acabou enquanto você finalizava a compra.", issues: [e.message] };
      }
      if (e instanceof CouponUsageError) return invalid({ couponCode: e.message }, e.message);
      if (isUniqueError(e, "code")) continue; // código repetido em pedidos simultâneos: tenta de novo
      console.error("[pedidos] falha ao criar pedido:", e);
      return { ok: false, status: 500, error: "Não foi possível registrar o pedido. Tente de novo em instantes." };
    }
  }
  if (!created) return { ok: false, status: 500, error: "Não foi possível registrar o pedido. Tente de novo em instantes." };

  // 8) Pagamento online: cria a sessão da Stripe. Se falhar, cancela e devolve o estoque.
  if (data.paymentMethod === "ONLINE_STRIPE") {
    try {
      const session = await createStripeCheckout({
        id: created.id,
        code: created.code,
        customerEmail,
        deliveryType: data.deliveryType,
        distanceKm: shipping?.distanceKm ?? null,
        discountCents: totals.discountCents,
        couponCode: couponOk?.coupon.code ?? null,
        shippingCents: totals.shippingCents,
        totalCents: totals.totalCents,
        items: cart.lines.map((l) => ({
          name: l.name,
          variantName: l.variantName,
          image: l.image,
          unitPriceCents: l.unitPriceCents,
          quantity: l.quantity,
        })),
      });
      await db.order.update({ where: { id: created.id }, data: { stripeSessionId: session.id } });
      return { ok: true, orderId: created.id, code: created.code, whatsappUrl: null, stripeUrl: session.url };
    } catch (e) {
      console.error("[pedidos] falha ao criar sessão da Stripe:", e);
      await updateOrderStatus(created.id, "CANCELED", { note: "Não foi possível iniciar o pagamento online", actor: "sistema" });
      return { ok: false, status: 502, error: "Não foi possível iniciar o pagamento. Tente outra forma de pagamento." };
    }
  }

  return {
    ok: true,
    orderId: created.id,
    code: created.code,
    whatsappUrl: whatsappLink(settings.store.whatsapp, created.whatsappMessage),
    stripeUrl: null,
  };
}
