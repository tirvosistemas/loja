"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

function useLockScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

function useFocusFirst(open: boolean, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>("[autofocus], input, select, textarea, button:not([data-close])");
      (el ?? ref.current)?.focus();
    }, 30);
    return () => {
      clearTimeout(t);
      prev?.focus?.();
    };
  }, [open, ref]);
}

/** Janela central (no celular vira uma folha que sobe de baixo). */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLockScroll(open);
  useEsc(open, onClose);
  useFocusFirst(open, ref);
  if (typeof document === "undefined") return null;
  const widths = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-4xl" };
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", damping: 30, stiffness: 380 }}
            className={cn(
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl outline-none sm:rounded-3xl",
              widths[size],
              className,
            )}
          >
            {(title || description) && (
              <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  {title && <h2 className="text-lg font-semibold">{title}</h2>}
                  {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
                </div>
                <button data-close type="button" onClick={onClose} aria-label="Fechar" className="-mr-2 grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground">
                  <X className="size-5" />
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
            {footer && <div className="safe-bottom flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4 sm:px-6">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Gaveta lateral (carrinho, menu, filtros). */
export function Sheet({
  open,
  onClose,
  side = "right",
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right" | "bottom";
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLockScroll(open);
  useEsc(open, onClose);
  useFocusFirst(open, ref);
  if (typeof document === "undefined") return null;
  const from = side === "left" ? { x: "-100%" } : side === "right" ? { x: "100%" } : { y: "100%" };
  const pos =
    side === "left"
      ? "inset-y-0 left-0 h-dvh w-[88vw] max-w-sm border-r"
      : side === "right"
        ? "inset-y-0 right-0 h-dvh w-[92vw] max-w-md border-l"
        : "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl border-t";
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100]">
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            initial={from}
            animate={{ x: 0, y: 0 }}
            exit={from}
            transition={{ type: "spring", damping: 34, stiffness: 340 }}
            className={cn("absolute flex flex-col border-border bg-background shadow-2xl outline-none", pos, className)}
          >
            {title !== undefined && (
              <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border px-5">
                <div className="min-w-0 text-base font-semibold">{title}</div>
                <button data-close type="button" onClick={onClose} aria-label="Fechar" className="-mr-2 grid size-10 place-items-center rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground">
                  <X className="size-5" />
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer && <div className="safe-bottom shrink-0 border-t border-border bg-card px-5 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
