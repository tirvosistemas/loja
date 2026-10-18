"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = "md",
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  // Botões com no mínimo 40px de toque, também na versão compacta (gaveta e carrinho).
  const h = size === "sm" ? "h-10" : "h-11";
  const w = "w-10";
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-xl border border-border bg-card transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25",
        h,
        className,
      )}
    >
      <button type="button" aria-label="Diminuir" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className={cn("grid h-full place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40", w)}>
        <Minus className="size-4" aria-hidden />
      </button>
      <input
        aria-label="Quantidade"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, "") || "0", 10);
          if (n >= min && n <= max) onChange(n);
        }}
        className="tabular h-full w-9 bg-transparent text-center text-sm font-semibold outline-none"
      />
      <button type="button" aria-label="Aumentar" disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className={cn("grid h-full place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40", w)}>
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
