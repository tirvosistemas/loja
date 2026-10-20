import { describe, expect, it } from "vitest";
import { z } from "zod";
import { adjustPrice, applyEnding, priceBreakdown, suggestPrice, type PriceCalcConfig } from "@/lib/price-calc";
import { applySheet, diffRow, rowsToSheet, sheetToCsv, type BulkRow } from "@/lib/admin/bulk";
import { buildXlsx } from "@/lib/xlsx-write";
import { parseCsv, parseXlsx } from "@/lib/importer/sheet";
import { dimensionsToCm, isValidGtin, tidyTitle, weightToGrams } from "@/lib/barcode";
import { pickModel } from "@/lib/ai/providers";
import { looseParse } from "@/lib/ai/client";
import { buildLegalPage, legalMissing } from "@/lib/legal-pages";
import { settingsSchemas, type Settings } from "@/lib/settings";

const cfg: PriceCalcConfig = { feeCardPercent: 5, feePixPercent: 0, taxPercent: 6, packagingCents: 200, otherCostCents: 0, targetMarginPercent: 30, priceEnding: "90" };

describe("calculadora de preço", () => {
  it("arredonda para o final escolhido", () => {
    expect(applyEnding(4723, "90")).toBe(4790);
    expect(applyEnding(4795, "90")).toBe(4890);
    expect(applyEnding(4701, "00")).toBe(4800);
    expect(applyEnding(4790, "99")).toBe(4799);
  });
  it("sugere o preço que dá a margem desejada", () => {
    // (5000 + 200) / (1 − 0,41) = 8813,5 → 88,90
    const p = suggestPrice(5000, cfg)!;
    expect(p).toBe(8890);
    const b = priceBreakdown(p, 5000, cfg, "card");
    expect(b.marginPercent).toBeGreaterThanOrEqual(30);
    expect(b.feeCents).toBe(445);
    expect(suggestPrice(5000, { ...cfg, targetMarginPercent: 90 })).toBeNull();
  });
  it("reajusta em porcentagem sem subir em reduções", () => {
    expect(adjustPrice(10000, 10, "90")).toBe(11090);
    expect(adjustPrice(10000, -10, "90")).toBe(8990);
    expect(adjustPrice(10000, 10, "none")).toBe(11000);
  });
});

const row = (p: Partial<BulkRow>): BulkRow => ({
  key: "p:1",
  productId: "1",
  variantId: null,
  name: "Fone",
  sku: "F1",
  priceCents: 9990,
  compareAtCents: null,
  costCents: 5000,
  stock: 3,
  categoryId: "c1",
  brandId: "",
  status: "ACTIVE",
  weightGrams: null,
  widthCm: null,
  heightCm: null,
  depthCm: null,
  freeShipping: false,
  ean: "",
  hasVariants: false,
  image: null,
  ...p,
});

describe("planilha da edição em massa", () => {
  const lookup = { categories: [{ id: "c1", label: "Áudio › Fones" }, { id: "c2", label: "Games › Controles" }], brands: [{ id: "b1", name: "JBL" }] };
  const rows = [
    row({}),
    row({ key: "p:2", productId: "2", name: "Controle", sku: "C1", hasVariants: true, stock: 7 }),
    row({ key: "v:9", productId: "2", variantId: "9", name: "Preto", sku: "C1-P", priceCents: null, stock: 7, costCents: null }),
  ];

  it("exporta e lê de volta pelo .xlsx sem mudanças", () => {
    const cells = rowsToSheet(rows, lookup);
    expect(cells[0][0]).toBe("ID");
    const back = parseXlsx(buildXlsx(cells));
    const r = applySheet(rows, back, lookup);
    expect(r.changed).toBe(0);
    expect(r.notes).toEqual([]);
  });

  it("aplica células alteradas e ignora as vazias", () => {
    const cells = rowsToSheet(rows, lookup);
    cells[1][4] = 119.9; // preço
    cells[1][8] = "Controles"; // categoria pelo nome curto
    cells[1][9] = "JBL";
    cells[1][7] = null; // estoque vazio: mantém
    cells[3][7] = 2; // estoque da variação
    cells[3][4] = "89,90";
    const csv = sheetToCsv(cells);
    const r = applySheet(rows, parseCsv(csv.replace(/^﻿/, "")), lookup);
    expect(r.changed).toBe(2);
    expect(r.rows[0]).toMatchObject({ priceCents: 11990, categoryId: "c2", brandId: "b1", stock: 3 });
    expect(r.rows[2]).toMatchObject({ stock: 2, priceCents: 8990 });
    expect(diffRow(rows[0], r.rows[0])).toEqual({ priceCents: 11990, categoryId: "c2", brandId: "b1" });
  });

  it("avisa categoria inexistente e linha sem produto", () => {
    const cells = rowsToSheet(rows, lookup);
    cells[1][8] = "Inexistente";
    cells.push(["zzz", null, "Outro", "X9", 10]);
    const r = applySheet(rows, parseXlsx(buildXlsx(cells)), lookup);
    expect(r.notes.join(" ")).toMatch(/Inexistente/);
    expect(r.notes.join(" ")).toMatch(/1 linha/);
  });
});

describe("código de barras", () => {
  it("confere o dígito verificador", () => {
    expect(isValidGtin("7894900011517")).toBe(true);
    expect(isValidGtin("7894900011518")).toBe(false);
    expect(isValidGtin("12345")).toBe(false);
  });
  it("converte peso, medidas e título", () => {
    expect(weightToGrams("1.2 lb")).toBe(544);
    expect(weightToGrams("500 g")).toBe(500);
    expect(dimensionsToCm("10 X 5 X 2 inches")).toEqual({ width: 25.4, height: 12.7, depth: 5.1 });
    expect(tidyTitle("FONE DE OUVIDO BLUETOOTH JBL")).toBe("Fone De Ouvido Bluetooth JBL");
    expect(tidyTitle("Cabo USB-C")).toBe("Cabo USB-C");
  });
});

describe("IA", () => {
  it("escolhe o modelo mais novo e barato da lista", () => {
    expect(pickModel("gemini", ["models/gemini-2.5-flash", "models/gemini-3.5-flash", "models/gemini-3.5-flash-lite", "models/gemini-3.5-pro", "models/gemini-embedding-001"])).toBe("gemini-3.5-flash");
    expect(pickModel("gemini", ["gemini-flash-latest", "gemini-3.5-flash"])).toBe("gemini-flash-latest");
    expect(pickModel("openai", ["gpt-5.4", "gpt-5.4-mini", "gpt-5-mini", "gpt-image-1", "gpt-5.4-mini-transcribe"])).toBe("gpt-5.4-mini");
    expect(pickModel("anthropic", ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"])).toBe("claude-sonnet-5-5");
    expect(pickModel("xai", [])).toBe("grok-4");
  });
  it("aceita JSON imperfeito sem perder o resto", () => {
    const schema = z.object({ name: z.string().nullable(), tags: z.array(z.string()), weight: z.number().int().nullable(), specs: z.array(z.object({ label: z.string(), value: z.string() })) });
    const r = looseParse(schema, { name: "Fone", tags: "x", weight: 12.5, specs: [{ label: "Cor", value: "Preto" }, { label: 3 }] });
    expect(r).toEqual({ name: "Fone", tags: [], weight: null, specs: [{ label: "Cor", value: "Preto" }] });
  });
});

describe("páginas legais", () => {
  const settings = Object.fromEntries(Object.entries(settingsSchemas).map(([k, sch]) => [k, sch.parse({})])) as Settings;
  it("usa os dados da loja", () => {
    const s = { ...settings, store: { ...settings.store, legalName: "Tirvo Comércio Ltda", cnpj: "12.345.678/0001-90", email: "contato@tirvo.com.br" } };
    const p = buildLegalPage("trocas-e-devolucoes", s, { returnDays: 10 });
    expect(p.content).toContain("10 dias corridos");
    expect(p.content).toContain("CNPJ 12.345.678/0001-90");
    expect(buildLegalPage("entregas", s).content).toContain("por km");
    expect(legalMissing(settings)).toEqual(["razão social", "CNPJ", "endereço", "e-mail"]);
  });
});
