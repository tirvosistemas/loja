"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownUp, Loader2, SlidersHorizontal, X } from "lucide-react";
import { SORT_OPTIONS, VOLTAGE_LABEL, type SortValue } from "@/lib/constants";
import { Sheet } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/format";
import { useCatalogNav } from "./catalog-nav";
import { FiltersPanel, type Facets } from "./filters-panel";
import { activeFilterCount, baseToQuery, clearedListing, priceLabel, serializeListing, type ListingBase, type ListingState } from "./params";

/** Coluna de filtros do computador: cada mudança vai direto para a URL. */
export function DesktopFilters({ facets }: { facets: Facets }) {
  const { cfg, state, apply } = useCatalogNav();
  return <FiltersPanel idPrefix="f-desk" cfg={cfg} value={state} facets={facets} onChange={apply} />;
}

/** Botão "Filtrar" + gaveta no celular, com contagem ao vivo do rascunho. */
export function MobileFilters({ facets, total, base }: { facets: Facets; total: number; base: ListingBase }) {
  const { cfg, state, apply } = useCatalogNav();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ListingState>(state);
  const [count, setCount] = useState<number | null>(total);
  const [counting, setCounting] = useState(false);
  const active = activeFilterCount(cfg, state);
  const draftKey = serializeListing({ ...draft, page: 1, sort: null }, cfg);
  const stateKey = serializeListing({ ...state, page: 1, sort: null }, cfg);
  const reqId = useRef(0);

  // Conta os produtos do rascunho (com espera curta para não disparar a cada toque).
  useEffect(() => {
    if (!open) return;
    if (draftKey === stateKey) {
      setCount(total);
      setCounting(false);
      return;
    }
    const id = ++reqId.current;
    setCounting(true);
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams(draftKey);
        for (const [k, v] of Object.entries(baseToQuery(base))) qs.set(k, v);
        qs.set("count", "1");
        const res = await fetch(`/api/products?${qs.toString()}`);
        const data = (await res.json()) as { total?: number };
        if (id === reqId.current) setCount(typeof data.total === "number" ? data.total : null);
      } catch {
        if (id === reqId.current) setCount(null);
      } finally {
        if (id === reqId.current) setCounting(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [open, draftKey, stateKey, total, base]);

  const openSheet = () => {
    setDraft(state);
    setCount(total);
    setOpen(true);
  };

  const submit = () => {
    setOpen(false);
    if (draftKey !== stateKey) apply({ ...draft, sort: state.sort });
  };

  return (
    <>
      <Button variant="secondary" onClick={openSheet} className="lg:hidden" aria-haspopup="dialog">
        <SlidersHorizontal aria-hidden /> Filtrar
        {active > 0 && <span className="grid size-5 place-items-center rounded-full bg-primary font-mono text-[11px] font-semibold text-primary-foreground">{active}</span>}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        side="bottom"
        title={
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" aria-hidden /> Filtros
          </span>
        }
        footer={
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setDraft(clearedListing(cfg, draft))} disabled={activeFilterCount(cfg, draft) === 0}>
              Limpar
            </Button>
            <Button block size="lg" onClick={submit} disabled={count === 0 && !counting}>
              {counting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden /> Contando…
                </>
              ) : count == null ? (
                "Ver produtos"
              ) : count === 0 ? (
                "Nenhum produto"
              ) : (
                `Ver ${pluralize(count, "produto", "produtos")}`
              )}
            </Button>
          </div>
        }
      >
        <div className="px-5 py-4">
          <FiltersPanel idPrefix="f-mob" cfg={cfg} value={draft} facets={facets} onChange={setDraft} />
        </div>
      </Sheet>
    </>
  );
}

export function SortSelect({ defaultSort }: { defaultSort: SortValue }) {
  const { state, apply } = useCatalogNav();
  const current = state.sort ?? defaultSort;
  return (
    <label className="relative flex h-11 min-w-0 items-center gap-2 rounded-xl border border-border bg-card pl-3 pr-9 text-sm hover:border-border-strong focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
      <ArrowDownUp className="size-4 shrink-0 text-subtle" aria-hidden />
      <span className="sr-only">Ordenar por</span>
      <select
        value={current}
        onChange={(e) => apply({ ...state, sort: e.target.value as SortValue, page: 1 })}
        className="h-full min-w-0 cursor-pointer appearance-none bg-transparent pr-1 font-medium text-foreground outline-none"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} className="bg-card text-foreground">
            {o.label}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 16 16" className="pointer-events-none absolute right-3 size-4 text-subtle" aria-hidden>
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}

/** Chips dos filtros ativos (cada um remove o próprio filtro). */
export function ActiveFilters({ facets }: { facets: Facets }) {
  const { cfg, state, apply } = useCatalogNav();
  const chips: { key: string; label: string; next: ListingState }[] = [];
  const without = (patch: Partial<ListingState>): ListingState => ({ ...state, ...patch, page: 1 });

  if (state.q && !cfg.keepQuery) chips.push({ key: "q", label: `“${state.q}”`, next: without({ q: "" }) });
  if (!cfg.lockBrands)
    for (const b of state.brands) {
      const name = facets.brands.find((x) => x.slug === b)?.name ?? b;
      chips.push({ key: `b-${b}`, label: name, next: without({ brands: state.brands.filter((x) => x !== b) }) });
    }
  for (const v of state.voltages) chips.push({ key: `v-${v}`, label: VOLTAGE_LABEL[v] ?? v, next: without({ voltages: state.voltages.filter((x) => x !== v) }) });
  if (state.min != null || state.max != null) chips.push({ key: "price", label: priceLabel(state.min, state.max), next: without({ min: null, max: null }) });
  if (state.onSale && !cfg.lockOnSale) chips.push({ key: "sale", label: "Em oferta", next: without({ onSale: false }) });
  if (state.inStock) chips.push({ key: "stock", label: "Com estoque", next: without({ inStock: false }) });
  if (state.freeShipping) chips.push({ key: "ship", label: "Frete grátis", next: without({ freeShipping: false }) });

  if (!chips.length) return null;
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
      {chips.map((c) => (
        <li key={c.key} className="max-w-full">
          <button
            type="button"
            onClick={() => apply(c.next)}
            className="group flex h-9 max-w-full items-center gap-1.5 rounded-full border border-border bg-elevated pl-3 pr-2 text-sm text-foreground transition-colors hover:border-primary/50"
            aria-label={`Remover filtro ${c.label}`}
          >
            <span className="truncate">{c.label}</span>
            <X className="size-3.5 shrink-0 text-subtle group-hover:text-primary" aria-hidden />
          </button>
        </li>
      ))}
      {chips.length > 1 && (
        <li>
          <button
            type="button"
            onClick={() => apply(clearedListing(cfg, state))}
            className="h-9 px-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            Limpar tudo
          </button>
        </li>
      )}
    </ul>
  );
}
