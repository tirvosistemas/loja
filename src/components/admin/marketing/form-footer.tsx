"use client";

import type { ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Barra fixa no rodapé dos formulários de cadastro, com “Salvar” e “Desfazer”. */
export function FormFooter({
  dirty,
  pending,
  onReset,
  submitLabel,
  cancel,
  disabled,
  isNew,
}: {
  dirty: boolean;
  pending: boolean;
  onReset: () => void;
  submitLabel: string;
  cancel?: ReactNode;
  disabled?: boolean;
  /** Cadastro novo: ainda não existe nada salvo. */
  isNew?: boolean;
}) {
  return (
    <div className="safe-bottom sticky bottom-0 z-20 -mx-4 mt-6 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <span aria-hidden className={cn("size-2 shrink-0 rounded-full", isNew ? "bg-subtle" : dirty ? "animate-pulse-dot bg-primary" : "bg-success")} />
          <span className="truncate">{isNew ? "Ainda não salvo" : dirty ? "Alterações não salvas" : "Tudo salvo"}</span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {dirty ? (
            <Button type="button" variant="ghost" onClick={onReset} disabled={pending} aria-label="Desfazer alterações">
              <RotateCcw aria-hidden /> <span className="hidden sm:inline">Desfazer</span>
            </Button>
          ) : (
            cancel
          )}
          <Button type="submit" loading={pending} disabled={disabled}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
