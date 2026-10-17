"use client";

import { createContext, useCallback, useContext, useMemo, useOptimistic, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ListingConfig, ListingState } from "./params";
import { listingHref } from "./params";
import { cn } from "@/lib/utils";

// Navegação das listagens: aplica filtros na URL sem rolar a página. O estado novo
// aparece na hora (otimista) e os resultados ficam esmaecidos até o servidor responder.

type Ctx = {
  cfg: ListingConfig;
  state: ListingState;
  pending: boolean;
  apply: (next: ListingState) => void;
};

const CatalogCtx = createContext<Ctx | null>(null);

export function CatalogNavProvider({ cfg, state, children }: { cfg: ListingConfig; state: ListingState; children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(state, (_current: ListingState, next: ListingState) => next);
  const apply = useCallback(
    (next: ListingState) =>
      start(() => {
        setOptimistic(next);
        router.push(listingHref(cfg, next, { page: next.page }), { scroll: false });
      }),
    [cfg, router, setOptimistic],
  );
  const value = useMemo(() => ({ cfg, state: optimistic, pending, apply }), [cfg, optimistic, pending, apply]);
  return <CatalogCtx.Provider value={value}>{children}</CatalogCtx.Provider>;
}

export function useCatalogNav() {
  const ctx = useContext(CatalogCtx);
  if (!ctx) throw new Error("useCatalogNav precisa do CatalogNavProvider");
  return ctx;
}

/** Área dos resultados: fica esmaecida enquanto a nova listagem carrega. */
export function CatalogResults({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useCatalogNav();
  return (
    <div aria-busy={pending} className={cn("relative transition-opacity duration-200", pending && "pointer-events-none opacity-50", className)}>
      {pending && (
        <div
          role="progressbar"
          aria-label="Carregando produtos"
          className="absolute inset-x-0 -top-3 z-10 h-0.5 animate-shimmer rounded-full bg-[linear-gradient(90deg,transparent_0%,var(--primary)_50%,transparent_100%)] bg-[length:200%_100%]"
        />
      )}
      {children}
    </div>
  );
}
