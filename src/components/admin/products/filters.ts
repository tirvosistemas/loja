// Filtros da lista de produtos do painel, lidos da URL. Seguro para servidor e cliente.

export const PRODUCTS_PER_PAGE = 25;

export const PRODUCT_STATUS_TABS = [
  { status: null, label: "Todos" },
  { status: "ACTIVE", label: "Ativos" },
  { status: "DRAFT", label: "Rascunhos" },
  { status: "ARCHIVED", label: "Arquivados" },
] as const;

export const PRODUCT_SORTS = [
  { value: "recentes", label: "Mais recentes" },
  { value: "nome", label: "Nome (A a Z)" },
  { value: "preco-asc", label: "Menor preço" },
  { value: "preco-desc", label: "Maior preço" },
  { value: "estoque", label: "Menor estoque" },
  { value: "mais-vendidos", label: "Mais vendidos" },
] as const;

export const STOCK_FILTERS = [
  { value: "baixo", label: "Estoque baixo" },
  { value: "zerado", label: "Sem estoque" },
] as const;

export type ProductStatusKey = "ACTIVE" | "DRAFT" | "ARCHIVED";
export type ProductSort = (typeof PRODUCT_SORTS)[number]["value"];
export type StockFilter = (typeof STOCK_FILTERS)[number]["value"];

export type ProductFilters = {
  q: string;
  status: ProductStatusKey | null;
  category: string | null; // id
  brand: string | null; // id
  stock: StockFilter | null;
  featured: boolean;
  sort: ProductSort;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function pick(sp: RawParams, key: string): string {
  const v = sp instanceof URLSearchParams ? sp.get(key) : sp[key];
  return (Array.isArray(v) ? v[0] : (v ?? "")).trim();
}

function oneOf<T extends string>(list: readonly T[], v: string): T | null {
  return (list as readonly string[]).includes(v) ? (v as T) : null;
}

const ID_RE = /^[\w-]{1,40}$/;

export function parseProductFilters(sp: RawParams): ProductFilters {
  const page = Number.parseInt(pick(sp, "page"), 10);
  const category = pick(sp, "categoria");
  const brand = pick(sp, "marca");
  return {
    q: pick(sp, "q").slice(0, 80),
    status: oneOf(["ACTIVE", "DRAFT", "ARCHIVED"] as const, pick(sp, "status")),
    category: category === "sem" || ID_RE.test(category) ? category : null,
    brand: brand === "sem" || ID_RE.test(brand) ? brand : null,
    stock: oneOf(
      STOCK_FILTERS.map((s) => s.value),
      pick(sp, "estoque"),
    ),
    featured: pick(sp, "destaque") === "1",
    sort:
      oneOf(
        PRODUCT_SORTS.map((s) => s.value),
        pick(sp, "ordem"),
      ) ?? "recentes",
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

/** Monta a query string a partir dos filtros (com ajustes pontuais). */
export function filtersQuery(f: ProductFilters, patch: Partial<ProductFilters> = {}): string {
  const v = { ...f, ...patch };
  const sp = new URLSearchParams();
  if (v.q) sp.set("q", v.q);
  if (v.status) sp.set("status", v.status);
  if (v.category) sp.set("categoria", v.category);
  if (v.brand) sp.set("marca", v.brand);
  if (v.stock) sp.set("estoque", v.stock);
  if (v.featured) sp.set("destaque", "1");
  if (v.sort !== "recentes") sp.set("ordem", v.sort);
  if (v.page > 1) sp.set("page", String(v.page));
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function hasActiveFilters(f: ProductFilters) {
  return !!(f.q || f.category || f.brand || f.stock || f.featured);
}

/** Situação do estoque exibida na lista. */
export type StockState = "untracked" | "out" | "low" | "ok";

/** Estoque total: com variações, soma as ativas; sem variações, o do produto. */
export function stockSummary(p: { trackStock: boolean; stock: number; lowStockAlert: number; variants: { stock: number; active: boolean }[] }) {
  const active = p.variants.filter((v) => v.active);
  const total = p.variants.length ? active.reduce((n, v) => n + Math.max(0, v.stock), 0) : p.stock;
  const zeroVariants = active.filter((v) => v.stock <= 0).length;
  const state: StockState = !p.trackStock ? "untracked" : total <= 0 ? "out" : total <= p.lowStockAlert ? "low" : "ok";
  return { total, zeroVariants, state };
}
