"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/switch";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BrandOption, CategoryOption } from "./data";

type Option = { id: string; label: string; depth?: number; muted?: boolean; note?: string };

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Lista de caixas de seleção com busca (categorias, marcas). */
export function OptionMultiSelect({
  options,
  value,
  onChange,
  noun,
  emptyText,
  onToggle,
  invalid,
  id,
  describedBy,
}: {
  options: Option[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** ["categoria", "categorias"] */
  noun: [string, string];
  emptyText: string;
  /** Permite marcar/desmarcar outros itens junto (ex.: subcategorias). */
  onToggle?: (id: string, checked: boolean, current: string[]) => string[];
  invalid?: boolean;
  id?: string;
  describedBy?: string;
}) {
  const [q, setQ] = useState("");
  const selected = useMemo(() => new Set(value), [value]);
  const visible = useMemo(() => {
    const t = normalize(q.trim());
    return t ? options.filter((o) => normalize(o.label).includes(t)) : options;
  }, [q, options]);

  if (!options.length) {
    return <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  const toggle = (oid: string, checked: boolean) => {
    if (onToggle) return onChange(onToggle(oid, checked, value));
    onChange(checked ? [...value, oid] : value.filter((x) => x !== oid));
  };
  const allVisibleSelected = visible.length > 0 && visible.every((o) => selected.has(o.id));
  const toggleVisible = () => {
    const ids = new Set(visible.map((o) => o.id));
    onChange(allVisibleSelected ? value.filter((x) => !ids.has(x)) : Array.from(new Set([...value, ...ids])));
  };

  return (
    <div id={id} aria-describedby={describedBy} className={cn("rounded-xl border bg-card", invalid ? "border-danger" : "border-border")}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
        {options.length > 6 && (
          <div className="relative min-w-0 flex-1 basis-48">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Filtrar ${noun[1]}`}
              aria-label={`Filtrar ${noun[1]}`}
              className="h-10 w-full rounded-lg border border-transparent bg-elevated pl-9 pr-3 text-sm placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <span className="tabular px-1 text-[13px] text-muted-foreground" aria-live="polite">
            {value.length ? pluralize(value.length, `${noun[0]} marcada`, `${noun[1]} marcadas`) : "Nenhuma marcada"}
          </span>
          {visible.length > 0 && (
            <button type="button" onClick={toggleVisible} className="h-10 rounded-lg px-2.5 text-[13px] font-medium text-primary hover:bg-primary-soft">
              {allVisibleSelected ? "Desmarcar" : "Marcar"} {q ? "visíveis" : "todas"}
            </button>
          )}
        </div>
      </div>
      <ul className="max-h-72 overflow-y-auto p-1.5" aria-label={noun[1][0].toUpperCase() + noun[1].slice(1)}>
        {visible.map((o) => (
          <li key={o.id}>
            <Checkbox
              checked={selected.has(o.id)}
              onChange={(c) => toggle(o.id, c)}
              className="min-h-10 rounded-lg px-2 py-1.5 hover:bg-elevated"
              label={
                <span className="flex min-w-0 items-center gap-2" style={o.depth ? { paddingLeft: `${Math.min(o.depth, 4) * 14}px` } : undefined}>
                  <span className={cn("truncate", o.muted && "text-muted-foreground")}>{o.label}</span>
                  {o.note && <span className="shrink-0 rounded-md border border-border px-1.5 text-[10.5px] uppercase tracking-wide text-subtle">{o.note}</span>}
                </span>
              }
            />
          </li>
        ))}
        {visible.length === 0 && <li className="px-3 py-5 text-center text-sm text-muted-foreground">Nada encontrado para “{q}”.</li>}
      </ul>
    </div>
  );
}

/** Ids de todas as subcategorias (filhas, netas…) de uma categoria. */
function descendants(options: CategoryOption[], rootId: string) {
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of options) {
      if (c.parentId === cur && !out.includes(c.id)) {
        out.push(c.id);
        stack.push(c.id);
      }
    }
  }
  return out;
}

/** Categorias em árvore. Marcar uma categoria marca também as subcategorias dela. */
export function CategoryMultiSelect({
  options,
  value,
  onChange,
  invalid,
  id,
  describedBy,
}: {
  options: CategoryOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  invalid?: boolean;
  id?: string;
  describedBy?: string;
}) {
  const opts = useMemo(
    () => options.map((c) => ({ id: c.id, label: c.depth ? c.name : c.label, depth: c.depth, muted: !c.active, note: c.active ? undefined : "oculta" })),
    [options],
  );
  return (
    <OptionMultiSelect
      id={id}
      describedBy={describedBy}
      options={opts}
      value={value}
      onChange={onChange}
      invalid={invalid}
      noun={["categoria", "categorias"]}
      emptyText="Nenhuma categoria cadastrada ainda. Crie as categorias em Catálogo → Categorias."
      onToggle={(cid, checked, current) => {
        const group = [cid, ...descendants(options, cid)];
        return checked ? Array.from(new Set([...current, ...group])) : current.filter((x) => !group.includes(x));
      }}
    />
  );
}

export function BrandMultiSelect({
  options,
  value,
  onChange,
  invalid,
  id,
  describedBy,
}: {
  options: BrandOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  invalid?: boolean;
  id?: string;
  describedBy?: string;
}) {
  const opts = useMemo(() => options.map((b) => ({ id: b.id, label: b.name, muted: !b.active, note: b.active ? undefined : "oculta" })), [options]);
  return (
    <OptionMultiSelect
      id={id}
      describedBy={describedBy}
      options={opts}
      value={value}
      onChange={onChange}
      invalid={invalid}
      noun={["marca", "marcas"]}
      emptyText="Nenhuma marca cadastrada ainda. Crie as marcas em Catálogo → Marcas."
    />
  );
}
