"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Star, X } from "lucide-react";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PRODUCT_SORTS, STOCK_FILTERS } from "./filters";

// A busca (?q=) fica com o SearchBox; aqui ficam categoria, marca, estoque, destaque e ordem.
const FILTER_KEYS = ["categoria", "marca", "estoque", "destaque"];

export function ProductFiltersBar({
  categories,
  brands,
}: {
  categories: { id: string; label: string }[];
  brands: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const active = FILTER_KEYS.some((k) => sp.get(k));
  const featured = sp.get("destaque") === "1";

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
        <Select aria-label="Categoria" value={sp.get("categoria") ?? ""} onChange={(e) => set({ categoria: e.target.value || null })} className="sm:w-52">
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
          <option value="sem">Sem categoria</option>
        </Select>
        <Select aria-label="Marca" value={sp.get("marca") ?? ""} onChange={(e) => set({ marca: e.target.value || null })} className="sm:w-44">
          <option value="">Todas as marcas</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
          <option value="sem">Sem marca</option>
        </Select>
        <Select aria-label="Estoque" value={sp.get("estoque") ?? ""} onChange={(e) => set({ estoque: e.target.value || null })} className="sm:w-44">
          <option value="">Qualquer estoque</option>
          {STOCK_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Ordenar por" value={sp.get("ordem") ?? "recentes"} onChange={(e) => set({ ordem: e.target.value === "recentes" ? null : e.target.value })} className="sm:w-44">
          {PRODUCT_SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={featured}
          onClick={() => set({ destaque: featured ? null : "1" })}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors",
            featured ? "border-primary/50 bg-primary-soft text-foreground" : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
          )}
        >
          <Star className={cn("size-4", featured ? "fill-primary text-primary" : "text-subtle")} aria-hidden />
          Destaques
        </button>
        {active && (
          <button
            type="button"
            onClick={() => set(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
          >
            <X className="size-4" aria-hidden /> Limpar filtros
          </button>
        )}
        {pending && <Loader2 className="size-4 animate-spin text-subtle" aria-label="Carregando" />}
      </div>
    </div>
  );
}
