"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Loader2, PackageSearch, Search, X } from "lucide-react";
import { imageUrl } from "@/lib/images";
import { formatBRL, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PickerProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  image: string | null;
  priceCents: number;
  stock: number;
  brand: string | null;
  category: string | null;
};

async function fetchProducts(params: Record<string, string>, signal?: AbortSignal): Promise<PickerProduct[]> {
  const res = await fetch(`/api/admin/products/search?${new URLSearchParams(params)}`, { signal, cache: "no-store" });
  const j = (await res.json().catch(() => ({}))) as { items?: PickerProduct[]; error?: string };
  if (!res.ok || !j.items) throw new Error(j.error || "Falha na busca.");
  return j.items;
}

/** Carrega produtos pelos ids (em lotes) — usado para mostrar os já escolhidos. */
export async function fetchProductsByIds(ids: string[]) {
  const out: PickerProduct[] = [];
  for (let i = 0; i < ids.length; i += 100) out.push(...(await fetchProducts({ ids: ids.slice(i, i + 100).join(",") })));
  return out;
}

export async function fetchProductBySlug(slug: string) {
  return (await fetchProducts({ slugs: slug }))[0] ?? null;
}

function Thumb({ src, className }: { src: string | null; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-well", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl(src, "sm")} alt="" loading="lazy" className="size-full object-contain p-0.5" />
    </span>
  );
}

function StatusTag({ status }: { status: PickerProduct["status"] }) {
  if (status === "ACTIVE") return null;
  return (
    <span className="rounded-md border border-border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-subtle">
      {status === "DRAFT" ? "Rascunho" : "Arquivado"}
    </span>
  );
}

/**
 * Seletor de produtos com busca. `value` é a lista de ids escolhidos.
 * Com `single`, escolhe um produto só (ex.: link de banner).
 */
export function ProductPicker({
  value,
  onChange,
  single,
  max = 500,
  id,
  invalid,
  describedBy,
  placeholder,
  knownItems,
}: {
  value: string[];
  onChange: (ids: string[], items: PickerProduct[]) => void;
  single?: boolean;
  max?: number;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  knownItems?: PickerProduct[];
}) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-input`;
  const listId = `${autoId}-list`;
  const cache = useRef(new Map<string, PickerProduct>((knownItems ?? []).map((p) => [p.id, p])));
  const [, bump] = useState(0);
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [loadingSelected, setLoadingSelected] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PickerProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  for (const p of knownItems ?? []) if (!cache.current.has(p.id)) cache.current.set(p.id, p);

  // Busca os dados dos ids escolhidos que ainda não conhecemos.
  const unknownKey = value.filter((v) => !cache.current.has(v) && !missing.has(v)).join(",");
  useEffect(() => {
    if (!unknownKey) return;
    let alive = true;
    const ids = unknownKey.split(",");
    setLoadingSelected(true);
    setLoadError(false);
    fetchProductsByIds(ids)
      .then((items) => {
        if (!alive) return;
        for (const p of items) cache.current.set(p.id, p);
        const found = new Set(items.map((p) => p.id));
        setMissing((m) => new Set([...m, ...ids.filter((x) => !found.has(x))]));
        bump((n) => n + 1);
      })
      .catch(() => alive && setLoadError(true))
      .finally(() => alive && setLoadingSelected(false));
    return () => {
      alive = false;
    };
  }, [unknownKey]);

  // Busca com atraso de digitação; sem texto, mostra os produtos editados por último.
  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(
      () => {
        setSearching(true);
        setSearchError(false);
        fetchProducts({ q: query.trim() }, ctrl.signal)
          .then((items) => {
            for (const p of items) cache.current.set(p.id, p);
            setResults(items);
            setActive(0);
          })
          .catch((e) => {
            if ((e as Error).name !== "AbortError") setSearchError(true);
          })
          .finally(() => {
            if (!ctrl.signal.aborted) setSearching(false);
          });
      },
      query ? 250 : 0,
    );
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const selectedSet = useMemo(() => new Set(value), [value]);
  const itemsFor = useCallback((ids: string[]) => ids.map((x) => cache.current.get(x)).filter((p): p is PickerProduct => !!p), []);

  const toggle = (p: PickerProduct) => {
    if (single) {
      onChange([p.id], [p]);
      setOpen(false);
      setQuery("");
      return;
    }
    const next = selectedSet.has(p.id) ? value.filter((x) => x !== p.id) : value.length >= max ? value : [...value, p.id];
    onChange(next, itemsFor(next));
  };
  const remove = (pid: string) => {
    const next = value.filter((x) => x !== pid);
    onChange(next, itemsFor(next));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (open && results[active]) {
        e.preventDefault();
        toggle(results[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
    }
  };

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, listId]);

  const selected = value.map((x) => ({ id: x, item: cache.current.get(x) ?? null }));

  return (
    <div ref={box} className="space-y-2.5">
      {single && selected[0] ? (
        <SelectedRow entry={selected[0]} missing={missing.has(selected[0].id)} failed={loadError} onRemove={() => remove(selected[0].id)} />
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        <input
          ref={input}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          value={query}
          placeholder={placeholder ?? (single ? (value.length ? "Buscar outro produto…" : "Buscar produto pelo nome ou SKU…") : "Buscar e adicionar produtos…")}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-10 text-[15px] text-foreground placeholder:text-subtle transition-colors hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 aria-[invalid=true]:border-danger"
        />
        {searching && open && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-subtle" aria-hidden />}

        {open && (
          <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-border-strong bg-card shadow-2xl animate-fade-in">
            {!query && !searching && results.length > 0 && (
              <p className="border-b border-border px-3 py-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle">Editados recentemente</p>
            )}
            <ul id={listId} role="listbox" aria-label="Produtos encontrados" aria-multiselectable={!single || undefined} className="max-h-80 overflow-y-auto p-1.5">
              {results.map((p, i) => {
                const isSel = selectedSet.has(p.id);
                return (
                  <li
                    key={p.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={isSel}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => toggle(p)}
                    onMouseMove={() => setActive(i)}
                    className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5", i === active ? "bg-elevated" : "")}
                  >
                    <Thumb src={p.image} className="size-10" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">{p.name}</span>
                        <StatusTag status={p.status} />
                      </span>
                      <span className="block truncate text-xs text-subtle">{[p.sku && `SKU ${p.sku}`, p.brand, p.category].filter(Boolean).join(" · ") || "Sem SKU"}</span>
                    </span>
                    <span className="tabular shrink-0 text-sm text-muted-foreground">{formatBRL(p.priceCents)}</span>
                    <span
                      aria-hidden
                      className={cn("grid size-5 shrink-0 place-items-center rounded-md border", isSel ? "border-primary bg-primary text-primary-foreground" : "border-border-strong")}
                    >
                      {isSel && <Check className="size-3.5" />}
                    </span>
                  </li>
                );
              })}
            </ul>
            {!searching && !searchError && results.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-muted-foreground">
                <PackageSearch className="size-5 text-subtle" aria-hidden />
                {query ? `Nenhum produto encontrado para “${query}”.` : "Nenhum produto cadastrado ainda."}
              </div>
            )}
            {searchError && <p className="px-4 py-4 text-sm text-danger">Não foi possível buscar agora. Tente de novo.</p>}
            {!single && value.length >= max && <p className="border-t border-border px-3 py-2 text-xs text-warning">Limite de {max} produtos atingido.</p>}
          </div>
        )}
      </div>

      {!single && value.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[13px] text-muted-foreground" aria-live="polite">
              {pluralize(value.length, "produto escolhido", "produtos escolhidos")}
              {loadingSelected && " · carregando…"}
            </p>
            {value.length > 1 && (
              <button type="button" onClick={() => onChange([], [])} className="h-10 rounded-lg px-2 text-[13px] text-muted-foreground hover:text-danger sm:h-8">
                Limpar seleção
              </button>
            )}
          </div>
          <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-0.5">
            {selected.map((s) => (
              <li key={s.id}>
                <SelectedRow entry={s} missing={missing.has(s.id)} failed={loadError} onRemove={() => remove(s.id)} compact />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SelectedRow({
  entry,
  missing,
  failed,
  onRemove,
  compact,
}: {
  entry: { id: string; item: PickerProduct | null };
  missing: boolean;
  failed?: boolean;
  onRemove: () => void;
  compact?: boolean;
}) {
  const p = entry.item;
  const name = p?.name ?? (missing ? "Produto excluído" : failed ? "Não foi possível carregar" : "Carregando…");
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-border bg-elevated/40 pl-2", compact ? "py-1.5 pr-1" : "py-2 pr-1.5")}>
      <Thumb src={p?.image ?? null} className={compact ? "size-9" : "size-12"} />
      <div className="min-w-0 flex-1">
        <p className={cn("flex items-center gap-1.5 text-sm font-medium", missing && "text-danger")}>
          <span className="truncate">{name}</span>
          {p && <StatusTag status={p.status} />}
        </p>
        {p && (
          <p className="tabular truncate text-xs text-subtle">
            {formatBRL(p.priceCents)}
            {p.sku ? ` · SKU ${p.sku}` : ""}
            {p.brand ? ` · ${p.brand}` : ""}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover ${name}`}
        title="Remover"
        className="grid size-10 shrink-0 place-items-center rounded-lg text-subtle transition-colors hover:bg-danger-soft hover:text-danger"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
