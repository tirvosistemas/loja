import { describe, expect, it } from "vitest";
import { evaluateCoupon, type CouponLine } from "@/lib/pricing";

// Regras do cupom: datas, limites, mínimo, escopo, promoções, teto e frete grátis.

type Rule = Parameters<typeof evaluateCoupon>[0];

const NOW = new Date("2026-10-17T12:00:00-03:00");

const coupon = (patch: Partial<Rule> = {}): Rule => ({
  id: "cp1",
  code: "DEZ",
  type: "PERCENT",
  value: 10,
  description: null,
  minSubtotalCents: null,
  maxDiscountCents: null,
  usageLimit: null,
  usedCount: 0,
  perCustomerLimit: null,
  firstOrderOnly: false,
  stackWithPromotions: true,
  scope: "ALL",
  active: true,
  startsAt: null,
  endsAt: null,
  categoryIds: null,
  brandIds: null,
  productIds: null,
  ...patch,
});

// subtotal 25.000: p1 (2 × 100,00, sem promoção) + p2 (1 × 50,00, em promoção)
const lines: CouponLine[] = [
  { id: "p1", categoryId: "c1", brandId: "b1", unitPriceCents: 10000, quantity: 2, promoted: false },
  { id: "p2", categoryId: "c2", brandId: "b2", unitPriceCents: 5000, quantity: 1, promoted: true },
];

const run = (patch: Partial<Rule> = {}, ctx: Parameters<typeof evaluateCoupon>[2] = {}) => evaluateCoupon(coupon(patch), lines, { now: NOW, ...ctx });

function ok(r: ReturnType<typeof evaluateCoupon>) {
  if (!r.ok) throw new Error(`esperava cupom válido, veio: ${r.error}`);
  return r;
}
function err(r: ReturnType<typeof evaluateCoupon>) {
  if (r.ok) throw new Error("esperava cupom recusado");
  return r.error;
}

describe("evaluateCoupon", () => {
  it("aplica porcentagem sobre o subtotal", () => {
    const r = ok(run());
    expect(r.discountCents).toBe(2500);
    expect(r.freeShipping).toBe(false);
    expect(r.message).toContain("10%");
    expect(r.coupon.code).toBe("DEZ");
  });

  it("recusa cupom inativo", () => {
    expect(err(run({ active: false }))).toMatch(/não está ativo/);
  });

  it("respeita início e fim da validade", () => {
    expect(err(run({ startsAt: new Date("2026-10-18T00:00:00-03:00") }))).toMatch(/ainda não começou/);
    expect(err(run({ endsAt: new Date("2026-10-16T23:59:00-03:00") }))).toMatch(/expirou/);
    expect(err(run({ endsAt: NOW }))).toMatch(/expirou/);
    expect(ok(run({ startsAt: new Date("2026-10-01"), endsAt: new Date("2026-11-01") })).discountCents).toBe(2500);
  });

  it("respeita o limite total de usos", () => {
    expect(err(run({ usageLimit: 5, usedCount: 5 }))).toMatch(/limite de usos/);
    expect(ok(run({ usageLimit: 5, usedCount: 4 })).discountCents).toBe(2500);
  });

  it("respeita o limite por cliente e a primeira compra", () => {
    expect(err(run({ perCustomerLimit: 1 }, { usesByCustomer: 1 }))).toMatch(/máximo de vezes/);
    expect(ok(run({ perCustomerLimit: 1 }, { usesByCustomer: 0 })).ok).toBe(true);
    expect(err(run({ firstOrderOnly: true }, { customerOrders: 2 }))).toMatch(/primeira compra/);
    expect(ok(run({ firstOrderOnly: true }, { customerOrders: 0 })).ok).toBe(true);
  });

  it("exige o subtotal mínimo", () => {
    expect(err(run({ minSubtotalCents: 30000 }))).toMatch(/300,00/);
    expect(ok(run({ minSubtotalCents: 25000 })).discountCents).toBe(2500);
  });

  it("aplica só nos itens do escopo", () => {
    expect(ok(run({ scope: "CATEGORY", categoryIds: ["c1"] })).discountCents).toBe(2000);
    expect(ok(run({ scope: "BRAND", brandIds: ["b2"] })).discountCents).toBe(500);
    expect(ok(run({ scope: "PRODUCTS", productIds: ["p2"] })).discountCents).toBe(500);
    expect(err(run({ scope: "PRODUCTS", productIds: ["p9"] }))).toMatch(/Nenhum produto/);
  });

  it("sem acumular com promoções, ignora itens em promoção", () => {
    expect(ok(run({ stackWithPromotions: false })).discountCents).toBe(2000);
    expect(err(run({ stackWithPromotions: false, scope: "BRAND", brandIds: ["b2"] }))).toMatch(/Nenhum produto/);
  });

  it("limita a porcentagem pelo desconto máximo", () => {
    expect(ok(run({ value: 50, maxDiscountCents: 3000 })).discountCents).toBe(3000);
    expect(ok(run({ value: 5, maxDiscountCents: 3000 })).discountCents).toBe(1250);
  });

  it("arredonda a porcentagem para baixo", () => {
    const r = evaluateCoupon(coupon({ value: 7 }), [{ ...lines[0], unitPriceCents: 999, quantity: 1 }], { now: NOW });
    expect(ok(r).discountCents).toBe(69);
  });

  it("valor fixo fica limitado ao subtotal dos itens elegíveis", () => {
    expect(ok(run({ type: "FIXED", value: 1500 })).discountCents).toBe(1500);
    expect(ok(run({ type: "FIXED", value: 30000, scope: "CATEGORY", categoryIds: ["c1"] })).discountCents).toBe(20000);
    expect(ok(run({ type: "FIXED", value: 99999 })).discountCents).toBe(25000);
  });

  it("valor fixo também respeita o desconto máximo", () => {
    expect(ok(run({ type: "FIXED", value: 5000, maxDiscountCents: 4000 })).discountCents).toBe(4000);
  });

  it("cupom de frete grátis não dá desconto nos produtos", () => {
    const r = ok(run({ type: "FREE_SHIPPING", value: 0 }));
    expect(r.freeShipping).toBe(true);
    expect(r.discountCents).toBe(0);
  });

  it("cupom de frete grátis respeita o escopo e a regra de promoções", () => {
    expect(ok(run({ type: "FREE_SHIPPING", scope: "BRAND", brandIds: ["b1"] })).freeShipping).toBe(true);
    expect(err(run({ type: "FREE_SHIPPING", scope: "BRAND", brandIds: ["b9"] }))).toMatch(/Nenhum produto/);
    expect(err(run({ type: "FREE_SHIPPING", scope: "PRODUCTS", productIds: ["p2"], stackWithPromotions: false }))).toMatch(/Nenhum produto/);
  });

  it("cupom de frete grátis também exige o mínimo", () => {
    expect(err(run({ type: "FREE_SHIPPING", minSubtotalCents: 50000 }))).toMatch(/500,00/);
  });
});
