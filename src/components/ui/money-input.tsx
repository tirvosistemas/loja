"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Campo de valor em reais. Recebe e devolve centavos (número inteiro).
// Digitação estilo maquininha: "12990" → R$ 129,90.
export function MoneyInput({
  value,
  onChange,
  allowEmpty,
  placeholder = "0,00",
  className,
  id,
  disabled,
  "aria-invalid": invalid,
}: {
  value: number | null;
  onChange: (cents: number | null) => void;
  allowEmpty?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  "aria-invalid"?: boolean;
}) {
  const fmt = (c: number | null) => (c == null ? "" : (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const [text, setText] = useState(fmt(value));
  useEffect(() => setText(fmt(value)), [value]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-subtle">R$</span>
      <input
        id={id}
        inputMode="numeric"
        disabled={disabled}
        aria-invalid={invalid}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 11);
          if (!digits) {
            setText("");
            onChange(allowEmpty ? null : 0);
            return;
          }
          const cents = parseInt(digits, 10);
          setText(fmt(cents));
          onChange(cents);
        }}
        className={cn(
          "tabular h-11 w-full rounded-xl border border-input bg-card pl-10 pr-3.5 text-[15px] text-foreground placeholder:text-subtle hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60 aria-[invalid=true]:border-danger",
          className,
        )}
      />
    </div>
  );
}
