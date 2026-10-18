"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, ChevronDown, LayoutGrid, Sparkles } from "lucide-react";
import type { MenuCategory } from "@/lib/catalog";
import { CategoryIcon } from "@/components/ui/category-icon";
import { SmartImage } from "@/components/ui/smart-image";
import { cn } from "@/lib/utils";

/** Segunda linha do cabeçalho (computador): menu de categorias, atalhos e destaques. */
export function CategoryNav({ categories }: { categories: MenuCategory[] }) {
  const pathname = usePathname();
  const panelId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const quickRef = useRef<HTMLUListElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverOpened = useRef(false);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(categories[0]?.id ?? null);
  const active = categories.find((c) => c.id === activeId) ?? categories[0];

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const openSoon = () => {
    clearTimer();
    timer.current = setTimeout(() => {
      setOpen((o) => {
        if (!o) hoverOpened.current = true;
        return true;
      });
    }, 120);
  };
  const closeSoon = () => {
    clearTimer();
    timer.current = setTimeout(() => setOpen(false), 180);
  };
  const close = useCallback((focusTrigger = false) => {
    clearTimer();
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  useEffect(() => close(), [pathname, close]);

  // Atalhos de categoria: só os que cabem inteiros na linha. Os que quebram para a linha de
  // baixo (cortada pelo overflow) ficam invisíveis e fora do Tab; todos estão no menu ao lado.
  useEffect(() => {
    const ul = quickRef.current;
    if (!ul) return;
    const fit = () => {
      for (const li of Array.from(ul.children) as HTMLElement[]) li.style.visibility = li.offsetTop > 4 ? "hidden" : "";
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(ul);
    return () => ro.disconnect();
  }, [categories]);
  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const focusItem = (index: number) => {
    const links = listRef.current?.querySelectorAll<HTMLAnchorElement>("[data-cat-link]");
    if (!links?.length) return;
    const i = (index + links.length) % links.length;
    links[i].focus();
  };

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => focusItem(0));
    }
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const links = Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>("[data-cat-link]") ?? []);
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(current + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(current - 1);
    } else if (e.key === "ArrowRight") {
      const first = document.getElementById(`${panelId}-sub`)?.querySelector<HTMLAnchorElement>("a");
      if (first) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <nav aria-label="Categorias" className="container-page flex h-12 items-center gap-2">
      {categories.length > 0 && (
        <div
          ref={wrapRef}
          className="shrink-0"
          onMouseEnter={openSoon}
          onMouseLeave={closeSoon}
          onKeyDown={(e) => {
            if (e.key === "Escape" && open) {
              e.preventDefault();
              close(true);
            }
          }}
          onBlur={(e) => {
            if (!wrapRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
          }}
        >
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            aria-haspopup="true"
            onClick={() => {
              clearTimer();
              // Se abriu pelo mouse, o clique "fixa" o menu em vez de fechar.
              if (open && hoverOpened.current) {
                hoverOpened.current = false;
                return;
              }
              hoverOpened.current = false;
              setOpen(!open);
            }}
            onKeyDown={onTriggerKey}
            className={cn(
              "flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors",
              open ? "bg-inverse text-inverse-foreground" : "bg-elevated text-foreground hover:bg-muted",
            )}
          >
            <LayoutGrid className="size-4" aria-hidden />
            Todas as categorias
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
          </button>

          <div
            id={panelId}
            hidden={!open}
            className="absolute inset-x-0 top-full z-50 border-b border-border bg-background/95 shadow-2xl backdrop-blur-xl animate-fade-in"
          >
            <div className="container-page grid grid-cols-[260px_1fr] gap-6 py-6 xl:grid-cols-[280px_1fr_280px]">
              <ul ref={listRef} onKeyDown={onListKey} className="max-h-[60dvh] space-y-0.5 overflow-y-auto border-r border-border pr-4">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      data-cat-link
                      href={`/categoria/${c.slug}`}
                      onMouseEnter={() => setActiveId(c.id)}
                      onFocus={() => setActiveId(c.id)}
                      aria-current={pathname === `/categoria/${c.slug}` ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                        active?.id === c.id ? "bg-elevated text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <CategoryIcon name={c.icon} className={cn("size-[18px] shrink-0", active?.id === c.id ? "text-primary" : "text-subtle")} />
                      <span className="flex-1 truncate">{c.name}</span>
                      {c.children.length > 0 && <ArrowRight aria-hidden className="size-3.5 text-subtle" />}
                    </Link>
                  </li>
                ))}
              </ul>

              {active && (
                <div id={`${panelId}-sub`} className="min-w-0">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.16em] text-subtle">Categoria</p>
                      <p className="mt-1 text-xl font-semibold">{active.name}</p>
                    </div>
                    <Link href={`/categoria/${active.slug}`} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                      Ver tudo <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </div>
                  {active.children.length > 0 ? (
                    <ul className="grid grid-cols-2 gap-1 lg:grid-cols-3">
                      {active.children.map((ch) => (
                        <li key={ch.id}>
                          <Link
                            href={`/categoria/${ch.slug}`}
                            className="flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
                          >
                            <span aria-hidden className="size-1 rounded-full bg-border-strong" />
                            {ch.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Link
                      href={`/categoria/${active.slug}`}
                      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-border-strong"
                    >
                      <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-well text-zinc-800">
                        {active.image ? (
                          <SmartImage src={active.image} alt="" size="sm" sizes="64px" className="size-full object-cover" />
                        ) : (
                          <CategoryIcon name={active.icon} className="size-7" />
                        )}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Veja todos os produtos de <b className="text-foreground">{active.name}</b>, com frete calculado na hora para Curitiba e região.
                      </span>
                    </Link>
                  )}
                </div>
              )}

              <Link
                href="/ofertas"
                className="relative hidden overflow-hidden rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 xl:block"
              >
                <span aria-hidden className="glow-orange absolute -right-16 -top-16 size-56" />
                <span className="relative flex h-full flex-col">
                  <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-primary">
                    <Sparkles className="size-3.5" aria-hidden /> Ofertas
                  </span>
                  <span className="mt-3 text-lg font-semibold leading-snug">Os melhores preços da semana estão aqui.</span>
                  <span className="mt-auto flex items-center gap-1.5 pt-6 text-sm font-medium text-primary">
                    Ver ofertas <ArrowRight className="size-4" aria-hidden />
                  </span>
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}

      <ul ref={quickRef} className="relative flex h-9 min-w-0 flex-1 flex-wrap items-center gap-x-0.5 overflow-hidden">
        {categories.slice(0, 8).map((c) => {
          const current = pathname === `/categoria/${c.slug}`;
          return (
            <li key={c.id} className="shrink-0">
              <Link
                href={`/categoria/${c.slug}`}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center rounded-lg px-3 text-sm transition-colors",
                  current ? "text-foreground" : "text-muted-foreground hover:bg-elevated hover:text-foreground",
                )}
              >
                {c.name}
              </Link>
            </li>
          );
        })}
      </ul>

      <ul className="flex shrink-0 items-center gap-1">
        <li>
          <Link
            href="/ofertas"
            aria-current={pathname === "/ofertas" ? "page" : undefined}
            className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-foreground transition-colors hover:bg-elevated"
          >
            <span aria-hidden className="size-2 rounded-full bg-primary animate-pulse-dot" />
            Ofertas
          </Link>
        </li>
        <li>
          <Link
            href="/lancamentos"
            aria-current={pathname === "/lancamentos" ? "page" : undefined}
            className="flex h-9 items-center rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-elevated"
          >
            Lançamentos
          </Link>
        </li>
      </ul>
    </nav>
  );
}
