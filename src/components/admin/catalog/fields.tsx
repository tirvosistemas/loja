"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { Wand2 } from "lucide-react";
import { CATEGORY_ICONS } from "@/components/ui/category-icon";
import { cn } from "@/lib/utils";

/** Contador de caracteres com limite recomendado. */
export function CharCount({ value, max, className }: { value: string; max: number; className?: string }) {
  const n = value.length;
  return (
    <span className={cn("tabular text-xs", n > max ? "font-medium text-warning" : "text-subtle", className)} aria-live="polite">
      {n}/{max}
    </span>
  );
}

/** Campo de URL amigável com o prefixo da rota (ex.: /produto/) e botão “gerar do nome”. */
export const SlugInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & { value: string; onChange: (v: string) => void; prefix: string; onGenerate?: () => void; invalid?: boolean }
>(function SlugInput({ value, onChange, prefix, onGenerate, invalid, className, ...props }, ref) {
  return (
    <div className="flex gap-2">
      <div
        className={cn(
          "flex h-11 min-w-0 flex-1 items-center rounded-xl border border-input bg-card text-[15px] transition-colors hover:border-border-strong focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25",
          invalid && "border-danger",
          className,
        )}
      >
        <span className="shrink-0 select-none pl-3.5 font-mono text-[13px] text-subtle">{prefix}</span>
        <input
          ref={ref}
          value={value}
          aria-invalid={invalid || undefined}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
          className="h-full min-w-0 flex-1 bg-transparent pr-3.5 font-mono text-[13.5px] text-foreground placeholder:text-subtle focus:outline-none"
          {...props}
        />
      </div>
      {onGenerate && (
        <button
          type="button"
          onClick={onGenerate}
          title="Gerar a partir do nome"
          aria-label="Gerar a URL a partir do nome"
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-elevated text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
        >
          <Wand2 className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
});

/** Grade de ícones das categorias (os mesmos exibidos na loja). */
export function IconPicker({ value, onChange, labelledBy }: { value: string | null; onChange: (v: string | null) => void; labelledBy?: string }) {
  const entries = Object.entries(CATEGORY_ICONS);
  const options: { key: string | null; label: string; Icon: (typeof CATEGORY_ICONS)[string]["icon"] | null }[] = [
    { key: null, label: "Nenhum", Icon: null },
    ...entries.map(([key, v]) => ({ key, label: v.label, Icon: v.icon })),
  ];
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const cols = 4;
    const map: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols };
    if (!(e.key in map)) return;
    e.preventDefault();
    const next = Math.min(options.length - 1, Math.max(0, i + map[e.key]));
    onChange(options[next].key);
    (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  };
  const selectedIndex = Math.max(0, options.findIndex((o) => o.key === value));
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
      {options.map((o, i) => {
        const checked = i === selectedIndex;
        return (
          <button
            key={o.key ?? "none"}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(o.key)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-center text-[11.5px] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              checked ? "border-primary bg-primary-soft text-foreground" : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            {o.Icon ? <o.Icon className={cn("size-5", checked ? "text-primary" : "text-subtle")} aria-hidden /> : <span aria-hidden className="grid size-5 place-items-center font-mono text-subtle">—</span>}
            <span className="line-clamp-2">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
