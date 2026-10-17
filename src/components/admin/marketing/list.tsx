import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Lista em linhas que vira tabela em telas largas (xl) e cartões empilhados no celular,
// sem rolagem lateral. Cada célula leva o próprio rótulo (visível só no celular).

export function ListShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>{children}</div>;
}

export function ListHeader({ cols, labels }: { cols: string; labels: string[] }) {
  return (
    <div aria-hidden className={cn("hidden gap-4 border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-wider text-subtle xl:grid", cols)}>
      {labels.map((l, i) => (
        <span key={l} className={i === labels.length - 1 ? "text-right" : undefined}>
          {l}
        </span>
      ))}
    </div>
  );
}

export function ListRow({ cols, children }: { cols: string; children: ReactNode }) {
  return (
    <div className={cn("grid gap-3 border-b border-border px-4 py-4 transition-colors last:border-0 hover:bg-elevated/40 xl:items-center xl:gap-4 xl:py-3", cols)}>{children}</div>
  );
}

/** Célula com rótulo: "Desconto  15%" no celular; só o valor na tabela. */
export function ListCell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-baseline gap-3 text-sm xl:block", className)}>
      <span className="w-24 shrink-0 text-[13px] text-subtle xl:sr-only">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
