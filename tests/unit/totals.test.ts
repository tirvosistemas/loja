import { describe, expect, it } from "vitest";
import { computeTotals } from "@/lib/pricing";

// Total do pedido: subtotal − cupom − Pix (só nos métodos Pix) + frete.

describe("computeTotals", () => {
  const base = { subtotalCents: 10000, couponDiscountCents: 1000, shippingCents: 1500, pixDiscountPercent: 5 };

  it("aplica o desconto do Pix sobre o valor já com cupom", () => {
    const t = computeTotals({ ...base, paymentMethod: "PIX_MANUAL" });
    expect(t).toEqual({ subtotalCents: 10000, discountCents: 1000, pixDiscountCents: 450, shippingCents: 1500, totalCents: 10050 });
  });

  it("Pix na entrega também tem o desconto", () => {
    expect(computeTotals({ ...base, paymentMethod: "PIX_ON_DELIVERY" }).pixDiscountCents).toBe(450);
  });

  it("cartão, dinheiro e pagamento online não têm desconto do Pix", () => {
    for (const m of ["CARD_ON_DELIVERY", "CASH_ON_DELIVERY", "ONLINE_STRIPE"] as const) {
      const t = computeTotals({ ...base, paymentMethod: m });
      expect(t.pixDiscountCents).toBe(0);
      expect(t.totalCents).toBe(10500);
    }
  });

  it("sem forma de pagamento escolhida não aplica o Pix", () => {
    expect(computeTotals({ ...base, paymentMethod: null }).pixDiscountCents).toBe(0);
  });

  it("o frete não recebe desconto do Pix", () => {
    const t = computeTotals({ subtotalCents: 10000, shippingCents: 5000, paymentMethod: "PIX_MANUAL", pixDiscountPercent: 10 });
    expect(t.pixDiscountCents).toBe(1000);
    expect(t.totalCents).toBe(14000);
  });

  it("o cupom nunca passa do subtotal e o frete nunca é negativo", () => {
    const t = computeTotals({ subtotalCents: 5000, couponDiscountCents: 9000, shippingCents: -100 });
    expect(t.discountCents).toBe(5000);
    expect(t.shippingCents).toBe(0);
    expect(t.totalCents).toBe(0);
  });

  it("arredonda o desconto do Pix para o centavo mais próximo", () => {
    expect(computeTotals({ subtotalCents: 999, paymentMethod: "PIX_MANUAL", pixDiscountPercent: 5 }).pixDiscountCents).toBe(50);
  });
});
