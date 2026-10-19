import { describe, expect, it } from "vitest";
import { computeShippingFee } from "@/lib/shipping/quote";
import { freeShippingRule, freeShippingSentence } from "@/lib/shipping/free";
import { shippingSchema, type ShippingSettings } from "@/lib/settings";

// Frete por motoboy: taxa de saída + km × preço, mínimo, arredondamento, raio e frete grátis da
// loja (até um raio em km, a partir de um pedido mínimo).

const cfg = (patch: Partial<ShippingSettings> = {}): ShippingSettings => ({
  ...shippingSchema.parse({}),
  baseFeeCents: 500,
  pricePerKmCents: 250,
  minFeeCents: 1000,
  extraPerItemCents: 0,
  roundToCents: 50,
  maxDistanceKm: 60,
  freeShippingEnabled: true,
  freeShippingAboveCents: 99900,
  freeShippingMaxKm: 30,
  ...patch,
});

describe("computeShippingFee", () => {
  it("soma a taxa de saída com o preço por km", () => {
    const r = computeShippingFee(cfg(), { distanceKm: 10, subtotalCents: 10000 });
    expect(r.available).toBe(true);
    expect(r.feeCents).toBe(500 + 10 * 250);
    expect(r.originalFeeCents).toBe(3000);
    expect(r.free).toBe(false);
  });

  it("respeita o valor mínimo", () => {
    expect(computeShippingFee(cfg(), { distanceKm: 1 }).feeCents).toBe(1000);
    expect(computeShippingFee(cfg(), { distanceKm: -3 }).feeCents).toBe(1000);
  });

  it("arredonda para cima no passo configurado", () => {
    // 500 + 7,3 × 250 = 2325 → 2350 (passo de R$ 0,50)
    expect(computeShippingFee(cfg(), { distanceKm: 7.3 }).feeCents).toBe(2350);
    // passo de R$ 1,00 → 2400
    expect(computeShippingFee(cfg({ roundToCents: 100 }), { distanceKm: 7.3 }).feeCents).toBe(2400);
    // sem arredondamento
    expect(computeShippingFee(cfg({ roundToCents: 0 }), { distanceKm: 7.3 }).feeCents).toBe(2325);
  });

  it("usa a distância com uma casa decimal", () => {
    // 7,34 km vira 7,3 km
    expect(computeShippingFee(cfg({ roundToCents: 0 }), { distanceKm: 7.34 }).feeCents).toBe(2325);
  });

  it("cobra adicional por item a partir do segundo", () => {
    const r = computeShippingFee(cfg({ extraPerItemCents: 300 }), { distanceKm: 10, itemCount: 3 });
    expect(r.feeCents).toBe(3000 + 2 * 300);
  });

  it("fica indisponível acima da distância máxima", () => {
    const r = computeShippingFee(cfg(), { distanceKm: 61 });
    expect(r.available).toBe(false);
    expect(r.feeCents).toBe(0);
    expect(r.reason).toContain("60 km");
  });

  it("sem distância máxima (0) entrega em qualquer distância", () => {
    expect(computeShippingFee(cfg({ maxDistanceKm: 0 }), { distanceKm: 200 }).available).toBe(true);
  });

  it("dá frete grátis acima do valor configurado, dentro do raio", () => {
    const r = computeShippingFee(cfg(), { distanceKm: 10, subtotalCents: 100000 });
    expect(r.free).toBe(true);
    expect(r.freeReason).toBe("threshold");
    expect(r.feeCents).toBe(0);
    expect(r.originalFeeCents).toBe(3000);
    expect(r.missingForFreeCents).toBeUndefined();
  });

  it("o valor exato do limite já ganha frete grátis", () => {
    expect(computeShippingFee(cfg(), { distanceKm: 5, subtotalCents: 99900 }).free).toBe(true);
  });

  it("informa quanto falta para o frete grátis", () => {
    const r = computeShippingFee(cfg(), { distanceKm: 10, subtotalCents: 80000 });
    expect(r.free).toBe(false);
    expect(r.missingForFreeCents).toBe(19900);
  });

  it("não dá frete grátis por valor fora do raio limite", () => {
    const r = computeShippingFee(cfg(), { distanceKm: 35, subtotalCents: 150000 });
    expect(r.free).toBe(false);
    expect(r.feeCents).toBe(500 + 35 * 250);
    expect(r.missingForFreeCents).toBeUndefined();
  });

  it("sem raio limite, o frete grátis vale em qualquer distância", () => {
    expect(computeShippingFee(cfg({ freeShippingMaxKm: null }), { distanceKm: 50, subtotalCents: 150000 }).free).toBe(true);
  });

  it("com o frete grátis desligado no painel, nunca é grátis pela regra da loja", () => {
    const r = computeShippingFee(cfg({ freeShippingEnabled: false }), { distanceKm: 5, subtotalCents: 999999 });
    expect(r.free).toBe(false);
    expect(r.missingForFreeCents).toBeUndefined();
  });

  it("até 30 km com pedido mínimo de R$ 20", () => {
    const c = cfg({ freeShippingAboveCents: 2000, freeShippingMaxKm: 30 });
    const short = computeShippingFee(c, { distanceKm: 28, subtotalCents: 1000 });
    expect(short.free).toBe(false);
    expect(short.feeCents).toBe(500 + 28 * 250);
    expect(short.missingForFreeCents).toBe(1000);
    expect(computeShippingFee(c, { distanceKm: 28, subtotalCents: 2000 }).free).toBe(true);
    expect(computeShippingFee(c, { distanceKm: 30, subtotalCents: 2000 }).free).toBe(true);
    const far = computeShippingFee(c, { distanceKm: 30.1, subtotalCents: 50000 });
    expect(far.free).toBe(false);
    expect(far.missingForFreeCents).toBeUndefined();
  });

  it("sem pedido mínimo, qualquer pedido dentro do raio sai grátis", () => {
    const c = cfg({ freeShippingAboveCents: null });
    expect(computeShippingFee(c, { distanceKm: 28, subtotalCents: 1000 }).free).toBe(true);
    expect(computeShippingFee(cfg({ freeShippingAboveCents: 0 }), { distanceKm: 28, subtotalCents: 1000 }).free).toBe(true);
    expect(computeShippingFee(c, { distanceKm: 31, subtotalCents: 1000 }).free).toBe(false);
  });

  it("cupom de frete grátis vale mesmo fora do raio", () => {
    const r = computeShippingFee(cfg(), { distanceKm: 40, subtotalCents: 1000, freeShippingCoupon: true });
    expect(r.free).toBe(true);
    expect(r.freeReason).toBe("coupon");
    expect(r.feeCents).toBe(0);
    expect(r.originalFeeCents).toBe(500 + 40 * 250);
  });

  it("produtos com frete grátis zeram o frete", () => {
    const r = computeShippingFee(cfg(), { distanceKm: 12, subtotalCents: 1000, allItemsFreeShipping: true });
    expect(r.free).toBe(true);
    expect(r.freeReason).toBe("product");
  });

  it("a distância máxima vale mesmo com cupom de frete grátis", () => {
    expect(computeShippingFee(cfg(), { distanceKm: 70, freeShippingCoupon: true }).available).toBe(false);
  });
});

describe("frete grátis da loja (regra e textos)", () => {
  const rule = (patch: Partial<ShippingSettings> = {}) => freeShippingRule(cfg(patch));

  it("só vale com o frete grátis e a entrega ligados", () => {
    expect(rule({ freeShippingEnabled: false })).toBeNull();
    expect(rule({ enabled: false })).toBeNull();
    expect(rule({ freeShippingAboveCents: 2000, freeShippingMaxKm: 30 })).toEqual({ minCents: 2000, maxKm: 30 });
    expect(rule({ freeShippingAboveCents: null, freeShippingMaxKm: null })).toEqual({ minCents: 0, maxKm: null });
  });

  it("monta o texto com o raio e o pedido mínimo configurados", () => {
    expect(freeShippingSentence({ minCents: 2000, maxKm: 30 })).toBe("Frete grátis até 30 km da loja, com pedido mínimo de R$ 20.");
    expect(freeShippingSentence({ minCents: 2990, maxKm: 7.5 })).toBe("Frete grátis até 7,5 km da loja, com pedido mínimo de R$ 29,90.");
    expect(freeShippingSentence({ minCents: 0, maxKm: null })).toBe("Frete grátis em toda a área de entrega.");
  });
});
