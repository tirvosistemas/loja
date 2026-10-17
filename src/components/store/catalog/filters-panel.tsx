"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import type { ProductListResult } from "@/lib/catalog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { activeFilterCount, clearedListing, priceRanges, type ListingConfig, type ListingState, type VoltageFilter } from "./params";

// Painel de filtros controlado: o mesmo componente serve a coluna do computador
// (aplica direto na URL) e a gaveta do celular (rascunho + "Ver N produtos").

export type Facets = ProductListResult["facets"];

function Group({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className="border-b border-border pb-5 last:border-b-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-full items-center justify-between gap-2 text-left font-mono text-xs uppercase tracking-[0.16em] text-subtle hover:text-foreground"
        >
          {title}
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </h3>
      <div id={id} hidden={!open} className="pt-2">
        {children}
      </div>
    </section>
  );
}

function CheckRow({ checked, onChange, label, count }: { checked: boolean; onChange: (v: boolean) => void; label: string; count?: number }) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-1 text-sm hover:bg-elevated">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4.5 shrink-0 cursor-pointer appearance-none rounded-md border border-border-strong bg-card bg-center bg-no-repeat transition-colors checked:border-primary checked:bg-primary checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><path d=%22M3.5 8.5l3 3 6-7%22 fill=%22none%22 stroke=%22%2309090b%22 stroke-width=%222.2%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')]"
      />
      <span className={cn("min-w-0 flex-1 truncate", checked ? "text-foreground" : "text-muted-foreground")}>{label}</span>
      {count != null && <span className="tabular text-xs text-subtle">{count}</span>}
    </label>
  );
}

function PriceInputs({ min, max, onCommit, idPrefix }: { min: number | null; max: number | null; onCommit: (min: number | null, max: number | null) => void; idPrefix: string }) {
  const [lo, setLo] = useState(min != null ? String(min) : "");
  const [hi, setHi] = useState(max != null ? String(max) : "");
  // Mantém os campos em dia quando a URL muda por outro caminho (chips, faixas).
  useEffect(() => {
    setLo(min != null ? String(min) : "");
    setHi(max != null ? String(max) : "");
  }, [min, max]);

  const parse = (v: string) => {
    const n = parseInt(v.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  };
  const commit = () => {
    let a = parse(lo);
    let b = parse(hi);
    if (a != null && b != null && a > b) [a, b] = [b, a];
    if (a !== min || b !== max) onCommit(a, b);
  };
  const field = "h-11 w-full rounded-xl border border-input bg-card pl-9 pr-2 text-sm tabular text-foreground placeholder:text-subtle hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25";
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
      // Aplica ao sair dos campos (passar do mínimo para o máximo não conta).
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) commit();
      }}
    >
      <div className="min-w-0 flex-1">
        <label htmlFor={`${idPrefix}-min`} className="mb-1 block text-xs text-subtle">
          Mínimo
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-subtle">R$</span>
          <input id={`${idPrefix}-min`} inputMode="numeric" autoComplete="off" placeholder="0" value={lo} onChange={(e) => setLo(e.target.value.replace(/\D/g, "").slice(0, 7))} className={field} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <label htmlFor={`${idPrefix}-max`} className="mb-1 block text-xs text-subtle">
          Máximo
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-subtle">R$</span>
          <input id={`${idPrefix}-max`} inputMode="numeric" autoComplete="off" placeholder="Sem limite" value={hi} onChange={(e) => setHi(e.target.value.replace(/\D/g, "").slice(0, 7))} className={field} />
        </div>
      </div>
      <Button type="submit" variant="secondary" size="icon" aria-label="Aplicar faixa de preço" className="h-11 shrink-0 font-mono text-xs">
        OK
      </Button>
    </form>
  );
}

export function FiltersPanel({
  cfg,
  value,
  facets,
  onChange,
  idPrefix,
  className,
}: {
  cfg: ListingConfig;
  value: ListingState;
  facets: Facets;
  onChange: (next: ListingState) => void;
  idPrefix: string;
  className?: string;
}) {
  const [allBrands, setAllBrands] = useState(false);
  const set = (patch: Partial<ListingState>) => onChange({ ...value, ...patch, page: 1 });

  // Marcas escolhidas que não aparecem nas facetas continuam visíveis para poder desmarcar.
  const brandList = [...facets.brands];
  for (const slug of value.brands) if (!brandList.some((b) => b.slug === slug)) brandList.push({ slug, name: slug, count: 0 });
  const shownBrands = allBrands ? brandList : brandList.slice(0, 8);
  const voltages = facets.voltages.filter((v) => v.value !== "NA");
  const ranges = priceRanges(facets.price.minCents, facets.price.maxCents);
  const active = activeFilterCount(cfg, value);

  const toggleIn = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  return (
    <div className={cn("space-y-5", className)}>
      {active > 0 && (
        <button
          type="button"
          onClick={() => onChange(clearedListing(cfg, value))}
          className="flex h-10 items-center gap-2 text-sm font-medium text-primary hover:underline underline-offset-4"
        >
          <RotateCcw className="size-4" aria-hidden /> Limpar filtros ({active})
        </button>
      )}

      {!cfg.lockBrands && brandList.length > 0 && (
        <Group title="Marcas">
          <div className="space-y-0.5">
            {shownBrands.map((b) => (
              <CheckRow key={b.slug} label={b.name} count={b.count} checked={value.brands.includes(b.slug)} onChange={() => set({ brands: toggleIn(value.brands, b.slug) })} />
            ))}
          </div>
          {brandList.length > 8 && (
            <button type="button" onClick={() => setAllBrands((v) => !v)} className="mt-1 h-9 text-sm font-medium text-muted-foreground hover:text-primary">
              {allBrands ? "Mostrar menos" : `Ver todas as marcas (${brandList.length})`}
            </button>
          )}
        </Group>
      )}

      {voltages.length > 0 && (
        <Group title="Voltagem">
          <div className="flex flex-wrap gap-2">
            {voltages.map((v) => {
              const on = value.voltages.includes(v.value as VoltageFilter);
              return (
                <button
                  key={v.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ voltages: toggleIn(value.voltages, v.value as VoltageFilter) })}
                  className={cn(
                    "flex h-10 items-center gap-1.5 rounded-xl border px-3.5 text-sm transition-colors",
                    on ? "border-primary bg-primary-soft font-medium text-foreground" : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                  )}
                >
                  {v.label}
                  <span className="tabular text-xs text-subtle">{v.count}</span>
                </button>
              );
            })}
          </div>
        </Group>
      )}

      <Group title="Faixa de preço">
        <PriceInputs idPrefix={idPrefix} min={value.min} max={value.max} onCommit={(min, max) => set({ min, max })} />
        {ranges.length > 0 && (
          <div className="mt-3 space-y-0.5" role="group" aria-label="Faixas rápidas de preço">
            {ranges.map((r) => {
              const on = value.min === r.min && value.max === r.max;
              return (
                <button
                  key={r.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set(on ? { min: null, max: null } : { min: r.min, max: r.max })}
                  className={cn(
                    "flex min-h-10 w-full items-center gap-3 rounded-lg px-1 text-left text-sm transition-colors hover:bg-elevated",
                    on ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span className={cn("grid size-4.5 shrink-0 place-items-center rounded-full border", on ? "border-primary" : "border-border-strong")}>
                    {on && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                  {r.label}
                </button>
              );
            })}
          </div>
        )}
      </Group>

      <Group title="Mais filtros">
        <div className="space-y-4">
          {!cfg.lockOnSale && <Switch label="Só ofertas" description="Produtos com desconto agora" checked={value.onSale} onChange={(v) => set({ onSale: v })} />}
          <Switch label="Só com estoque" description="Esconde produtos esgotados" checked={value.inStock} onChange={(v) => set({ inStock: v })} />
          <Switch label="Frete grátis" description="Produtos com entrega grátis" checked={value.freeShipping} onChange={(v) => set({ freeShipping: v })} />
        </div>
      </Group>
    </div>
  );
}
