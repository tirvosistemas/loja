"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

// Menu de ações de uma linha (Editar, Duplicar, Excluir…). Abre num portal com posição
// fixa para não ser cortado pela rolagem da tabela. O conteúdo continua montado quando
// fechado, para que diálogos abertos a partir dele (ex.: confirmar exclusão) sigam abertos.

const CloseCtx = createContext<() => void>(() => {});

export const menuItemClass =
  "flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-normal text-foreground transition-colors hover:bg-elevated focus-visible:bg-elevated focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-subtle";

export function RowMenu({ label = "Mais ações", children, className }: { label?: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open || !button.current || !menu.current) return;
    const r = button.current.getBoundingClientRect();
    const h = menu.current.offsetHeight;
    const w = menu.current.offsetWidth;
    const below = r.bottom + 6 + h <= window.innerHeight - 8;
    const top = below || r.top - 6 - h < 8 ? Math.min(r.bottom + 6, window.innerHeight - h - 8) : r.top - 6 - h;
    const left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
    setPos({ top: Math.max(8, top), left });
  }, [open]);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menu.current?.contains(t) || button.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onMove = () => setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    const raf = requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus());
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[next]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          open && "bg-elevated text-foreground",
          className,
        )}
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      {mounted &&
        createPortal(
          <CloseCtx.Provider value={close}>
            <div
              ref={menu}
              id={id}
              role="menu"
              aria-label={label}
              hidden={!open}
              onKeyDown={onMenuKey}
              style={{ position: "fixed", top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}
              className="z-[90] w-56 animate-fade-in rounded-2xl border border-border bg-card p-1.5 shadow-card"
            >
              {children}
            </div>
          </CloseCtx.Provider>,
          document.body,
        )}
    </>
  );
}

export function MenuItem({
  href,
  external,
  onSelect,
  icon,
  children,
  disabled,
}: {
  href?: string;
  external?: boolean;
  onSelect?: () => void;
  icon?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}) {
  const close = useContext(CloseCtx);
  if (href) {
    return external ? (
      <a role="menuitem" href={href} target="_blank" rel="noopener noreferrer" onClick={close} className={menuItemClass}>
        {icon}
        {children}
      </a>
    ) : (
      <Link role="menuitem" href={href} onClick={close} className={menuItemClass}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <button
      role="menuitem"
      type="button"
      disabled={disabled}
      onClick={() => {
        close();
        onSelect?.();
      }}
      className={menuItemClass}
    >
      {icon}
      {children}
    </button>
  );
}

/** Fecha o menu ao clicar em algo dentro dele (ex.: um ConfirmButton). */
export function MenuSlot({ children }: { children: ReactNode }) {
  const close = useContext(CloseCtx);
  return <div onClick={close}>{children}</div>;
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}
