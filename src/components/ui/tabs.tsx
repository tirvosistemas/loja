"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TabItem = { id: string; label: ReactNode; content: ReactNode; badge?: ReactNode };

export function Tabs({ items, defaultTab, className, onChange }: { items: TabItem[]; defaultTab?: string; className?: string; onChange?: (id: string) => void }) {
  const [active, setActive] = useState(defaultTab ?? items[0]?.id);
  const base = useId();
  return (
    <div className={className}>
      <div role="tablist" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border">
        {items.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`${base}-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`${base}-${t.id}-panel`}
            onClick={() => {
              setActive(t.id);
              onChange?.(t.id);
            }}
            className={cn(
              "relative -mb-px flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-medium transition-colors",
              active === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.badge}
          </button>
        ))}
      </div>
      {items.map((t) => (
        <div key={t.id} role="tabpanel" id={`${base}-${t.id}-panel`} aria-labelledby={`${base}-${t.id}`} hidden={active !== t.id} className="pt-5">
          {t.content}
        </div>
      ))}
    </div>
  );
}

/** Seletor em pílulas (ex.: entrega / retirada). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex rounded-xl border border-border bg-elevated p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
            value === o.value ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
