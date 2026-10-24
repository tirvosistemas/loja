import { describe, expect, it, vi } from "vitest";
import { adjustPrice, suggestPrice, type PriceCalcConfig } from "@/lib/price-calc";
import type { ProductAiFill } from "@/lib/ai/product";
import type { AiFillResult } from "@/app/admin/(panel)/produtos/tools-actions";
import { emptyProductValues, type ProductFormValues } from "@/components/admin/products/form-values";
import { mergeStandardized } from "@/components/admin/products/media-section";
import { barcodeSummary, mergeBarcode } from "@/components/admin/products/barcode-tools";
import { mergeAiFill } from "@/components/admin/products/ai-fill";

// Os componentes importam server actions; nos testes só interessam as funções puras.
vi.mock("@/app/admin/(panel)/produtos/tools-actions", () => ({}));

describe("calculadora de preço: ruído do ponto flutuante", () => {
  const cfg: PriceCalcConfig = { feeCardPercent: 5, feePixPercent: 0, taxPercent: 5, packagingCents: 200, otherCostCents: 0, targetMarginPercent: 20, priceEnding: "90" };

  it("não sobe R$ 1 quando o preço exato já cai no final", () => {
    // (1123 + 200) / 0,7 = 1890 (em float sai 1890,0000000000002)
    expect(suggestPrice(1123, cfg)).toBe(1890);
    expect(suggestPrice(143, cfg)).toBe(490);
    expect(suggestPrice(2313, cfg)).toBe(3590);
    expect(suggestPrice(1123, { ...cfg, priceEnding: "none" })).toBe(1890);
  });

  it("continua arredondando para cima quando passa do final", () => {
    expect(suggestPrice(1124, cfg)).toBe(1990);
  });

  it("reajuste também ignora o ruído", () => {
    // 11250 × 1,288 = 14490 (em float sai 14490,000000000002)
    expect(adjustPrice(11250, 28.8, "90")).toBe(14490);
    expect(adjustPrice(12500, 28.8, "00")).toBe(16100);
    expect(adjustPrice(7375, 28.8, "99")).toBe(9499);
  });
});

const base = (p: Partial<ProductFormValues> = {}): ProductFormValues => ({ ...emptyProductValues(), ...p });

describe("padronizar fotos: junta no estado atual", () => {
  it("aplica pelo endereço e mantém o que mudou durante a espera", () => {
    const sent = ["a.webp", "b.webp", "c.webp"];
    const out = [
      { url: "a-std.webp", sourceUrl: "a.webp", width: 1600, height: 1600 },
      { url: "b-std.webp", sourceUrl: "b.webp", width: 1600, height: 1600 },
      { url: "c-std.webp", sourceUrl: "c.webp", width: 1600, height: 1600 },
    ];
    // Durante a espera: "b" foi apagada, "c" virou capa e ganhou descrição, "d" foi enviada.
    const current = [{ url: "c.webp", alt: "De lado" }, { url: "a.webp", alt: "" }, { url: "d.webp", alt: "" }];
    expect(mergeStandardized(current, sent, out)).toEqual([
      { url: "c-std.webp", alt: "De lado", sourceUrl: "c.webp", width: 1600, height: 1600 },
      { url: "a-std.webp", alt: "", sourceUrl: "a.webp", width: 1600, height: 1600 },
      { url: "d.webp", alt: "" },
    ]);
  });
});

describe("código de barras: junta no estado atual", () => {
  const found = {
    source: "UPCitemdb" as const,
    ean: "7891234567895",
    name: "Fone JBL Tune 520BT",
    brand: "JBL",
    model: "T520BT",
    color: null,
    description: null,
    category: null,
    images: [],
    weightGrams: 160,
    widthCm: null,
    heightCm: null,
    depthCm: null,
  };
  const photo = { url: "base.webp", alt: "", width: 800, height: 800 };

  it("só preenche o que está vazio agora e soma as fotos às atuais", () => {
    const cur = base({ name: "Nome digitado na espera", images: [{ url: "enviada.webp", alt: "" }] });
    const patch = mergeBarcode(cur, "789123456789", found, "b1", [photo]);
    expect(patch.name).toBeUndefined();
    expect(patch).toMatchObject({ ean: "7891234567895", brandId: "b1", model: "T520BT", weightGrams: 160 });
    expect(patch.images).toEqual([{ url: "enviada.webp", alt: "" }, photo]);
  });

  it("marca que não existe não vira brandId", () => {
    const patch = mergeBarcode(base(), "7891234567895", { ...found, ean: "" }, null, []);
    expect(patch.brandId).toBeUndefined();
    expect(patch.ean).toBe("7891234567895");
    expect(patch.name).toBe("Fone JBL Tune 520BT");
    expect(patch.images).toBeUndefined();
  });

  it("resume o que veio da base sem depender do formulário", () => {
    expect(barcodeSummary(found, { id: "b1", name: "JBL" }, 2)).toBe("Encontrado no UPCitemdb: Fone JBL Tune 520BT. Veio nome, marca, modelo, medidas e 2 fotos. Só os campos vazios foram preenchidos.");
    expect(barcodeSummary({ ...found, model: null, weightGrams: null }, { id: null, name: "JBL" }, 0)).toBe("Encontrado no UPCitemdb: Fone JBL Tune 520BT. Veio nome. Só os campos vazios foram preenchidos.");
    expect(barcodeSummary({ ...found, name: null, model: null, weightGrams: null }, null, 0)).toBe("Encontrado no UPCitemdb: produto. A base não trouxe outros dados.");
  });
});

describe("preencher com IA", () => {
  const fill: ProductAiFill = {
    name: "Fone de Ouvido Bluetooth JBL Tune 520BT Azul",
    brand: "JBL",
    model: null,
    color: null,
    category: null,
    shortDescription: null,
    description: null,
    specs: [],
    voltage: null,
    warrantyMonths: null,
    weightGrams: null,
    widthCm: null,
    heightCm: null,
    depthCm: null,
    ean: null,
    tags: [],
    metaTitle: null,
    metaDescription: null,
  };
  const result = (brand: AiFillResult["brand"] = null): AiFillResult => ({ fill, categoryId: null, brand, warnings: [], model: "x" });

  it("ao reescrever o nome de um produto novo, a URL acompanha", () => {
    const { patch, count } = mergeAiFill(base({ name: "Fone JBL", slug: "fone-jbl", slugAuto: true }), result(), true);
    expect(patch.name).toBe(fill.name);
    expect(patch.slug).toBe("fone-de-ouvido-bluetooth-jbl-tune-520bt-azul");
    expect(count).toBe(1); // a URL não conta como campo preenchido
  });

  it("URL editada à mão não muda", () => {
    const { patch } = mergeAiFill(base({ name: "Fone JBL", slug: "fone", slugAuto: false }), result(), true);
    expect(patch.name).toBe(fill.name);
    expect(patch.slug).toBeUndefined();
  });

  it("só usa marca já cadastrada", () => {
    expect(mergeAiFill(base({ name: "Fone" }), result({ id: "b1", name: "JBL" }), false).patch.brandId).toBe("b1");
    expect(mergeAiFill(base({ name: "Fone" }), result({ id: null, name: "JBL" }), false).patch.brandId).toBeUndefined();
  });
});
