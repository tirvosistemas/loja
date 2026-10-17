import { priceCart, type CartInputItem, type PricedCart, type PricedLine } from "../cart";
import { computeTotals, evaluateCouponCode, type CouponLine, type CouponResult, type Totals } from "../pricing";
import { enabledPaymentMethods, type Settings } from "../settings";
import { cityIsAllowed, quoteShipping, type ShippingQuote } from "../shipping/quote";
import { lookupCep } from "../cep";
import { PIX_METHODS, type PaymentMethodKey } from "../constants";

// Cotação completa do carrinho (itens, cupom, frete e totais). É a mesma conta usada no
// carrinho, no checkout e na criação do pedido: o navegador nunca define preços.

export type QuoteAddress = {
  cep: string;
  number?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
};

export type CartQuoteInput = {
  items: CartInputItem[];
  couponCode?: string | null;
  phone?: string | null;
  address?: QuoteAddress | null;
  deliveryType?: "DELIVERY" | "PICKUP";
  paymentMethod?: PaymentMethodKey | null;
};

export type CartQuote = {
  cart: PricedCart;
  couponCode: string | null;
  coupon: CouponResult | null;
  shipping: ShippingQuote | null;
  totals: Totals;
  methods: PaymentMethodKey[];
};

export function couponLines(lines: PricedLine[]): CouponLine[] {
  return lines.map((l) => ({
    id: l.productId,
    categoryId: l.categoryId,
    brandId: l.brandId,
    unitPriceCents: l.unitPriceCents,
    quantity: l.quantity,
    promoted: l.promoted,
  }));
}

export function hasShippingAddress(a: QuoteAddress | null | undefined): a is QuoteAddress {
  return !!a && a.cep.replace(/\D/g, "").length === 8 && !!a.number?.trim();
}

export async function quoteCart(input: CartQuoteInput, settings: Settings): Promise<CartQuote> {
  const cart = await priceCart(input.items);
  const methods = enabledPaymentMethods(settings);
  const deliveryType = input.deliveryType ?? "DELIVERY";

  const code = input.couponCode?.trim().toUpperCase() || null;
  const coupon = code && cart.lines.length > 0 ? await evaluateCouponCode(code, couponLines(cart.lines), input.phone) : null;
  const couponOk = coupon?.ok ? coupon : null;

  let shipping: ShippingQuote | null = null;
  if (deliveryType === "DELIVERY" && cart.lines.length > 0 && hasShippingAddress(input.address)) {
    const a = input.address;
    shipping = await quoteShipping(
      {
        cep: a.cep,
        number: a.number,
        street: a.street,
        neighborhood: a.neighborhood,
        city: a.city,
        state: a.state,
        subtotalCents: cart.subtotalCents,
        itemCount: cart.itemCount,
        allItemsFreeShipping: cart.allFreeShipping,
        freeShippingCoupon: !!couponOk?.freeShipping,
      },
      settings,
    );
    // A cidade digitada não pode driblar a área de entrega: confere a cidade do CEP.
    if (shipping.ok && shipping.available && settings.shipping.restrictToAllowedCities) {
      const info = await lookupCep(a.cep);
      if (info?.city && !cityIsAllowed(settings.shipping, info.city)) {
        shipping = {
          ...shipping,
          ok: false,
          available: false,
          feeCents: 0,
          free: false,
          freeReason: undefined,
          missingForFreeCents: undefined,
          reason: `Ainda não entregamos em ${info.city}. Atendemos Curitiba e região metropolitana.`,
        };
      }
    }
  }

  const method = input.paymentMethod && methods.includes(input.paymentMethod) ? input.paymentMethod : null;
  const totals = computeTotals({
    subtotalCents: cart.subtotalCents,
    couponDiscountCents: couponOk?.discountCents ?? 0,
    shippingCents: deliveryType === "PICKUP" ? 0 : shipping?.ok && shipping.available ? shipping.feeCents : 0,
    paymentMethod: method,
    pixDiscountPercent: settings.payment.pixDiscountPercent,
  });

  return { cart, couponCode: code, coupon, shipping, totals, methods };
}

// ───────── Resposta pública (vai para o navegador)

export type QuoteLine = Pick<
  PricedLine,
  | "key" | "productId" | "variantId" | "slug" | "name" | "variantName" | "image" | "unitPriceCents"
  | "originalUnitPriceCents" | "compareAtCents" | "quantity" | "requestedQuantity" | "maxQuantity" | "totalCents"
  | "available" | "promoted" | "promotionName" | "freeShipping" | "issue"
>;

export type QuoteCoupon = {
  code: string;
  ok: boolean;
  message: string | null;
  error: string | null;
  discountCents: number;
  freeShipping: boolean;
};

export type QuoteShipping = Pick<
  ShippingQuote,
  | "ok" | "available" | "reason" | "feeCents" | "originalFeeCents" | "free" | "freeReason" | "missingForFreeCents"
  | "distanceKm" | "etaText" | "address"
>;

export type CartQuoteResponse = {
  lines: QuoteLine[];
  unavailable: QuoteLine[];
  issues: string[];
  itemCount: number;
  coupon: QuoteCoupon | null;
  shipping: QuoteShipping | null;
  totals: Totals;
  /** Total se pagar com Pix (null quando nenhum método Pix está ativo). */
  pixTotalCents: number | null;
  paymentMethods: PaymentMethodKey[];
  pixDiscountPercent: number;
};

const toLine = (l: PricedLine): QuoteLine => ({
  key: l.key,
  productId: l.productId,
  variantId: l.variantId,
  slug: l.slug,
  name: l.name,
  variantName: l.variantName,
  image: l.image,
  unitPriceCents: l.unitPriceCents,
  originalUnitPriceCents: l.originalUnitPriceCents,
  compareAtCents: l.compareAtCents,
  quantity: l.quantity,
  requestedQuantity: l.requestedQuantity,
  maxQuantity: l.maxQuantity,
  totalCents: l.totalCents,
  available: l.available,
  promoted: l.promoted,
  promotionName: l.promotionName,
  freeShipping: l.freeShipping,
  issue: l.issue,
});

export function toQuoteResponse(q: CartQuote, settings: Settings): CartQuoteResponse {
  const pixMethod = q.methods.find((m) => PIX_METHODS.includes(m)) ?? null;
  const shippingCents = q.totals.shippingCents;
  const pixTotals =
    pixMethod && settings.payment.pixDiscountPercent > 0
      ? computeTotals({
          subtotalCents: q.totals.subtotalCents,
          couponDiscountCents: q.totals.discountCents,
          shippingCents,
          paymentMethod: pixMethod,
          pixDiscountPercent: settings.payment.pixDiscountPercent,
        })
      : null;
  const s = q.shipping;
  return {
    lines: q.cart.lines.map(toLine),
    unavailable: q.cart.unavailable.map(toLine),
    issues: q.cart.issues,
    itemCount: q.cart.itemCount,
    coupon:
      q.couponCode && q.coupon
        ? {
            code: q.couponCode,
            ok: q.coupon.ok,
            message: q.coupon.ok ? q.coupon.message : null,
            error: q.coupon.ok ? null : q.coupon.error,
            discountCents: q.coupon.ok ? q.coupon.discountCents : 0,
            freeShipping: q.coupon.ok ? q.coupon.freeShipping : false,
          }
        : null,
    shipping: s
      ? {
          ok: s.ok,
          available: s.available,
          reason: s.reason,
          feeCents: s.feeCents,
          originalFeeCents: s.originalFeeCents,
          free: s.free,
          freeReason: s.freeReason,
          missingForFreeCents: s.missingForFreeCents,
          distanceKm: s.distanceKm,
          etaText: s.etaText,
          address: s.address,
        }
      : null,
    totals: q.totals,
    pixTotalCents: pixTotals?.totalCents ?? null,
    paymentMethods: q.methods,
    pixDiscountPercent: settings.payment.pixDiscountPercent,
  };
}
