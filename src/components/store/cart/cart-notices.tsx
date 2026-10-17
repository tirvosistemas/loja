"use client";

import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Avisos do servidor sobre o carrinho (estoque, preço, item indisponível). */
export function CartNotices({ notices, onDismiss, className }: { notices: string[]; onDismiss: () => void; className?: string }) {
  if (notices.length === 0) return null;
  return (
    <div role="alert" className={cn("flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3.5", className)}>
      <AlertTriangle className="mt-0.5 size-4.5 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-foreground">Atualizamos seu carrinho</p>
        <ul className="mt-1 space-y-0.5 text-muted-foreground">
          {notices.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar aviso"
        className="-mr-1.5 -mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** Falha ao falar com o servidor: mostra os valores guardados e oferece tentar de novo. */
export function QuoteError({ message, onRetry, className }: { message: string; onRetry: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-wrap items-center gap-3 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm", className)}>
      <AlertTriangle className="size-4.5 shrink-0 text-danger" aria-hidden />
      <p className="min-w-0 flex-1">
        {message} <span className="text-muted-foreground">Os valores podem estar desatualizados.</span>
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 font-medium text-foreground hover:bg-elevated"
      >
        <RefreshCw className="size-4" aria-hidden /> Tentar de novo
      </button>
    </div>
  );
}
