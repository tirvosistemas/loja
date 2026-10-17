import { cache } from "react";
import type { Prisma, Voltage } from "@prisma/client";
import { db } from "./db";
import { effectivePrice, getActivePromotions, pixPrice, type PromoInfo, type PromoLite } from "./pricing";
import { getSettings } from "./settings";
import { installmentText } from "./format";
import { VOLTAGE_LABEL, type SortValue } from "./constants";
import { MAX_PER_LINE } from "./cart";

// Consultas da vitrine. Todas devolvem objetos simples (DTOs), prontos para ir a
// componentes de cliente, com o preço final já calculado (promoções, Pix, parcelas).

const productInclude = {
  brand: { select: { name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true, parent: { select: { name: true, slug: true } } } },
  images: { orderBy: { sortOrder: "asc" }, select: { url: true, alt: true } },
  variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export type ProductCardDTO = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  image: string | null;
  hoverImage: string | null;
  priceCents: number;
  compareAtCents: number | null;
  discountPercent: number;
  pixPriceCents: number;
  installments: { count: number; valueCents: number } | null;
  fromPrice: boolean; // variações com preços diferentes ("a partir de")
  isNew: boolean;
  featured: boolean;
  freeShipping: boolean;
  inStock: boolean;
  hasVariants: boolean;
  voltage: string | null;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  createdAt: string;
  promo: PromoInfo | null;
};

export type VariantDTO = {
  id: string;
  name: string;
  sku: string | null;
  priceCents: number;
  compareAtCents: number | null;
  discountPercent: number;
  pixPriceCents: number;
  inStock: boolean;
  maxQuantity: number;
};

export type ProductDetailDTO = ProductCardDTO & {
  sku: string | null;
  shortDescription: string | null;
  description: string | null;
  images: { url: string; alt: string | null }[];
  variantLabel: string | null;
  variants: VariantDTO[];
  maxQuantity: number;
  specs: { label: string; value: string }[];
  warrantyMonths: number | null;
  weightGrams: number | null;
  dimensions: { widthCm: number | null; heightCm: number | null; depthCm: number | null };
  color: string | null;
  model: string | null;
  ean: string | null;
  videoUrl: string | null;
  tags: string[];
  brandSlug: string | null;
  category: { id: string; name: string; slug: string; parent: { name: string; slug: string } | null } | null;
  metaTitle: string | null;
  metaDescription: string | null;
};

type PayCfg = { pixDiscountPercent: number; installmentsMax: number; installmentsMinCents: number };

function maxQty(p: { trackStock: boolean; allowBackorder: boolean }, stock: number) {
  return p.trackStock && !p.allowBackorder ? Math.max(0, Math.min(stock, MAX_PER_LINE)) : MAX_PER_LINE;
}

function toCard(p: ProductRow, promos: PromoLite[], pay: PayCfg): ProductCardDTO {
  const prices = p.variants.length ? p.variants.map((v) => effectivePrice(p, v, promos)) : [effectivePrice(p, null, promos)];
  const cheapest = prices.reduce((a, b) => (b.priceCents < a.priceCents ? b : a));
  const inStock = p.variants.length
    ? p.variants.some((v) => maxQty(p, v.stock) > 0)
    : maxQty(p, p.stock) > 0;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand?.name ?? null,
    image: p.images[0]?.url ?? null,
    hoverImage: p.images[1]?.url ?? null,
    priceCents: cheapest.priceCents,
    compareAtCents: cheapest.compareAtCents,
    discountPercent: cheapest.discountPercent,
    pixPriceCents: pixPrice(cheapest.priceCents, pay.pixDiscountPercent),
    installments: installmentText(cheapest.priceCents, pay.installmentsMax, pay.installmentsMinCents),
    fromPrice: new Set(prices.map((x) => x.priceCents)).size > 1,
    isNew: p.isNew,
    featured: p.featured,
    freeShipping: p.freeShipping,
    inStock,
    hasVariants: p.variants.length > 0,
    voltage: p.voltage && p.voltage !== "NA" ? VOLTAGE_LABEL[p.voltage] : null,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    soldCount: p.soldCount,
    createdAt: p.createdAt.toISOString(),
    promo: cheapest.promotion,
  };
}

async function context() {
  const [promos, settings] = await Promise.all([getActivePromotions(), getSettings()]);
  return { promos, pay: settings.payment as PayCfg };
}

// ───────── Listagem com filtros

export type ProductFilters = {
  q?: string;
  category?: string; // slug (inclui subcategorias)
  brands?: string[]; // slugs
  voltages?: Voltage[];
  minPriceCents?: number;
  maxPriceCents?: number;
  onSale?: boolean;
  inStock?: boolean;
  freeShipping?: boolean;
  isNew?: boolean;
  featured?: boolean;
  ids?: string[];
  sort?: SortValue;
  page?: number;
  perPage?: number;
};

export type ProductListResult = {
  items: ProductCardDTO[];
  total: number;
  page: number;
  pageCount: number;
  perPage: number;
  facets: {
    brands: { slug: string; name: string; count: number }[];
    voltages: { value: Voltage; label: string; count: number }[];
    price: { minCents: number; maxCents: number };
  };
  category: { id: string; name: string; slug: string; description: string | null; image: string | null; children: { name: string; slug: string }[]; parent: { name: string; slug: string } | null } | null;
};

function searchWhere(q: string): Prisma.ProductWhereInput {
  const terms = q.trim().split(/\s+/).filter((t) => t.length > 0).slice(0, 6);
  return {
    AND: terms.map((t) => ({
      OR: [
        { name: { contains: t } },
        { shortDescription: { contains: t } },
        { tags: { contains: t } },
        { model: { contains: t } },
        { sku: { contains: t } },
        { brand: { name: { contains: t } } },
        { category: { name: { contains: t } } },
      ],
    })),
  };
}

export async function listProducts(f: ProductFilters = {}): Promise<ProductListResult> {
  const { promos, pay } = await context();
  const perPage = Math.min(60, Math.max(1, f.perPage ?? 24));

  let category: ProductListResult["category"] = null;
  const where: Prisma.ProductWhereInput = { status: "ACTIVE" };
  const and: Prisma.ProductWhereInput[] = [];
  if (f.category) {
    const c = await db.category.findFirst({
      where: { slug: f.category, active: true },
      include: { children: { where: { active: true }, orderBy: { sortOrder: "asc" } }, parent: { select: { name: true, slug: true } } },
    });
    if (!c) return { items: [], total: 0, page: 1, pageCount: 0, perPage, facets: { brands: [], voltages: [], price: { minCents: 0, maxCents: 0 } }, category: null };
    category = {
      id: c.id, name: c.name, slug: c.slug, description: c.description, image: c.image,
      children: c.children.map((x) => ({ name: x.name, slug: x.slug })), parent: c.parent,
    };
    and.push({ categoryId: { in: [c.id, ...c.children.map((x) => x.id)] } });
  }
  if (f.q?.trim()) and.push(searchWhere(f.q));
  if (f.isNew) and.push({ isNew: true });
  if (f.featured) and.push({ featured: true });
  if (f.freeShipping) and.push({ freeShipping: true });
  if (f.ids?.length) and.push({ id: { in: f.ids } });
  if (and.length) where.AND = and;

  const rows = await db.product.findMany({ where, include: productInclude, take: 2000 });
  let cards = rows.map((r) => ({ row: r, card: toCard(r, promos, pay) }));

  // Facetas a partir do conjunto antes dos filtros de marca, voltagem e preço.
  const brandCount = new Map<string, { slug: string; name: string; count: number }>();
  const voltCount = new Map<Voltage, number>();
  let minP = Infinity;
  let maxP = 0;
  for (const { row, card } of cards) {
    if (row.brand) {
      const b = brandCount.get(row.brand.slug) ?? { slug: row.brand.slug, name: row.brand.name, count: 0 };
      b.count++;
      brandCount.set(row.brand.slug, b);
    }
    if (row.voltage) voltCount.set(row.voltage, (voltCount.get(row.voltage) ?? 0) + 1);
    minP = Math.min(minP, card.priceCents);
    maxP = Math.max(maxP, card.priceCents);
  }

  if (f.brands?.length) cards = cards.filter(({ row }) => row.brand && f.brands!.includes(row.brand.slug));
  if (f.voltages?.length) cards = cards.filter(({ row }) => row.voltage && f.voltages!.includes(row.voltage));
  if (f.minPriceCents != null) cards = cards.filter(({ card }) => card.priceCents >= f.minPriceCents!);
  if (f.maxPriceCents != null) cards = cards.filter(({ card }) => card.priceCents <= f.maxPriceCents!);
  if (f.onSale) cards = cards.filter(({ card }) => card.discountPercent > 0);
  if (f.inStock) cards = cards.filter(({ card }) => card.inStock);

  const q = f.q?.trim().toLowerCase();
  const sorters: Record<SortValue, (a: ProductCardDTO, b: ProductCardDTO) => number> = {
    relevance: (a, b) =>
      (q ? Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)) : 0) ||
      Number(b.inStock) - Number(a.inStock) ||
      Number(b.featured) - Number(a.featured) ||
      b.soldCount - a.soldCount ||
      b.createdAt.localeCompare(a.createdAt),
    "best-sellers": (a, b) => b.soldCount - a.soldCount || b.ratingCount - a.ratingCount,
    "price-asc": (a, b) => a.priceCents - b.priceCents,
    "price-desc": (a, b) => b.priceCents - a.priceCents,
    newest: (a, b) => Number(b.isNew) - Number(a.isNew) || b.createdAt.localeCompare(a.createdAt),
    discount: (a, b) => b.discountPercent - a.discountPercent || a.priceCents - b.priceCents,
  };
  const sorted = cards.map((c) => c.card).sort(sorters[f.sort ?? "relevance"] ?? sorters.relevance);

  const total = sorted.length;
  const pageCount = Math.ceil(total / perPage);
  const page = Math.min(Math.max(1, f.page ?? 1), Math.max(1, pageCount));
  return {
    items: sorted.slice((page - 1) * perPage, page * perPage),
    total,
    page,
    pageCount,
    perPage,
    facets: {
      brands: [...brandCount.values()].sort((a, b) => a.name.localeCompare(b.name)),
      voltages: [...voltCount.entries()].map(([value, count]) => ({ value, label: VOLTAGE_LABEL[value], count })),
      price: { minCents: Number.isFinite(minP) ? minP : 0, maxCents: maxP },
    },
    category,
  };
}

// ───────── Produto

export const getProductBySlug = cache(async (slug: string): Promise<ProductDetailDTO | null> => {
  const p = await db.product.findFirst({ where: { slug, status: "ACTIVE" }, include: productInclude });
  if (!p) return null;
  const { promos, pay } = await context();
  const card = toCard(p, promos, pay);
  const variants: VariantDTO[] = p.variants.map((v) => {
    const ep = effectivePrice(p, v, promos);
    const mq = maxQty(p, v.stock);
    return {
      id: v.id,
      name: v.name,
      sku: v.sku,
      priceCents: ep.priceCents,
      compareAtCents: ep.compareAtCents,
      discountPercent: ep.discountPercent,
      pixPriceCents: pixPrice(ep.priceCents, pay.pixDiscountPercent),
      inStock: mq > 0,
      maxQuantity: mq,
    };
  });
  const specs = Array.isArray(p.specs)
    ? (p.specs as unknown[])
        .filter((s): s is { label: string; value: string } => !!s && typeof s === "object" && "label" in s && "value" in s)
        .map((s) => ({ label: String(s.label), value: String(s.value) }))
    : [];
  return {
    ...card,
    sku: p.sku,
    shortDescription: p.shortDescription,
    description: p.description,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt })),
    variantLabel: p.variantLabel,
    variants,
    maxQuantity: p.variants.length ? 0 : maxQty(p, p.stock),
    specs,
    warrantyMonths: p.warrantyMonths,
    weightGrams: p.weightGrams,
    dimensions: { widthCm: p.widthCm, heightCm: p.heightCm, depthCm: p.depthCm },
    color: p.color,
    model: p.model,
    ean: p.ean,
    videoUrl: p.videoUrl,
    tags: (p.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean),
    brandSlug: p.brand?.slug ?? null,
    category: p.category
      ? { id: p.category.id, name: p.category.name, slug: p.category.slug, parent: p.category.parent ?? null }
      : null,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
  };
});

/** Soma uma visualização (sem bloquear a página). */
export function trackProductView(id: string) {
  db.product.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => null);
}

export async function getRelatedProducts(product: { id: string; category: { id: string } | null; brandSlug: string | null }, limit = 8) {
  const { promos, pay } = await context();
  const rows = await db.product.findMany({
    where: {
      status: "ACTIVE",
      id: { not: product.id },
      OR: [
        ...(product.category ? [{ categoryId: product.category.id }] : []),
        ...(product.brandSlug ? [{ brand: { slug: product.brandSlug } }] : []),
      ],
    },
    include: productInclude,
    orderBy: [{ soldCount: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map((r) => toCard(r, promos, pay));
}

export async function getProductsByIds(ids: string[]) {
  if (!ids.length) return [];
  const { promos, pay } = await context();
  const rows = await db.product.findMany({ where: { id: { in: ids.slice(0, 60) }, status: "ACTIVE" }, include: productInclude });
  const map = new Map(rows.map((r) => [r.id, toCard(r, promos, pay)]));
  return ids.map((id) => map.get(id)).filter((x): x is ProductCardDTO => !!x);
}

// ───────── Página inicial

async function cards(where: Prisma.ProductWhereInput, orderBy: Prisma.ProductOrderByWithRelationInput[], take: number) {
  const { promos, pay } = await context();
  const rows = await db.product.findMany({ where: { status: "ACTIVE", ...where }, include: productInclude, orderBy, take });
  return rows.map((r) => toCard(r, promos, pay));
}

export async function getHomeData() {
  const promos = await getActivePromotions();
  const flashPromos = promos.filter((p) => p.flash && p.endsAt);
  const flashEndsAt = flashPromos.length
    ? flashPromos.reduce((min, p) => (p.endsAt! < min ? p.endsAt! : min), flashPromos[0].endsAt!)
    : null;

  const [featured, newArrivals, bestSellers, saleList, flashList, categories, brands] = await Promise.all([
    cards({ featured: true }, [{ updatedAt: "desc" }], 12),
    cards({ isNew: true }, [{ createdAt: "desc" }], 12),
    cards({}, [{ soldCount: "desc" }], 12),
    listProducts({ onSale: true, sort: "discount", perPage: 12 }),
    flashPromos.length ? listProducts({ onSale: true, sort: "discount", perPage: 60 }) : null,
    getHomeCategories(),
    getBrands(),
  ]);

  const flashIds = new Set(flashPromos.map((p) => p.id));
  const flashProducts = (flashList?.items ?? []).filter((c) => c.promo && flashIds.has(c.promo.id)).slice(0, 12);

  return {
    featured,
    newArrivals,
    bestSellers,
    onSale: saleList.items,
    flash: flashProducts.length ? { endsAt: flashEndsAt!.toISOString(), products: flashProducts } : null,
    categories,
    brands,
  };
}

// ───────── Categorias, marcas, banners

export type MenuCategory = { id: string; name: string; slug: string; icon: string | null; image: string | null; children: { id: string; name: string; slug: string }[] };

export const getMenuCategories = cache(async (): Promise<MenuCategory[]> => {
  const rows = await db.category.findMany({
    where: { active: true, parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { children: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true } } },
  });
  return rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, icon: c.icon, image: c.image, children: c.children }));
});

export async function getHomeCategories() {
  const activeProducts = { _count: { select: { products: { where: { status: "ACTIVE" as const } } } } };
  const rows = await db.category.findMany({
    where: { active: true, OR: [{ featured: true }, { parentId: null }] },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }],
    select: {
      id: true, name: true, slug: true, icon: true, image: true, featured: true,
      ...activeProducts,
      // A página da categoria lista também as subcategorias ativas: a contagem segue a mesma regra.
      children: { where: { active: true }, select: activeProducts },
    },
    take: 12,
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon,
    image: c.image,
    productCount: c._count.products + c.children.reduce((n, ch) => n + ch._count.products, 0),
  }));
}

export const getBrands = cache(async () => {
  const rows = await db.brand.findMany({
    where: { active: true, products: { some: { status: "ACTIVE" } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, logo: true },
  });
  return rows;
});

export async function getActiveBanners(placement: "HERO" | "STRIP" = "HERO") {
  const now = new Date();
  const rows = await db.banner.findMany({
    where: {
      active: true,
      placement,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    eyebrow: b.eyebrow,
    ctaLabel: b.ctaLabel,
    href: b.href,
    imageDesktop: b.imageDesktop,
    imageMobile: b.imageMobile,
    theme: b.theme as "dark" | "light",
    align: b.align as "left" | "center" | "right",
  }));
}

export type BannerDTO = Awaited<ReturnType<typeof getActiveBanners>>[number];

// ───────── Busca rápida (autocompletar)

export async function searchSuggestions(q: string, limit = 6) {
  const term = q.trim();
  if (term.length < 2) return { products: [], categories: [] };
  const { promos, pay } = await context();
  const [rows, categories] = await Promise.all([
    db.product.findMany({ where: { status: "ACTIVE", ...searchWhere(term) }, include: productInclude, orderBy: { soldCount: "desc" }, take: limit }),
    db.category.findMany({ where: { active: true, name: { contains: term } }, select: { name: true, slug: true }, take: 4 }),
  ]);
  return {
    products: rows.map((r) => {
      const c = toCard(r, promos, pay);
      return { slug: c.slug, name: c.name, image: c.image, priceCents: c.priceCents, compareAtCents: c.compareAtCents, brand: c.brand };
    }),
    categories,
  };
}

export async function getFooterPages() {
  return db.page.findMany({
    where: { published: true, showInFooter: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { slug: true, title: true },
  });
}
