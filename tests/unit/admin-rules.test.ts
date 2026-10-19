import { describe, expect, it } from "vitest";
import { hrefSchema, imageKeySchema } from "@/components/admin/marketing/rules";
import { productSchema } from "@/lib/admin/product-schema";
import { feeBreakdown } from "@/components/admin/settings/fee-breakdown";
import { computeShippingFee } from "@/lib/shipping/quote";
import { shippingSchema, type ShippingSettings } from "@/lib/settings";

describe("hrefSchema (links de banners, promoções e notificações)", () => {
  it("aceita caminhos da loja, endereços completos e vazio", () => {
    expect(hrefSchema.parse("/ofertas")).toBe("/ofertas");
    expect(hrefSchema.parse("/categoria/headsets-gamer?ordem=preco")).toBe("/categoria/headsets-gamer?ordem=preco");
    expect(hrefSchema.parse("https://tirvo.com.br/ofertas")).toBe("https://tirvo.com.br/ofertas");
    expect(hrefSchema.parse("  ")).toBeNull();
  });

  it("recusa links que o navegador trata como outro site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "/\\/evil.com", "/ofertas\\..\\x", "https://evil.com\\@tirvo.com.br", "javascript:alert(1)", "/a b"]) {
      expect(hrefSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe("imageKeySchema", () => {
  it("aceita uploads do painel e https", () => {
    expect(imageKeySchema.safeParse("/uploads/banners/abc").success).toBe(true);
    expect(imageKeySchema.safeParse("https://cdn.exemplo.com/a.webp").success).toBe(true);
  });

  it("recusa barra invertida e endereço sem protocolo", () => {
    for (const bad of ["/\\evil.com/x.png", "//evil.com/x.png", "http://evil.com/x.png", "/uploads\\x"]) {
      expect(imageKeySchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe("productSchema (fotos)", () => {
  const base = {
    name: "Headset Teste",
    slug: "",
    status: "DRAFT",
    featured: false,
    isNew: false,
    freeShipping: false,
    tags: [],
    priceCents: 29990,
    trackStock: true,
    stock: 3,
    allowBackorder: false,
    lowStockAlert: 2,
    variants: [],
    specs: [],
  };

  it("guarda largura e altura enviadas pelo upload e aceita fotos antigas sem dimensões", () => {
    const parsed = productSchema.safeParse({
      ...base,
      images: [
        { url: "/uploads/products/nova", alt: "", width: 1600, height: 1200 },
        { url: "/uploads/products/antiga", alt: "Frente" },
      ],
    });
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.images[0]).toMatchObject({ width: 1600, height: 1200 });
    expect(parsed.data.images[1]).toMatchObject({ width: null, height: null });
  });

  it("recusa dimensões inválidas", () => {
    const parsed = productSchema.safeParse({ ...base, images: [{ url: "/uploads/products/x", width: -5, height: 1.5 }] });
    expect(parsed.success).toBe(false);
  });
});

describe("productSchema (URL do produto)", () => {
  const base = {
    slug: "",
    status: "DRAFT",
    featured: false,
    isNew: false,
    freeShipping: false,
    tags: [],
    images: [],
    priceCents: 1000,
    trackStock: false,
    stock: 0,
    allowBackorder: false,
    lowStockAlert: 0,
    variants: [],
    specs: [],
  };
  const paths = (input: Record<string, unknown>) => {
    const r = productSchema.safeParse({ ...base, ...input });
    return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
  };

  it("sem nome, o erro fica só no nome (a URL não reclama em dobro)", () => {
    const p = paths({ name: "" });
    expect(p).toContain("name");
    expect(p).not.toContain("slug");
  });

  it("acusa a URL quando o texto não vira endereço", () => {
    expect(paths({ name: "!!!" })).toContain("slug");
    expect(paths({ name: "Headset", slug: "@@@" })).toContain("slug");
    expect(paths({ name: "Headset Gamer RGB" })).toEqual([]);
  });
});

describe("feeBreakdown (simulador de frete do painel)", () => {
  it("dá o mesmo valor que o cálculo real do checkout", () => {
    let seed = 7;
    const rnd = (n: number) => {
      seed = (seed * 16807) % 2147483647;
      return seed % n;
    };
    for (let i = 0; i < 400; i++) {
      const s: ShippingSettings = {
        ...shippingSchema.parse({}),
        baseFeeCents: rnd(1500),
        pricePerKmCents: rnd(600),
        minFeeCents: rnd(3000),
        extraPerItemCents: rnd(800),
        maxDistanceKm: rnd(4) === 0 ? 0 : 5 + rnd(60),
        freeShippingEnabled: rnd(4) !== 0,
        freeShippingAboveCents: rnd(3) === 0 ? null : rnd(300_000),
        freeShippingMaxKm: rnd(3) === 0 ? null : rnd(40),
        roundToCents: [1, 10, 50, 100][rnd(4)],
      };
      const input = { distanceKm: rnd(800) / 10 + rnd(100) / 1000, itemCount: 1 + rnd(5), subtotalCents: rnd(400_000) };
      const real = computeShippingFee(s, input);
      const b = feeBreakdown(s, input);
      expect(b.available, JSON.stringify({ s, input })).toBe(real.available);
      if (real.available) expect(b.finalCents, JSON.stringify({ s, input })).toBe(real.feeCents);
    }
  });
});
