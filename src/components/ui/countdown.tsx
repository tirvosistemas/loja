"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Contagem regressiva até `endsAt` (ISO). Mostra "--" até montar no navegador. */
export function Countdown({ endsAt, className, compact }: { endsAt: string; className?: string; compact?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = now == null ? null : parts(new Date(endsAt).getTime() - now);
  const pad = (n?: number) => (n == null ? "--" : String(n).padStart(2, "0"));
  const blocks = [
    ...(p && p.d > 0 ? [{ v: String(p.d), l: "dias" }] : []),
    { v: pad(p?.h), l: "h" },
    { v: pad(p?.m), l: "min" },
    { v: pad(p?.s), l: "s" },
  ];
  if (compact) {
    return (
      <span className={cn("tabular font-mono text-sm", className)} aria-live="off">
        {p && p.d > 0 ? `${p.d}d ` : ""}
        {pad(p?.h)}:{pad(p?.m)}:{pad(p?.s)}
      </span>
    );
  }
  return (
    <div className={cn("flex items-center gap-1.5", className)} aria-label="Tempo restante da oferta">
      {blocks.map((b, i) => (
        <div key={i} className="flex items-baseline gap-0.5 rounded-lg border border-border bg-elevated px-2 py-1">
          <span className="tabular font-mono text-base font-semibold text-foreground">{b.v}</span>
          <span className="text-[11px] text-subtle">{b.l}</span>
        </div>
      ))}
    </div>
  );
}
