import { describe, expect, it } from "vitest";
import { isValidCpf } from "@/lib/orders/cpf";
import { maskPhone as maskPublicPhone, normalizeOrderCode } from "@/lib/orders/public-order";
import { maskCpf, maskPhone } from "@/components/store/checkout/masks";

// Utilitários do checkout e da página pública do pedido.

describe("isValidCpf", () => {
  it("aceita CPF com dígitos verificadores corretos", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });
  it("recusa dígitos errados, repetidos ou tamanho errado", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("1234567890")).toBe(false);
  });
});

describe("máscaras do checkout", () => {
  it("formata o WhatsApp enquanto digita", () => {
    expect(maskPhone("4")).toBe("(4");
    expect(maskPhone("4199")).toBe("(41) 99");
    expect(maskPhone("4133334444")).toBe("(41) 3333-4444");
    expect(maskPhone("41999998888")).toBe("(41) 99999-8888");
    expect(maskPhone("5541999998888")).toBe("(41) 99999-8888");
  });
  it("formata o CPF", () => {
    expect(maskCpf("529")).toBe("529");
    expect(maskCpf("5299822")).toBe("529.982.2");
    expect(maskCpf("52998224725")).toBe("529.982.247-25");
  });
});

describe("página pública do pedido", () => {
  it("esconde o telefone do cliente", () => {
    expect(maskPublicPhone("41999998888")).toBe("(41) 9••••-8888");
    expect(maskPublicPhone("5541999998888")).toBe("(41) 9••••-8888");
    expect(maskPublicPhone("123")).toBe("••••");
  });
  it("normaliza o código vindo da URL", () => {
    expect(normalizeOrderCode("tv7k2q9")).toBe("TV7K2Q9");
    expect(normalizeOrderCode("%23TV7K2Q9")).toBe("TV7K2Q9");
    expect(normalizeOrderCode("TV-7K2 Q9")).toBe("TV7K2Q9");
  });
});
