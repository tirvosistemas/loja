import type { Product, ProductVariant } from "@prisma/client";
import { db } from "./db";
import { getSettings } from "./settings";
import { effectivePrice, getActivePromotions, type PromoLite } from "./pricing";
import { getCategoryOptions } from "./admin/catalog";
import { absImage } from "@/components/store/catalog/queries";
import { absoluteUrl } from "./utils";
import { isValidGtin } from "./barcode";

// Catálogo de produtos para Google Merchant Center e Meta (Instagram/Facebook): um item por
// produto, ou por variação ativa (agrupadas por item_group_id). Só produtos ativos com foto e preço.

export type FeedItem = {
  id: string;
  item_group_id: string | null;
  title: string;
  description: string;
  link: string;
  image_link: string;
  additional_image_link: string[];
  availability: "in_stock" | "out_of_stock";
  price: string;
  sale_price: string | null;
  sale_price_effective_date: string | null;
  brand: string | null;
  gtin: string | null;
  mpn: string | null;
  identifier_exists: "yes" | "no";
  condition: "new";
  product_type: string | null;
  color: string | null;
  shipping_weight: string | null;
};

export type FeedProduct = Pick<
  Product,
  | "id" | "name" | "slug" | "sku" | "description" | "shortDescription" | "priceCents" | "compareAtCents" | "categoryId" | "brandId"
  | "ean" | "model" | "color" | "weightGrams" | "trackStock" | "allowBackorder" | "stock" | "variantLabel"
> & {
  images: { url: string; sourceUrl: string | null }[];
  variants: Pick<ProductVariant, "id" | "sku" | "name" | "stock" | "priceCents" | "compareAtCents">[];
  brand: { name: string } | null;
};

const money = (cents: number) => `${(cents / 100).toFixed(2)} BRL`;

// Data e hora em ISO 8601 (UTC, até os minutos), como Google e Meta pedem.
const isoMinute = (d: Date | string) => `${new Date(d).toISOString().slice(0, 16)}+00:00`;

// Caracteres que o XML 1.0 não aceita (controle, U+FFFE/U+FFFF e surrogates soltos):
// um só deles num produto invalida o arquivo inteiro.
// eslint-disable-next-line no-control-regex
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export const stripXmlInvalid = (s: string) => s.replace(XML_INVALID, "");

/** Markdown simples → texto puro (o feed não aceita formatação). */
function plain(s: string) {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/^\s*[-+]\s+/gm, "• ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export async function feedEnabled() {
  return (await getSettings()).catalog.feedEnabled;
}

/** Itens do feed de um produto: ele mesmo ou uma linha por variação ativa. */
export function productFeedItems(p: FeedProduct, promos: PromoLite[], catLabel: Map<string, string>, now = new Date()): FeedItem[] {
  // Sempre a foto original: a versão com marca d'água é reprovada pelo Google.
  const images = p.images.map((im) => absImage(im.sourceUrl || im.url));
  const desc = plain(p.description || p.shortDescription || p.name).slice(0, 5000);
  const gtin = p.ean && isValidGtin(p.ean) ? p.ean : null;
  const base = {
    description: desc,
    link: absoluteUrl(`/produto/${p.slug}`),
    image_link: images[0],
    additional_image_link: images.slice(1, 11),
    brand: p.brand?.name ?? null,
    condition: "new" as const,
    product_type: p.categoryId ? (catLabel.get(p.categoryId) ?? null) : null,
    shipping_weight: p.weightGrams ? `${p.weightGrams} g` : null,
  };
  // Igual à vitrine: com "vender sem estoque" ligado, o produto continua disponível.
  const availability = (stock: number): FeedItem["availability"] => (!p.trackStock || p.allowBackorder || stock > 0 ? "in_stock" : "out_of_stock");
  const priceOf = (variant: { priceCents: number | null; compareAtCents: number | null } | null) => {
    const ep = effectivePrice(p, variant, promos);
    if (!ep.compareAtCents) return { price: money(ep.priceCents), sale_price: null, sale_price_effective_date: null };
    const promo = ep.promotion;
    return {
      price: money(ep.compareAtCents),
      sale_price: money(ep.priceCents),
      // Promoção com fim marcado: Google e Meta tiram o preço promocional na hora certa.
      sale_price_effective_date: promo?.endsAt ? `${isoMinute(promo.startsAt ?? now)}/${isoMinute(promo.endsAt)}` : null,
    };
  };
  if (!p.variants.length) {
    // MPN é o código do fabricante; o SKU é interno da loja e não serve.
    const mpn = p.model || null;
    return [
      {
        ...base,
        id: p.sku || p.id,
        item_group_id: null,
        title: p.name.slice(0, 150),
        availability: availability(p.stock),
        ...priceOf(null),
        gtin,
        mpn,
        identifier_exists: gtin || (mpn && p.brand) ? "yes" : "no",
        color: p.color,
      },
    ];
  }
  return p.variants.map((v) => ({
    ...base,
    id: v.sku || v.id,
    item_group_id: p.sku || p.id,
    title: `${p.name} – ${v.name}`.slice(0, 150),
    link: absoluteUrl(`/produto/${p.slug}?variacao=${encodeURIComponent(v.id)}`),
    availability: availability(v.stock),
    ...priceOf(v),
    // O EAN e o modelo cadastrados são do produto, não de cada variação.
    gtin: null,
    mpn: null,
    identifier_exists: "no" as const,
    color: p.variantLabel && /cor/i.test(p.variantLabel) ? v.name : p.color,
  }));
}

export async function loadFeedItems(): Promise<FeedItem[]> {
  const [products, promos, categories] = await Promise.all([
    db.product.findMany({
      where: { status: "ACTIVE", priceCents: { gt: 0 }, images: { some: {} } },
      orderBy: { updatedAt: "desc" },
      take: 20000,
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 11, select: { url: true, sourceUrl: true } },
        variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
        brand: { select: { name: true } },
      },
    }),
    getActivePromotions(),
    getCategoryOptions(),
  ]);
  const catLabel = new Map(categories.map((c) => [c.id, c.label.replace(/ › /g, " > ")]));
  const now = new Date();
  return products.flatMap((p) => productFeedItems(p, promos, catLabel, now));
}

const xml = (s: string) => stripXmlInvalid(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function feedXml(items: FeedItem[], store: { name: string; description: string }) {
  const tag = (k: string, v: string | null | undefined) => (v ? `<g:${k}>${xml(v)}</g:${k}>` : "");
  const body = items
    .map(
      (i) =>
        `<item>${tag("id", i.id)}${tag("item_group_id", i.item_group_id)}<title>${xml(i.title)}</title><description>${xml(i.description)}</description><link>${xml(i.link)}</link>${tag("image_link", i.image_link)}${i.additional_image_link.map((u) => tag("additional_image_link", u)).join("")}${tag("availability", i.availability)}${tag("price", i.price)}${tag("sale_price", i.sale_price)}${tag("sale_price_effective_date", i.sale_price_effective_date)}${tag("brand", i.brand)}${tag("gtin", i.gtin)}${tag("mpn", i.mpn)}${tag("identifier_exists", i.identifier_exists)}${tag("condition", i.condition)}${tag("product_type", i.product_type)}${tag("color", i.color)}${tag("shipping_weight", i.shipping_weight)}</item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${xml(store.name)}</title>
<link>${xml(absoluteUrl("/"))}</link>
<description>${xml(store.description)}</description>
${body}
</channel>
</rss>
`;
}

function toCsv<T extends object>(columns: readonly (keyof T & string)[], rows: T[]) {
  const esc = (v: unknown) => {
    const s = stripXmlInvalid(Array.isArray(v) ? v.join(",") : v == null ? "" : String(v));
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `${columns.join(",")}\n${rows.map((r) => columns.map((c) => esc(r[c])).join(",")).join("\n")}\n`;
}

const CSV_COLUMNS: (keyof FeedItem)[] = [
  "id",
  "item_group_id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "sale_price",
  "sale_price_effective_date",
  "link",
  "image_link",
  "additional_image_link",
  "brand",
  "gtin",
  "mpn",
  "identifier_exists",
  "product_type",
  "color",
  "shipping_weight",
];

export function feedCsv(items: FeedItem[]) {
  return toCsv(CSV_COLUMNS, items);
}

/** Foto enviada pelo painel em JPEG: a rota /uploads gera o .jpg a partir do .webp. */
export function jpegLink(url: string) {
  return url.startsWith(absoluteUrl("/uploads/")) && url.endsWith(".webp") ? `${url.slice(0, -5)}.jpg` : url;
}

// Colunas do Gerenciador de Comércio da Meta (não tem identifier_exists).
const META_COLUMNS = CSV_COLUMNS.filter((c) => c !== "identifier_exists");

/** Catálogo da Meta: disponibilidade "in stock"/"out of stock" e fotos em JPEG (não aceita WebP). */
export function feedMetaCsv(items: FeedItem[]) {
  return toCsv(
    META_COLUMNS,
    items.map((i) => ({
      ...i,
      availability: i.availability === "in_stock" ? "in stock" : "out of stock",
      image_link: jpegLink(i.image_link),
      additional_image_link: i.additional_image_link.map(jpegLink),
    })),
  );
}
