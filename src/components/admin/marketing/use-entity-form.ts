"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action";

/**
 * Estado de um formulário de cadastro (banner, promoção, cupom) salvo por server action.
 * Mostra os erros por campo, leva o foco ao primeiro erro e avisa ao sair sem salvar.
 */
export function useEntityForm<T extends Record<string, unknown>, R = unknown>(
  initial: T,
  save: (values: T) => Promise<ActionResult<R>>,
  opts: { onSaved?: (data: R | undefined, values: T, message?: string) => void } = {},
) {
  const router = useRouter();
  const [values, setValues] = useState<T>(initial);
  const [saved, setSaved] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);
  const leaving = useRef(false);

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const { [key as string]: _removed, ...rest } = e;
      return rest;
    });
  }, []);

  const patch = useCallback((p: Partial<T>) => setValues((v) => ({ ...v, ...p })), []);

  useUnsavedGuard(dirty, leaving);

  const submit = (e?: { preventDefault(): void }) => {
    e?.preventDefault();
    start(async () => {
      let r: ActionResult<R>;
      try {
        r = await save(values);
      } catch {
        toast.error("Falha de conexão. Tente de novo.");
        return;
      }
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        const first = Object.keys(r.fieldErrors ?? {})[0];
        if (first) {
          requestAnimationFrame(() => {
            const box = document.querySelector<HTMLElement>(`[data-field="${first}"]`);
            box?.scrollIntoView({ behavior: "smooth", block: "center" });
            box?.querySelector<HTMLElement>("input, textarea, select, button")?.focus({ preventScroll: true });
          });
        }
        return;
      }
      setErrors({});
      setSaved(values);
      leaving.current = true;
      if (opts.onSaved) opts.onSaved(r.data, values, r.message);
      else {
        toast.success(r.message ?? "Salvo.");
        router.refresh();
      }
      // Libera o aviso de saída depois que a navegação (se houver) começar.
      setTimeout(() => (leaving.current = false), 1500);
    });
  };

  const reset = () => {
    setValues(saved);
    setErrors({});
  };

  return { values, set, patch, errors, setErrors, pending, dirty, submit, reset };
}

/** Avisa antes de sair com alterações não salvas (fechar a aba e cliques em links internos). */
export function useUnsavedGuard(dirty: boolean, skip?: { current: boolean }) {
  useEffect(() => {
    if (!dirty) return;
    const message = "Você tem alterações não salvas. Sair mesmo assim?";
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (skip?.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (skip?.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
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
  }, [dirty, skip]);
}
