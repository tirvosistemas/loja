import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { effectivePrice, getActivePromotions } from "@/lib/pricing";
import { PRODUCTS_PER_PAGE, stockSummary, type ProductFilters, type StockState } from "@/components/admin/products/filters";

// Consulta da lista de produtos do painel (busca, filtros, ordem e paginação).

export type AdminProductRow = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  featured: boolean;
  isNew: boolean;
  image: string | null;
  variantCount: number;
  categoryLabel: string | null;
  brandName: string | null;
  priceCents: number; // preço final (com promoção)
  compareAtCents: number | null; // "de" riscado
  promotion: { name: string; badge: string | null } | null;
  variantPrices: { min: number; max: number } | null; // quando alguma variação tem preço próprio
  stock: { total: number; zeroVariants: number; state: StockState; alert: number };
  soldCount: number;
};

const rowSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  status: true,
  featured: true,
  isNew: true,
  priceCents: true,
  compareAtCents: true,
  stock: true,
  trackStock: true,
  lowStockAlert: true,
  soldCount: true,
  categoryId: true,
  brandId: true,
  category: { select: { name: true, parent: { select: { name: true } } } },
  brand: { select: { name: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
  variants: { select: { stock: true, active: true, priceCents: true } },
} satisfies Prisma.ProductSelect;

/** Filtro de busca, status, categoria (com subcategorias), marca e destaque. */
async function buildWhere(f: ProductFilters, opts: { ignoreStatus?: boolean } = {}): Promise<Prisma.ProductWhereInput> {
  const and: Prisma.ProductWhereInput[] = [];
  if (f.q) {
    const q = f.q;
    and.push({
      OR: [
        { name: { contains: q } },
        { sku: { contains: q } },
        { model: { contains: q } },
        { ean: { contains: q } },
        { variants: { some: { sku: { contains: q } } } },
      ],
    });
  }
  if (f.status && !opts.ignoreStatus) and.push({ status: f.status });
  if (f.category === "sem") and.push({ categoryId: null });
  else if (f.category) {
    const children = await db.category.findMany({ where: { parentId: f.category }, select: { id: true } });
    and.push({ categoryId: { in: [f.category, ...children.map((c) => c.id)] } });
  }
  if (f.brand === "sem") and.push({ brandId: null });
  else if (f.brand) and.push({ brandId: f.brand });
  if (f.featured) and.push({ featured: true });
  return and.length ? { AND: and } : {};
}

/** Produtos filtrados pelo estoque (calculado com as variações), na ordem do menor estoque. */
async function stockRows(where: Prisma.ProductWhereInput, f: ProductFilters) {
  const rows = await db.product.findMany({
    where,
    select: { id: true, name: true, status: true, trackStock: true, stock: true, lowStockAlert: true, variants: { select: { stock: true, active: true } } },
  });
  const list = rows
    .map((r) => ({ id: r.id, name: r.name, status: r.status, ...stockSummary(r) }))
    .filter((r) => (f.stock === "zerado" ? r.state === "out" : f.stock === "baixo" ? r.state === "low" : true));
  if (f.sort === "estoque") {
    // Sem controle de estoque vai para o fim.
    list.sort((a, b) => Number(a.state === "untracked") - Number(b.state === "untracked") || a.total - b.total || a.name.localeCompare(b.name, "pt-BR"));
  }
  return list;
}

function orderBy(sort: ProductFilters["sort"]): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "nome":
      return [{ name: "asc" }];
    case "preco-asc":
      return [{ priceCents: "asc" }, { name: "asc" }];
    case "preco-desc":
      return [{ priceCents: "desc" }, { name: "asc" }];
    case "mais-vendidos":
      return [{ soldCount: "desc" }, { name: "asc" }];
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

export async function listAdminProducts(f: ProductFilters) {
  const [base, baseAnyStatus, promos] = await Promise.all([buildWhere(f), buildWhere(f, { ignoreStatus: true }), getActivePromotions()]);

  let rows: Prisma.ProductGetPayload<{ select: typeof rowSelect }>[];
  let total: number;
  let page: number;
  let pageCount: number;
  const counts: Record<string, number> = { ALL: 0, ACTIVE: 0, DRAFT: 0, ARCHIVED: 0 };

  if (f.stock || f.sort === "estoque") {
    // Estoque depende das variações: filtra e ordena em memória (catálogo de loja, poucos milhares no máximo).
    const all = await stockRows(baseAnyStatus, f);
    for (const r of all) {
      counts[r.status] += 1;
      counts.ALL += 1;
    }
    const ids = all.filter((r) => !f.status || r.status === f.status).map((r) => r.id);
    total = ids.length;
    pageCount = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));
    page = Math.min(f.page, pageCount);
    if (f.sort === "estoque") {
      const pageIds = ids.slice((page - 1) * PRODUCTS_PER_PAGE, page * PRODUCTS_PER_PAGE);
      const found = pageIds.length ? await db.product.findMany({ where: { id: { in: pageIds } }, select: rowSelect }) : [];
      const byId = new Map(found.map((r) => [r.id, r]));
      rows = pageIds.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
    } else {
      rows = ids.length
        ? await db.product.findMany({
            where: { id: { in: ids } },
            orderBy: orderBy(f.sort),
            skip: (page - 1) * PRODUCTS_PER_PAGE,
            take: PRODUCTS_PER_PAGE,
            select: rowSelect,
          })
        : [];
    }
  } else {
    const groups = await db.product.groupBy({ by: ["status"], where: baseAnyStatus, _count: { _all: true } });
    for (const g of groups) {
      counts[g.status] = g._count._all;
      counts.ALL += g._count._all;
    }
    total = f.status ? (counts[f.status] ?? 0) : counts.ALL;
    pageCount = Math.max(1, Math.ceil(total / PRODUCTS_PER_PAGE));
    page = Math.min(f.page, pageCount);
    rows = total
      ? await db.product.findMany({ where: base, orderBy: orderBy(f.sort), skip: (page - 1) * PRODUCTS_PER_PAGE, take: PRODUCTS_PER_PAGE, select: rowSelect })
      : [];
  }

  const items: AdminProductRow[] = rows.map((p) => {
    const price = effectivePrice(p, null, promos);
    const own = p.variants.map((v) => v.priceCents).filter((c): c is number => c != null);
    const s = stockSummary(p);
    const variantPrices = own.length ? { min: Math.min(p.priceCents, ...own), max: Math.max(p.priceCents, ...own) } : null;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      status: p.status,
      featured: p.featured,
      isNew: p.isNew,
      image: p.images[0]?.url ?? null,
      variantCount: p.variants.length,
      categoryLabel: p.category ? (p.category.parent ? `${p.category.parent.name} › ${p.category.name}` : p.category.name) : null,
      brandName: p.brand?.name ?? null,
      priceCents: price.priceCents,
      compareAtCents: price.compareAtCents,
      promotion: price.promotion ? { name: price.promotion.name, badge: price.promotion.badge } : null,
      variantPrices: variantPrices && variantPrices.min !== variantPrices.max ? variantPrices : null,
      stock: { ...s, alert: p.lowStockAlert },
      soldCount: p.soldCount,
    };
  });

  return { items, total, page, pageCount, counts };
}
