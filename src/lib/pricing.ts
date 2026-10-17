import { cache } from "react";
import type { Coupon, DiscountScope, DiscountType } from "@prisma/client";
import { db } from "./db";
import { PIX_METHODS, type PaymentMethodKey } from "./constants";
import { jsonIds } from "./utils";

// Regras de preço: promoções automáticas (mudam o preço exibido), cupons (no carrinho)
// e o total do pedido. As funções puras daqui são as mesmas usadas na vitrine, no
// carrinho e na criação do pedido no servidor.

export type PromoLite = {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  scope: DiscountScope;
  flash: boolean;
  badge: string | null;
  priority: number;
  endsAt: Date | null;
  categoryIds: string[];
  brandIds: string[];
  productIds: string[];
};

export type PromoInfo = { id: string; name: string; badge: string | null; flash: boolean; endsAt: string | null };

export type PriceTarget = { id: string; categoryId: string | null; brandId: string | null };

async function loadActivePromotions(): Promise<PromoLite[]> {
  const now = new Date();
  const rows = await db.promotion.findMany({
    where: {
      active: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    value: p.value,
    scope: p.scope,
    flash: p.flash,
    badge: p.badge,
    priority: p.priority,
    endsAt: p.endsAt,
    categoryIds: jsonIds(p.categoryIds),
    brandIds: jsonIds(p.brandIds),
    productIds: jsonIds(p.productIds),
  }));
}

/** Promoções ativas agora (uma consulta por requisição). */
export const getActivePromotions = cache(loadActivePromotions);

export function scopeMatches(
  scope: DiscountScope,
  ids: { categoryIds: string[]; brandIds: string[]; productIds: string[] },
  target: PriceTarget,
) {
  switch (scope) {
    case "ALL":
      return true;
    case "CATEGORY":
      return !!target.categoryId && ids.categoryIds.includes(target.categoryId);
    case "BRAND":
      return !!target.brandId && ids.brandIds.includes(target.brandId);
    case "PRODUCTS":
      return ids.productIds.includes(target.id);
  }
}

export function applyDiscount(baseCents: number, type: DiscountType, value: number) {
  if (type === "PERCENT") return Math.max(0, Math.round((baseCents * (100 - Math.min(100, Math.max(0, value)))) / 100));
  return Math.max(0, baseCents - Math.max(0, value));
}

export type EffectivePrice = {
  priceCents: number; // o que o cliente paga
  basePriceCents: number; // preço cadastrado, antes da promoção
  compareAtCents: number | null; // "de" riscado (só quando maior que o preço final)
  discountPercent: number;
  promotion: PromoInfo | null;
};

/**
 * Preço final de um produto (ou variação). Entre as promoções que valem para ele,
 * usa a que dá o menor preço.
 */
export function effectivePrice(
  product: PriceTarget & { priceCents: number; compareAtCents: number | null },
  variant: { priceCents: number | null; compareAtCents: number | null } | null,
  promos: PromoLite[],
): EffectivePrice {
  const base = variant?.priceCents ?? product.priceCents;
  const listCompare = variant?.compareAtCents ?? product.compareAtCents;
  let best: PromoLite | null = null;
  let final = base;
  for (const p of promos) {
    if (!scopeMatches(p.scope, p, product)) continue;
    const price = applyDiscount(base, p.type, p.value);
    if (price < final || (best && price === final && p.priority > best.priority)) {
      final = price;
      best = p;
    }
  }
  const reference = Math.max(listCompare ?? 0, best ? base : 0);
  const compareAt = reference > final ? reference : null;
  return {
    priceCents: final,
    basePriceCents: base,
    compareAtCents: compareAt,
    discountPercent: compareAt ? Math.round((1 - final / compareAt) * 100) : 0,
    promotion: best
      ? { id: best.id, name: best.name, badge: best.badge, flash: best.flash, endsAt: best.endsAt?.toISOString() ?? null }
      : null,
  };
}

export function pixPrice(priceCents: number, pixDiscountPercent: number) {
  return pixDiscountPercent > 0 ? Math.round((priceCents * (100 - pixDiscountPercent)) / 100) : priceCents;
}

// ───────── Cupons

export type CouponLine = PriceTarget & { unitPriceCents: number; quantity: number; promoted: boolean };

export type CouponResult =
  | {
      ok: true;
      coupon: { id: string; code: string; type: Coupon["type"]; description: string | null };
      discountCents: number;
      freeShipping: boolean;
      message: string;
    }
  | { ok: false; error: string };

type CouponRule = Pick<
  Coupon,
  | "id" | "code" | "type" | "value" | "description" | "minSubtotalCents" | "maxDiscountCents" | "usageLimit"
  | "usedCount" | "perCustomerLimit" | "firstOrderOnly" | "stackWithPromotions" | "scope" | "active" | "startsAt" | "endsAt"
> & { categoryIds: unknown; brandIds: unknown; productIds: unknown };

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Regra pura do cupom. `usesByCustomer` e `customerOrders` vêm do banco quando há telefone. */
export function evaluateCoupon(
  coupon: CouponRule,
  lines: CouponLine[],
  ctx: { now?: Date; usesByCustomer?: number; customerOrders?: number } = {},
): CouponResult {
  const now = ctx.now ?? new Date();
  if (!coupon.active) return { ok: false, error: "Este cupom não está ativo." };
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, error: "Este cupom ainda não começou a valer." };
  if (coupon.endsAt && coupon.endsAt <= now) return { ok: false, error: "Este cupom expirou." };
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return { ok: false, error: "Este cupom já atingiu o limite de usos." };
  if (coupon.perCustomerLimit != null && (ctx.usesByCustomer ?? 0) >= coupon.perCustomerLimit)
    return { ok: false, error: "Você já usou este cupom o máximo de vezes permitido." };
  if (coupon.firstOrderOnly && (ctx.customerOrders ?? 0) > 0) return { ok: false, error: "Este cupom vale só para a primeira compra." };

  const subtotal = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  if (coupon.minSubtotalCents != null && subtotal < coupon.minSubtotalCents)
    return { ok: false, error: `Este cupom vale para compras a partir de ${brl(coupon.minSubtotalCents)}.` };

  const ids = { categoryIds: jsonIds(coupon.categoryIds), brandIds: jsonIds(coupon.brandIds), productIds: jsonIds(coupon.productIds) };
  const eligible = lines.filter((l) => scopeMatches(coupon.scope, ids, l) && (coupon.stackWithPromotions || !l.promoted));
  const eligibleSubtotal = eligible.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const info = { id: coupon.id, code: coupon.code, type: coupon.type, description: coupon.description };

  // O escopo (e a regra de promoções) vale também para o cupom de frete grátis.
  if (eligible.length === 0 || eligibleSubtotal <= 0) return { ok: false, error: "Nenhum produto do carrinho vale para este cupom." };
  if (coupon.type === "FREE_SHIPPING") {
    return { ok: true, coupon: info, discountCents: 0, freeShipping: true, message: "Frete grátis aplicado." };
  }

  let discount = coupon.type === "PERCENT" ? Math.floor((eligibleSubtotal * coupon.value) / 100) : Math.min(coupon.value, eligibleSubtotal);
  if (coupon.maxDiscountCents != null) discount = Math.min(discount, coupon.maxDiscountCents);
  discount = Math.max(0, Math.min(discount, subtotal));
  const message =
    coupon.type === "PERCENT" ? `${coupon.value}% de desconto aplicado.` : `${brl(discount)} de desconto aplicado.`;
  return { ok: true, coupon: info, discountCents: discount, freeShipping: false, message };
}

/** Busca o cupom pelo código e aplica as regras, consultando o histórico do telefone. */
export async function evaluateCouponCode(code: string, lines: CouponLine[], phone?: string | null): Promise<CouponResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ok: false, error: "Digite o código do cupom." };
  const coupon = await db.coupon.findUnique({ where: { code: normalized } });
  if (!coupon) return { ok: false, error: "Cupom não encontrado." };
  let usesByCustomer = 0;
  let customerOrders = 0;
  if (phone && (coupon.perCustomerLimit != null || coupon.firstOrderOnly)) {
    [usesByCustomer, customerOrders] = await Promise.all([
      db.order.count({ where: { customerPhone: phone, couponId: coupon.id, status: { not: "CANCELED" } } }),
      db.order.count({ where: { customerPhone: phone, status: { not: "CANCELED" } } }),
    ]);
  }
  return evaluateCoupon(coupon, lines, { usesByCustomer, customerOrders });
}

// ───────── Total do pedido

export type Totals = {
  subtotalCents: number;
  discountCents: number;
  pixDiscountCents: number;
  shippingCents: number;
  totalCents: number;
};

export function computeTotals(input: {
  subtotalCents: number;
  couponDiscountCents?: number;
  shippingCents?: number;
  paymentMethod?: PaymentMethodKey | null;
  pixDiscountPercent?: number;
}): Totals {
  const subtotal = Math.max(0, input.subtotalCents);
  const discount = Math.min(subtotal, Math.max(0, input.couponDiscountCents ?? 0));
  const pct = input.paymentMethod && PIX_METHODS.includes(input.paymentMethod) ? input.pixDiscountPercent ?? 0 : 0;
  const pixDiscount = pct > 0 ? Math.round(((subtotal - discount) * pct) / 100) : 0;
  const shipping = Math.max(0, input.shippingCents ?? 0);
  return {
    subtotalCents: subtotal,
    discountCents: discount,
    pixDiscountCents: pixDiscount,
    shippingCents: shipping,
    totalCents: Math.max(0, subtotal - discount - pixDiscount) + shipping,
  };
}
