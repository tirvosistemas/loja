import { db } from "./db";
import { getSettings } from "./settings";
import { effectivePrice, getActivePromotions } from "./pricing";
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
  availability: "in_stock" | "out_of_stock" | "backorder";
  price: string;
  sale_price: string | null;
  brand: string | null;
  gtin: string | null;
  mpn: string | null;
  identifier_exists: "yes" | "no";
  condition: "new";
  product_type: string | null;
  color: string | null;
  shipping_weight: string | null;
};

const money = (cents: number) => `${(cents / 100).toFixed(2)} BRL`;

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

export async function loadFeedItems(): Promise<FeedItem[]> {
  const [products, promos, categories] = await Promise.all([
    db.product.findMany({
      where: { status: "ACTIVE", priceCents: { gt: 0 }, images: { some: {} } },
      orderBy: { updatedAt: "desc" },
      take: 20000,
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 11, select: { url: true } },
        variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
        brand: { select: { name: true } },
      },
    }),
    getActivePromotions(),
    getCategoryOptions(),
  ]);
  const catLabel = new Map(categories.map((c) => [c.id, c.label.replace(/ › /g, " > ")]));
  const out: FeedItem[] = [];
  for (const p of products) {
    const images = p.images.map((im) => absImage(im.url));
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
    const availability = (stock: number): FeedItem["availability"] => (!p.trackStock || stock > 0 ? "in_stock" : p.allowBackorder ? "backorder" : "out_of_stock");
    const priceOf = (variant: { priceCents: number | null; compareAtCents: number | null } | null) => {
      const ep = effectivePrice(p, variant, promos);
      return ep.compareAtCents ? { price: money(ep.compareAtCents), sale_price: money(ep.priceCents) } : { price: money(ep.priceCents), sale_price: null };
    };
    if (!p.variants.length) {
      const mpn = p.model || p.sku;
      out.push({
        ...base,
        id: p.sku || p.id,
        item_group_id: null,
        title: p.name.slice(0, 150),
        availability: availability(p.stock),
        ...priceOf(null),
        gtin,
        mpn: mpn || null,
        identifier_exists: gtin || (mpn && p.brand) ? "yes" : "no",
        color: p.color,
      });
      continue;
    }
    for (const v of p.variants) {
      const mpn = v.sku || p.model;
      out.push({
        ...base,
        id: v.sku || v.id,
        item_group_id: p.sku || p.id,
        title: `${p.name} – ${v.name}`.slice(0, 150),
        link: absoluteUrl(`/produto/${p.slug}?variacao=${encodeURIComponent(v.id)}`),
        availability: availability(v.stock),
        ...priceOf(v),
        gtin: null, // o EAN cadastrado é do produto, não de cada variação
        mpn: mpn || null,
        identifier_exists: mpn && p.brand ? "yes" : "no",
        color: p.variantLabel && /cor/i.test(p.variantLabel) ? v.name : p.color,
      });
    }
  }
  return out;
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function feedXml(items: FeedItem[], store: { name: string; description: string }) {
  const tag = (k: string, v: string | null | undefined) => (v ? `<g:${k}>${xml(v)}</g:${k}>` : "");
  const body = items
    .map(
      (i) =>
        `<item>${tag("id", i.id)}${tag("item_group_id", i.item_group_id)}<title>${xml(i.title)}</title><description>${xml(i.description)}</description><link>${xml(i.link)}</link>${tag("image_link", i.image_link)}${i.additional_image_link.map((u) => tag("additional_image_link", u)).join("")}${tag("availability", i.availability)}${tag("price", i.price)}${tag("sale_price", i.sale_price)}${tag("brand", i.brand)}${tag("gtin", i.gtin)}${tag("mpn", i.mpn)}${tag("identifier_exists", i.identifier_exists)}${tag("condition", i.condition)}${tag("product_type", i.product_type)}${tag("color", i.color)}${tag("shipping_weight", i.shipping_weight)}</item>`,
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

const CSV_COLUMNS: (keyof FeedItem)[] = [
  "id",
  "item_group_id",
  "title",
  "description",
  "availability",
  "condition",
  "price",
  "sale_price",
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
  const esc = (v: unknown) => {
    const s = Array.isArray(v) ? v.join(",") : v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `${CSV_COLUMNS.join(",")}\n${items.map((i) => CSV_COLUMNS.map((c) => esc(i[c])).join(",")).join("\n")}\n`;
}
