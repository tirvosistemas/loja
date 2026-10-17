import { SORT_OPTIONS, type SortValue } from "@/lib/constants";
import type { ProductFilters } from "@/lib/catalog";

// Filtros das listagens na URL. Funções puras, usadas no servidor (página) e no
// navegador (filtros, ordenação, chips). Parâmetros: q, marca, voltagem, min, max
// (reais inteiros), oferta, estoque, frete, ordem e pagina.

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const VOLTAGE_FILTERS = ["V110", "V220", "BIVOLT"] as const;
export type VoltageFilter = (typeof VOLTAGE_FILTERS)[number];

export type ListingState = {
  q: string;
  brands: string[];
  voltages: VoltageFilter[];
  min: number | null; // reais
  max: number | null; // reais
  onSale: boolean;
  inStock: boolean;
  freeShipping: boolean;
  sort: SortValue | null; // null = ordem padrão da página
  page: number;
};

export const EMPTY_LISTING: ListingState = {
  q: "",
  brands: [],
  voltages: [],
  min: null,
  max: null,
  onSale: false,
  inStock: false,
  freeShipping: false,
  sort: null,
  page: 1,
};

const SORT_VALUES = new Set<string>(SORT_OPTIONS.map((o) => o.value));

function first(v: string | string[] | null | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function list(v: string): string[] {
  return [...new Set(v.split(",").map((s) => s.trim()).filter(Boolean))];
}

function reais(v: string): number | null {
  const n = parseInt(v.replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n >= 0 && n <= 10_000_000 ? n : null;
}

const flag = (v: string) => v === "1" || v === "true";

export function parseListing(input: RawSearchParams | URLSearchParams): ListingState {
  const get = (k: string) => (input instanceof URLSearchParams ? input.get(k) ?? "" : first(input[k]));
  let min = reais(get("min"));
  let max = reais(get("max"));
  if (min != null && max != null && min > max) [min, max] = [max, min];
  const sort = get("ordem");
  const page = parseInt(get("pagina"), 10);
  return {
    q: get("q").trim().slice(0, 100),
    brands: list(get("marca").toLowerCase()).filter((s) => /^[a-z0-9-]{1,120}$/.test(s)).slice(0, 30),
    voltages: list(get("voltagem").toUpperCase()).filter((v): v is VoltageFilter => (VOLTAGE_FILTERS as readonly string[]).includes(v)),
    min,
    max,
    onSale: flag(get("oferta")),
    inStock: flag(get("estoque")),
    freeShipping: flag(get("frete")),
    sort: SORT_VALUES.has(sort) ? (sort as SortValue) : null,
    page: Number.isFinite(page) && page > 1 ? Math.min(page, 1000) : 1,
  };
}

/** Monta a query string na ordem canônica (vazia quando não há filtros). */
export function serializeListing(s: ListingState, opts: { defaultSort?: SortValue; lockOnSale?: boolean; lockBrands?: boolean } = {}) {
  const p = new URLSearchParams();
  if (s.q) p.set("q", s.q);
  if (s.brands.length && !opts.lockBrands) p.set("marca", s.brands.join(","));
  if (s.voltages.length) p.set("voltagem", s.voltages.join(","));
  if (s.min != null) p.set("min", String(s.min));
  if (s.max != null) p.set("max", String(s.max));
  if (s.onSale && !opts.lockOnSale) p.set("oferta", "1");
  if (s.inStock) p.set("estoque", "1");
  if (s.freeShipping) p.set("frete", "1");
  if (s.sort && s.sort !== (opts.defaultSort ?? "relevance")) p.set("ordem", s.sort);
  if (s.page > 1) p.set("pagina", String(s.page));
  return p.toString().replace(/%2C/gi, ",");
}

export type ListingConfig = {
  basePath: string;
  defaultSort: SortValue;
  lockOnSale?: boolean; // /ofertas
  lockBrands?: boolean; // /marca/[slug]
  keepQuery?: boolean; // /busca: o termo não vira chip e não some ao limpar filtros
};

/** Link para a listagem com alterações. Qualquer mudança de filtro volta para a página 1. */
export function listingHref(cfg: ListingConfig, current: ListingState, patch: Partial<ListingState> = {}) {
  const next: ListingState = { ...current, ...patch, page: patch.page ?? 1 };
  const qs = serializeListing(next, cfg);
  return qs ? `${cfg.basePath}?${qs}` : cfg.basePath;
}

/** Estado sem filtros (mantém o termo da busca quando for o caso). */
export function clearedListing(cfg: ListingConfig, current: ListingState): ListingState {
  return { ...EMPTY_LISTING, q: cfg.keepQuery ? current.q : "", sort: current.sort };
}

export function activeFilterCount(cfg: ListingConfig, s: ListingState) {
  return (
    (cfg.lockBrands ? 0 : s.brands.length) +
    s.voltages.length +
    (s.min != null || s.max != null ? 1 : 0) +
    (s.onSale && !cfg.lockOnSale ? 1 : 0) +
    (s.inStock ? 1 : 0) +
    (s.freeShipping ? 1 : 0) +
    (s.q && !cfg.keepQuery ? 1 : 0)
  );
}

/** Faixas rápidas de preço a partir do menor e maior preço da listagem (em reais). */
export function priceRanges(minCents: number, maxCents: number): { label: string; min: number | null; max: number | null }[] {
  const lo = Math.floor(minCents / 100);
  const hi = Math.ceil(maxCents / 100);
  if (hi <= 0 || hi - lo < 50) return [];
  const nice = [50, 100, 150, 200, 300, 400, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000, 30000, 50000];
  const inside = nice.filter((n) => n > lo && n < hi);
  if (!inside.length) return [];
  // até 3 cortes, bem distribuídos
  const cuts: number[] = [];
  const want = Math.min(3, inside.length);
  for (let i = 1; i <= want; i++) {
    const target = lo + ((hi - lo) * i) / (want + 1);
    const pick = inside.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
    if (!cuts.includes(pick)) cuts.push(pick);
  }
  cuts.sort((a, b) => a - b);
  const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;
  const out: { label: string; min: number | null; max: number | null }[] = [{ label: `Até ${fmt(cuts[0])}`, min: null, max: cuts[0] }];
  for (let i = 1; i < cuts.length; i++) out.push({ label: `${fmt(cuts[i - 1])} a ${fmt(cuts[i])}`, min: cuts[i - 1], max: cuts[i] });
  out.push({ label: `Acima de ${fmt(cuts[cuts.length - 1])}`, min: cuts[cuts.length - 1], max: null });
  return out;
}

export function priceLabel(min: number | null, max: number | null) {
  const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;
  if (min != null && max != null) return `${fmt(min)} a ${fmt(max)}`;
  if (min != null) return `A partir de ${fmt(min)}`;
  if (max != null) return `Até ${fmt(max)}`;
  return "";
}

/** Filtros fixos de cada página (categoria, marca, lançamentos, ofertas). */
export type ListingBase = { category?: string; brand?: string; isNew?: boolean; onSale?: boolean };

/** Converte o estado da URL nos filtros de listProducts (reais → centavos). */
export function toProductFilters(s: ListingState, base: ListingBase, defaultSort: SortValue, perPage = 24): ProductFilters {
  const brands = base.brand ? [base.brand] : s.brands;
  return {
    q: s.q || undefined,
    category: base.category,
    brands: brands.length ? brands : undefined,
    voltages: s.voltages.length ? s.voltages : undefined,
    minPriceCents: s.min != null ? s.min * 100 : undefined,
    maxPriceCents: s.max != null ? s.max * 100 : undefined,
    onSale: base.onSale || s.onSale || undefined,
    inStock: s.inStock || undefined,
    freeShipping: s.freeShipping || undefined,
    isNew: base.isNew || undefined,
    sort: s.sort ?? defaultSort,
    page: s.page,
    perPage,
  };
}

/** Parâmetros que representam a base na API de contagem (/api/products?count=1). */
export function baseToQuery(base: ListingBase): Record<string, string> {
  const out: Record<string, string> = {};
  if (base.category) out.categoria = base.category;
  if (base.brand) out.marca = base.brand;
  if (base.isNew) out.novo = "1";
  if (base.onSale) out.oferta = "1";
  return out;
}

/** URL canônica da listagem: sem filtros, mas mantendo a página (paginação indexável). */
export function canonicalFor(basePath: string, sp: RawSearchParams) {
  const { page } = parseListing(sp);
  return page > 1 ? `${basePath}?pagina=${page}` : basePath;
}
