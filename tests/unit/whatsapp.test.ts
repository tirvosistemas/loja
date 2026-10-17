import { describe, expect, it } from "vitest";
import { formatBRL } from "@/lib/format";
import { buildOrderMessage, whatsappLink, type OrderForMessage } from "@/lib/whatsapp";

// Mensagem organizada que chega no WhatsApp da loja e o link wa.me.

const order = (patch: Partial<OrderForMessage> = {}): OrderForMessage => ({
  code: "TVABC12",
  storeName: "Tirvo",
  customerName: "Maria Souza",
  customerPhone: "41999998888",
  customerEmail: null,
  deliveryType: "DELIVERY",
  street: "Rua XV de Novembro",
  number: "1000",
  complement: "Apto 12",
  neighborhood: "Centro",
  city: "Curitiba",
  state: "PR",
  cep: "80020310",
  reference: "Em frente à praça",
  distanceKm: 4.2,
  items: [
    { name: "Geladeira Frost Free", variantName: "220V", quantity: 2, unitPriceCents: 300000, totalCents: 600000 },
    { name: "Air Fryer 4L", variantName: null, quantity: 1, unitPriceCents: 39990, totalCents: 39990 },
  ],
  subtotalCents: 639990,
  discountCents: 10000,
  couponCode: "BEMVINDO",
  pixDiscountCents: 0,
  shippingCents: 1500,
  totalCents: 631490,
  paymentMethod: "CASH_ON_DELIVERY",
  paymentStatus: "PENDING",
  changeForCents: 650000,
  notes: "Entregar depois das 14h",
  trackUrl: "https://tirvo.com.br/pedido/TVABC12",
  ...patch,
});

describe("buildOrderMessage", () => {
  const msg = buildOrderMessage(order());

  it("traz o código do pedido e o cliente", () => {
    expect(msg).toContain("#TVABC12");
    expect(msg).toContain("Maria Souza");
    expect(msg).toContain("(41) 99999-8888");
  });

  it("lista os itens com variação, quantidade e valores", () => {
    expect(msg).toContain("2x Geladeira Frost Free (220V)");
    expect(msg).toContain(`${formatBRL(600000)} (${formatBRL(300000)} cada)`);
    expect(msg).toContain("1x Air Fryer 4L");
  });

  it("traz o resumo com cupom, frete e total", () => {
    expect(msg).toContain(`Subtotal: ${formatBRL(639990)}`);
    expect(msg).toContain(`Cupom BEMVINDO: -${formatBRL(10000)}`);
    expect(msg).toContain(`Frete (4,2 km): ${formatBRL(1500)}`);
    expect(msg).toContain(`*Total: ${formatBRL(631490)}*`);
  });

  it("traz o endereço completo", () => {
    expect(msg).toContain("Rua XV de Novembro, 1000 · Apto 12");
    expect(msg).toContain("Centro · Curitiba/PR");
    expect(msg).toContain("CEP 80020-310");
    expect(msg).toContain("Referência: Em frente à praça");
  });

  it("informa o troco no dinheiro", () => {
    expect(msg).toContain(`Troco para ${formatBRL(650000)}`);
    expect(buildOrderMessage(order({ changeForCents: null }))).toContain("Não precisa de troco");
  });

  it("traz observações e o link para acompanhar", () => {
    expect(msg).toContain("Entregar depois das 14h");
    expect(msg).toContain("https://tirvo.com.br/pedido/TVABC12");
  });

  it("frete grátis aparece como Grátis", () => {
    expect(buildOrderMessage(order({ shippingCents: 0 }))).toContain("Frete (4,2 km): Grátis");
  });

  it("retirada na loja não tem frete nem endereço do cliente", () => {
    const m = buildOrderMessage(order({ deliveryType: "PICKUP", street: null, number: null, neighborhood: null, city: null, cep: null, reference: null }));
    expect(m).toContain("Retirar na loja");
    expect(m).not.toContain("Frete");
    expect(m).not.toContain("CEP");
  });

  it("marca o pedido pago e pede comprovante no Pix pendente", () => {
    expect(buildOrderMessage(order({ paymentMethod: "ONLINE_STRIPE", paymentStatus: "PAID" }))).toContain("✅ PAGO");
    const pix = buildOrderMessage(order({ paymentMethod: "PIX_MANUAL", pixDiscountCents: 3000 }));
    expect(pix).toContain("comprovante");
    expect(pix).toContain(`Desconto Pix: -${formatBRL(3000)}`);
    expect(pix).not.toContain("✅ PAGO");
  });
});

describe("whatsappLink", () => {
  it("adiciona o 55 em números com DDD", () => {
    expect(whatsappLink("41999998888")).toBe("https://wa.me/5541999998888");
    expect(whatsappLink("(41) 3333-4444")).toBe("https://wa.me/554133334444");
  });

  it("mantém números que já têm o 55", () => {
    expect(whatsappLink("+55 41 99999-8888")).toBe("https://wa.me/5541999998888");
  });

  it("codifica o texto da mensagem", () => {
    const url = whatsappLink("41999998888", "Olá! Pedido #TV1 & cia\nLinha 2");
    expect(url).toBe("https://wa.me/5541999998888?text=Ol%C3%A1!%20Pedido%20%23TV1%20%26%20cia%0ALinha%202");
    expect(decodeURIComponent(url.split("?text=")[1])).toBe("Olá! Pedido #TV1 & cia\nLinha 2");
  });
});
