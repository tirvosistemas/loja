import { describe, expect, it } from "vitest";
import { applyDiscount, effectivePrice, pixPrice, scopeMatches, type PromoLite } from "@/lib/pricing";

// Promoções automáticas: a que dá o menor preço vence; "de" riscado só quando faz sentido.

const product = { id: "p1", categoryId: "c1", brandId: "b1", priceCents: 10000, compareAtCents: null as number | null };

const promo = (patch: Partial<PromoLite>): PromoLite => ({
  id: "promo",
  name: "Promoção",
  type: "PERCENT",
  value: 10,
  scope: "ALL",
  flash: false,
  badge: null,
  priority: 0,
  endsAt: null,
  categoryIds: [],
  brandIds: [],
  productIds: [],
  ...patch,
});

describe("applyDiscount", () => {
  it("aplica porcentagem com arredondamento", () => {
    expect(applyDiscount(10000, "PERCENT", 15)).toBe(8500);
    expect(applyDiscount(999, "PERCENT", 15)).toBe(849);
  });
  it("limita a porcentagem entre 0 e 100", () => {
    expect(applyDiscount(10000, "PERCENT", 150)).toBe(0);
    expect(applyDiscount(10000, "PERCENT", -5)).toBe(10000);
  });
  it("aplica valor fixo sem ficar negativo", () => {
    expect(applyDiscount(10000, "FIXED", 2500)).toBe(7500);
    expect(applyDiscount(10000, "FIXED", 20000)).toBe(0);
  });
});

describe("scopeMatches", () => {
  const ids = { categoryIds: ["c1"], brandIds: ["b9"], productIds: ["p7"] };
  it("confere cada escopo", () => {
    expect(scopeMatches("ALL", ids, product)).toBe(true);
    expect(scopeMatches("CATEGORY", ids, product)).toBe(true);
    expect(scopeMatches("BRAND", ids, product)).toBe(false);
    expect(scopeMatches("PRODUCTS", ids, product)).toBe(false);
    expect(scopeMatches("PRODUCTS", ids, { ...product, id: "p7" })).toBe(true);
    expect(scopeMatches("CATEGORY", ids, { ...product, categoryId: null })).toBe(false);
  });
});

describe("effectivePrice", () => {
  it("sem promoção usa o preço cadastrado", () => {
    const r = effectivePrice(product, null, []);
    expect(r.priceCents).toBe(10000);
    expect(r.compareAtCents).toBeNull();
    expect(r.discountPercent).toBe(0);
    expect(r.promotion).toBeNull();
  });

  it("entre várias promoções, vence a de menor preço", () => {
    const r = effectivePrice(product, null, [
      promo({ id: "a", name: "Dez por cento", value: 10 }),
      promo({ id: "b", name: "Fixo da categoria", type: "FIXED", value: 1500, scope: "CATEGORY", categoryIds: ["c1"] }),
      promo({ id: "c", name: "Outra marca", value: 50, scope: "BRAND", brandIds: ["b2"] }),
    ]);
    expect(r.priceCents).toBe(8500);
    expect(r.promotion?.id).toBe("b");
    expect(r.basePriceCents).toBe(10000);
    expect(r.compareAtCents).toBe(10000);
    expect(r.discountPercent).toBe(15);
  });

  it("no empate de preço, vence a de maior prioridade", () => {
    const r = effectivePrice(product, null, [promo({ id: "low", priority: 0 }), promo({ id: "high", priority: 5 })]);
    expect(r.priceCents).toBe(9000);
    expect(r.promotion?.id).toBe("high");
  });

  it("promoção por produto só vale para os produtos escolhidos", () => {
    const promos = [promo({ scope: "PRODUCTS", productIds: ["p2"], value: 30 })];
    expect(effectivePrice(product, null, promos).priceCents).toBe(10000);
    expect(effectivePrice({ ...product, id: "p2" }, null, promos).priceCents).toBe(7000);
  });

  it("mostra o preço 'de' cadastrado quando é maior que o preço final", () => {
    const r = effectivePrice({ ...product, compareAtCents: 12000 }, null, []);
    expect(r.priceCents).toBe(10000);
    expect(r.compareAtCents).toBe(12000);
    expect(r.discountPercent).toBe(17);
  });

  it("ignora preço 'de' menor ou igual ao preço", () => {
    expect(effectivePrice({ ...product, compareAtCents: 9000 }, null, []).compareAtCents).toBeNull();
    expect(effectivePrice({ ...product, compareAtCents: 10000 }, null, []).compareAtCents).toBeNull();
  });

  it("com promoção, o 'de' é o maior entre o preço cadastrado e o preço 'de'", () => {
    const r = effectivePrice({ ...product, compareAtCents: 13000 }, null, [promo({ value: 20 })]);
    expect(r.priceCents).toBe(8000);
    expect(r.compareAtCents).toBe(13000);
  });

  it("variação com preço próprio usa esse preço e herda o 'de' do produto", () => {
    const r = effectivePrice({ ...product, compareAtCents: 15000 }, { priceCents: 11000, compareAtCents: null }, []);
    expect(r.priceCents).toBe(11000);
    expect(r.basePriceCents).toBe(11000);
    expect(r.compareAtCents).toBe(15000);
  });

  it("variação sem preço usa o preço do produto", () => {
    expect(effectivePrice(product, { priceCents: null, compareAtCents: null }, [promo({ value: 10 })]).priceCents).toBe(9000);
  });
});

describe("pixPrice", () => {
  it("aplica o desconto do Pix", () => {
    expect(pixPrice(10000, 5)).toBe(9500);
    expect(pixPrice(10000, 0)).toBe(10000);
  });
});
