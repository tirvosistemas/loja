import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { feedCsv, feedMetaCsv, feedXml, jpegLink, productFeedItems, stripXmlInvalid, type FeedProduct } from "@/lib/feed";
import type { PromoLite } from "@/lib/pricing";
import { absoluteUrl } from "@/lib/utils";
import { deleteImage, jpegFromWebp } from "@/lib/uploads";
import { buildLegalPage, legalMissing } from "@/lib/legal-pages";
import { settingsSchemas, type Settings } from "@/lib/settings";

const NOW = new Date("2026-10-20T12:00:00Z");

const product = (patch: Partial<FeedProduct> = {}): FeedProduct => ({
  id: "p1",
  name: "Fone JBL Tune 510BT",
  slug: "fone-jbl",
  sku: "FONE-JBL",
  description: "Fone sem fio",
  shortDescription: null,
  priceCents: 20000,
  compareAtCents: null,
  categoryId: null,
  brandId: "b1",
  ean: null,
  model: "JBLT510BTBLK",
  color: "Preto",
  weightGrams: 300,
  trackStock: true,
  allowBackorder: false,
  stock: 5,
  variantLabel: null,
  images: [{ url: "/uploads/products/2026/10/marca", sourceUrl: "/uploads/products/2026/10/orig" }],
  variants: [],
  brand: { name: "JBL" },
  ...patch,
});

const promo = (patch: Partial<PromoLite> = {}): PromoLite => ({
  id: "promo",
  name: "Relâmpago",
  type: "PERCENT",
  value: 30,
  scope: "ALL",
  flash: true,
  badge: null,
  priority: 0,
  startsAt: new Date("2026-10-20T11:00:00Z"),
  endsAt: new Date("2026-10-20T23:00:00Z"),
  categoryIds: [],
  brandIds: [],
  productIds: [],
  ...patch,
});

const one = (p: FeedProduct, promos: PromoLite[] = []) => productFeedItems(p, promos, new Map(), NOW)[0];

describe("feed: texto válido em XML", () => {
  it("tira caracteres que o XML 1.0 não aceita e mantém o resto", () => {
    expect(stripXmlInvalid("Fone\u000Bcom\u0008fio\u000C\u0000")).toBe("Fonecomfio");
    expect(stripXmlInvalid("a￾b￿")).toBe("ab");
    expect(stripXmlInvalid("x\uD800y\uDC00z")).toBe("xyz");
    expect(stripXmlInvalid("linha\n\ttab 🎧 ação")).toBe("linha\n\ttab 🎧 ação");
  });
  it("o XML e o CSV saem sem caractere de controle", () => {
    const item = one(product({ name: "Fone\u0002 JBL", description: "Manual\u000Ctexto\u000Bcom quebra" }));
    const xml = feedXml([item], { name: "Loja\u0008", description: "Eletrônicos" });
    // eslint-disable-next-line no-control-regex
    expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
    expect(xml).toContain("<description>Manualtextocom quebra</description>");
    // eslint-disable-next-line no-control-regex
    expect(feedCsv([item])).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
  });
});

describe("feed: itens", () => {
  it("usa a foto original, sem marca d'água", () => {
    const item = one(product({ images: [{ url: "/uploads/products/2026/10/marca", sourceUrl: "/uploads/products/2026/10/orig" }, { url: "/uploads/products/2026/10/sem-padrao", sourceUrl: null }] }));
    expect(item.image_link).toBe(absoluteUrl("/uploads/products/2026/10/orig-lg.webp"));
    expect(item.additional_image_link).toEqual([absoluteUrl("/uploads/products/2026/10/sem-padrao-lg.webp")]);
  });

  it("disponibilidade igual à da vitrine, sem backorder", () => {
    expect(one(product({ stock: 0 })).availability).toBe("out_of_stock");
    expect(one(product({ stock: 0, allowBackorder: true })).availability).toBe("in_stock");
    expect(one(product({ stock: 0, trackStock: false })).availability).toBe("in_stock");
    const variants = productFeedItems(
      product({ allowBackorder: true, variants: [{ id: "v1", sku: "V1", name: "Preto", stock: 0, priceCents: null, compareAtCents: null }] }),
      [],
      new Map(),
      NOW,
    );
    expect(variants[0].availability).toBe("in_stock");
  });

  it("MPN só com o modelo do fabricante, nunca o SKU", () => {
    const withModel = one(product());
    expect(withModel.mpn).toBe("JBLT510BTBLK");
    expect(withModel.identifier_exists).toBe("yes");
    const noModel = one(product({ model: null }));
    expect(noModel.mpn).toBeNull();
    expect(noModel.identifier_exists).toBe("no");
    expect(one(product({ brand: null })).identifier_exists).toBe("no");
    expect(one(product({ model: null, ean: "7891234567895" })).identifier_exists).toBe("yes");
    const variants = productFeedItems(
      product({
        variants: [
          { id: "v1", sku: "FONE-JBL-PT", name: "Preto", stock: 3, priceCents: null, compareAtCents: null },
          { id: "v2", sku: "FONE-JBL-BR", name: "Branco", stock: 3, priceCents: null, compareAtCents: null },
        ],
      }),
      [],
      new Map(),
      NOW,
    );
    expect(variants.map((v) => [v.mpn, v.identifier_exists])).toEqual([
      [null, "no"],
      [null, "no"],
    ]);
  });

  it("promoção com fim marcado leva sale_price_effective_date", () => {
    const item = one(product(), [promo()]);
    expect(item.price).toBe("200.00 BRL");
    expect(item.sale_price).toBe("140.00 BRL");
    expect(item.sale_price_effective_date).toBe("2026-10-20T11:00+00:00/2026-10-20T23:00+00:00");
    // Sem início marcado: começa agora.
    expect(one(product(), [promo({ startsAt: null })]).sale_price_effective_date).toBe("2026-10-20T12:00+00:00/2026-10-20T23:00+00:00");
    // Sem fim, ou só o "de" riscado do cadastro: sem data.
    expect(one(product(), [promo({ endsAt: null })]).sale_price_effective_date).toBeNull();
    const listed = one(product({ compareAtCents: 25000 }));
    expect([listed.sale_price, listed.sale_price_effective_date]).toEqual(["200.00 BRL", null]);
    expect(one(product()).sale_price_effective_date).toBeNull();
  });

  it("XML e CSV levam a data da promoção", () => {
    const item = one(product(), [promo()]);
    expect(feedXml([item], { name: "Loja", description: "" })).toContain("<g:sale_price_effective_date>2026-10-20T11:00+00:00/2026-10-20T23:00+00:00</g:sale_price_effective_date>");
    const [head, row] = feedCsv([item]).split("\n");
    const cols = head.split(",");
    expect(row.split(",")[cols.indexOf("sale_price_effective_date")]).toBe("2026-10-20T11:00+00:00/2026-10-20T23:00+00:00");
  });
});

describe("feed: Meta", () => {
  it("troca o .webp das fotos enviadas pelo .jpg", () => {
    expect(jpegLink(absoluteUrl("/uploads/products/2026/10/orig-lg.webp"))).toBe(absoluteUrl("/uploads/products/2026/10/orig-lg.jpg"));
    expect(jpegLink("https://cdn.exemplo.com/foto.webp")).toBe("https://cdn.exemplo.com/foto.webp");
    expect(jpegLink(absoluteUrl("/brand/logo.png"))).toBe(absoluteUrl("/brand/logo.png"));
  });

  it("usa colunas e valores da Meta", () => {
    const p = product({ images: [{ url: "/uploads/p/a", sourceUrl: null }, { url: "/uploads/p/b", sourceUrl: null }, { url: "/uploads/p/c", sourceUrl: null }] });
    const csv = feedMetaCsv([one(p, [promo()]), one(product({ id: "p2", sku: "P2", stock: 0 }))]);
    const [head, first, second] = csv.trim().split("\n");
    const cols = head.split(",");
    expect(cols).not.toContain("identifier_exists");
    expect(cols).toEqual(expect.arrayContaining(["id", "title", "description", "availability", "condition", "price", "sale_price", "sale_price_effective_date", "link", "image_link", "additional_image_link", "brand", "gtin", "mpn"]));
    expect(first).toContain(",in stock,new,200.00 BRL,140.00 BRL,2026-10-20T11:00+00:00/2026-10-20T23:00+00:00,");
    expect(first).toContain(`,${absoluteUrl("/uploads/p/a-lg.jpg")},"${absoluteUrl("/uploads/p/b-lg.jpg")},${absoluteUrl("/uploads/p/c-lg.jpg")}",`);
    expect(first).not.toContain(".webp");
    expect(second).toContain(",out of stock,");
  });
});

describe("fotos em JPEG para o catálogo", () => {
  let dir = "";
  const before = process.env.UPLOAD_DIR;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "tirvo-up-"));
    process.env.UPLOAD_DIR = dir;
    await mkdir(path.join(dir, "products"), { recursive: true });
    // PNG com transparência salvo como WebP, como o painel faz.
    const png = await sharp({ create: { width: 40, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    for (const s of ["sm", "md", "lg"]) await sharp(png).webp().toFile(path.join(dir, "products", `k-${s}.webp`));
  });
  afterAll(async () => {
    process.env.UPLOAD_DIR = before;
    await rm(dir, { recursive: true, force: true });
  });

  it("gera o .jpg do .webp uma vez, com fundo branco", async () => {
    expect(await jpegFromWebp("products/k-lg.jpg")).toBe(true);
    const jpg = path.join(dir, "products", "k-lg.jpg");
    const meta = await sharp(jpg).metadata();
    expect(meta.format).toBe("jpeg");
    const { data } = await sharp(jpg).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(240); // transparente vira branco
    expect((await readdir(path.join(dir, "products"))).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("não sai da pasta nem inventa arquivo", async () => {
    expect(await jpegFromWebp("../fora-lg.jpg")).toBe(false);
    expect(await jpegFromWebp("products/nao-existe-lg.jpg")).toBe(false);
    expect(await jpegFromWebp("products/k-lg.png")).toBe(false);
    expect(existsSync(path.join(dir, "products", "nao-existe-lg.jpg"))).toBe(false);
  });

  it("apagar a foto apaga também o .jpg", async () => {
    await jpegFromWebp("products/k-sm.jpg");
    await deleteImage("/uploads/products/k");
    expect(await readdir(path.join(dir, "products"))).toEqual([]);
  });
});

describe("páginas legais: correções", () => {
  const base = Object.fromEntries(Object.entries(settingsSchemas).map(([k, sch]) => [k, sch.parse({})])) as Settings;
  const withPayment = (patch: Partial<Settings["payment"]>, stripe = false): Settings => ({
    ...base,
    payment: { ...base.payment, ...patch, stripeEnabled: stripe },
    integrations: { ...base.integrations, ...(stripe ? { stripeSecretKey: "sk", stripePublishableKey: "pk" } : {}) },
  });

  it("prazos de defeito e avaria seguem o CDC, não o prazo de arrependimento", () => {
    const c = buildLegalPage("trocas-e-devolucoes", base, { returnDays: 10, defectDays: 120 }).content;
    expect(c).toContain("**10 dias corridos**");
    expect(c).toContain("**30 dias** (produtos não duráveis) ou **120 dias** (produtos duráveis)");
    expect(c).toContain("art. 26, §3º");
    expect(c).toMatch(/Avaria no transporte\n\n.*em até 30 dias \(produtos não duráveis\) ou 120 dias \(duráveis\)/);
    expect(c).not.toMatch(/(Produto com defeito|Avaria no transporte)[\s\S]*10 dias/);
  });

  it("o cliente pode entregar o produto com defeito à loja", () => {
    const c = buildLegalPage("trocas-e-devolucoes", base).content;
    expect(c).toContain("entregar o produto à loja, que o encaminha à assistência técnica, ou levá-lo direto à assistência autorizada");
    expect(c).toContain("art. 18, §1º");
    expect(c).not.toContain("orientamos");
  });

  it("desconto do Pix só nas formas que dão desconto", () => {
    const terms = (s: Settings) => buildLegalPage("termos-de-uso", s).content;
    expect(terms(withPayment({ onDeliveryPix: true, pixKey: "" }))).toContain("- Pix na entrega tem **5% de desconto**, aplicado no checkout.");
    expect(terms(withPayment({ onDeliveryPix: true, pixKey: "12345678000190" }))).toContain("- Pix para a chave da loja e Pix na entrega têm **5% de desconto**");
    expect(terms(withPayment({ onDeliveryPix: true }, true))).toContain("(não vale para o Pix do pagamento online)");
    expect(terms(withPayment({ onDeliveryPix: false, pixKey: "" }, true))).not.toContain("de desconto");
    expect(terms(withPayment({ pixDiscountPercent: 0, onDeliveryPix: true }))).not.toContain("de desconto");
  });

  it("privacidade: canal do titular, direitos do art. 18 e cookies com consentimento", () => {
    const s = { ...base, integrations: { ...base.integrations, googleAnalyticsId: "G-ABC1234" } };
    const c = buildLegalPage("politica-de-privacidade", s).content;
    expect(c).toContain("## Canal de atendimento ao titular (LGPD)");
    expect(c).not.toContain("encarregado");
    for (const t of ["bloqueio", "com quem compartilhamos", "não dar o consentimento", "revogação do consentimento", "ANPD"]) expect(c).toContain(t);
    expect(c).toContain("só depois que você clica em **Aceitar**");
    expect(buildLegalPage("politica-de-privacidade", base).content).not.toContain("Aceitar");
  });

  it("e-mail é obrigatório mesmo com WhatsApp", () => {
    const s = { ...base, store: { ...base.store, legalName: "Tirvo Ltda", cnpj: "12.345.678/0001-90", whatsapp: "5541999999999", email: "" }, address: { ...base.address, street: "Rua A" } };
    expect(legalMissing(s)).toEqual(["e-mail"]);
    expect(legalMissing({ ...s, store: { ...s.store, email: "contato@tirvo.com.br" } })).toEqual([]);
  });
});
