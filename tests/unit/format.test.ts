import { describe, expect, it } from "vitest";
import { formatBRL, formatKm, parseBRL } from "@/lib/format";

// Valores em reais digitados (pt-BR) viram centavos inteiros.

describe("parseBRL", () => {
  it("entende vírgula decimal e ponto de milhar", () => {
    expect(parseBRL("1.299,90")).toBe(129990);
    expect(parseBRL("R$ 1.299,90")).toBe(129990);
    expect(parseBRL("0,5")).toBe(50);
  });

  it("ponto seguido de três dígitos é milhar", () => {
    expect(parseBRL("1.299")).toBe(129900);
    expect(parseBRL("R$ 1.299.900")).toBe(129990000);
  });

  it("ponto com um ou dois dígitos é decimal", () => {
    expect(parseBRL("1299.90")).toBe(129990);
    expect(parseBRL("12.5")).toBe(1250);
  });

  it("números e entradas vazias", () => {
    expect(parseBRL(12.34)).toBe(1234);
    expect(parseBRL("")).toBeNull();
    expect(parseBRL(null)).toBeNull();
    expect(parseBRL("R$")).toBeNull();
    expect(parseBRL("abc")).toBeNull();
  });
});

describe("formatação", () => {
  it("formata reais a partir de centavos", () => {
    expect(formatBRL(129990)).toBe("R$ 1.299,90");
    expect(formatBRL(0)).toBe("R$ 0,00");
  });

  it("formata a distância com uma casa abaixo de 10 km", () => {
    expect(formatKm(4.2)).toBe("4,2 km");
    expect(formatKm(2)).toBe("2,0 km");
    expect(formatKm(16.4)).toBe("16,4 km");
    expect(formatKm(23)).toBe("23 km");
  });
});
