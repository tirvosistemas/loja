"use client";

import { useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action";

/** Executa uma server action com aviso (toast) e atualiza a página no fim. */
export function useAdminAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = useCallback(
    <T,>(fn: () => Promise<ActionResult<T>>, opts: { success?: string | false; onOk?: (data: T | undefined) => void; onError?: () => void } = {}) =>
      new Promise<boolean>((resolve) => {
        start(async () => {
          try {
            const r = await fn();
            if (!r.ok) {
              toast.error(r.error);
              opts.onError?.();
              resolve(false);
              return;
            }
            if (opts.success !== false) toast.success(opts.success ?? r.message ?? "Pronto.");
            opts.onOk?.(r.data);
            router.refresh();
            resolve(true);
          } catch {
            toast.error("Falha de conexão. Tente de novo.");
            opts.onError?.();
            resolve(false);
          }
        });
      }),
    [router],
  );
  return { pending, run };
}

/**
 * Avisa antes de sair com alterações não salvas: fechar/recarregar a aba e cliques
 * em links internos (menu do painel, voltar…).
 */
export function useUnsavedGuard(dirty: boolean, message = "Você tem alterações não salvas. Sair mesmo assim?") {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.dataset.noGuard !== undefined) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message]);
}
