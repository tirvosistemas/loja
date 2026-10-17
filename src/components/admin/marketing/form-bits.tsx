"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Contador de caracteres ("32/50"), em alerta quando passa do limite. */
export function CharCount({ value, max, className }: { value: string; max: number; className?: string }) {
  const n = [...value].length;
  return (
    <span className={cn("tabular text-xs", n > max ? "font-medium text-danger" : n > max * 0.9 ? "text-warning" : "text-subtle", className)} aria-live="polite">
      {n}/{max}
    </span>
  );
}

/** Rótulo de campo com contador à direita. */
export function LabelWithCount({ children, value, max, required }: { children: ReactNode; value: string; max: number; required?: boolean }) {
  return (
    <span className="flex items-baseline justify-between gap-2">
      <span>
        {children}
        {required && <span className="ml-0.5 text-primary">*</span>}
      </span>
      <CharCount value={value} max={max} />
    </span>
  );
}

/** Opções em cartões (rádio). Setas do teclado funcionam como num grupo de rádio nativo. */
export function ChoiceCards<T extends string>({
  name,
  value,
  onChange,
  options,
  columns = 2,
  legend,
  className,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; hint?: ReactNode; icon?: ReactNode; disabled?: boolean }[];
  columns?: 2 | 3 | 4;
  legend?: ReactNode;
  className?: string;
}) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 2xl:grid-cols-4" }[columns];
  return (
    <fieldset className={className}>
      {legend && <legend className="mb-1.5 text-sm font-medium">{legend}</legend>}
      <div className={cn("grid gap-2", cols)}>
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                "relative flex min-h-12 cursor-pointer gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40",
                checked ? "border-primary bg-primary-soft" : "border-border hover:border-border-strong",
                o.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.icon && <span className={cn("mt-0.5 shrink-0 [&_svg]:size-4.5", checked ? "text-primary" : "text-subtle")}>{o.icon}</span>}
              <span className="min-w-0">
                <span className="block text-sm font-medium">{o.label}</span>
                {o.hint && <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{o.hint}</span>}
              </span>
              <span
                aria-hidden
                className={cn(
                  "ml-auto mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full border",
                  checked ? "border-primary bg-primary" : "border-border-strong",
                )}
              >
                {checked && <span className="size-1.5 rounded-full bg-primary-foreground" />}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
