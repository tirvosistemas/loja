"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Atualiza a página do pedido a cada 30 s (e ao voltar para a aba) enquanto ele está em andamento. */
export function AutoRefresh({ active, intervalMs = 30_000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [active, intervalMs, router]);
  return null;
}
