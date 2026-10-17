"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Seções do produto: abas no computador e sanfonas no celular, com o conteúdo
// renderizado uma única vez. Links para #avaliacoes abrem a seção certa.

export type ProductSection = { id: string; label: string; count?: number; content: ReactNode };

export function ProductSections({ sections }: { sections: ProductSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const [open, setOpen] = useState<Record<string, boolean>>({ [sections[0]?.id ?? ""]: true });
  const root = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollTo = useRef<string | null>(null);

  const reveal = (id: string, scroll: boolean) => {
    setActive(id);
    setOpen((o) => ({ ...o, [id]: true }));
    if (scroll) scrollTo.current = id;
  };

  // Rola até a seção depois que ela aparece.
  useEffect(() => {
    const id = scrollTo.current;
    if (!id) return;
    scrollTo.current = null;
    requestAnimationFrame(() => {
      const desktop = window.matchMedia("(min-width: 1024px)").matches;
      const el = desktop ? root.current : document.getElementById(id);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  useEffect(() => {
    const ids = new Set(sections.map((s) => s.id));
    const fromHash = () => {
      const h = decodeURIComponent(window.location.hash.slice(1));
      if (ids.has(h)) reveal(h, true);
    };
    fromHash();
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href^='#']");
      const h = a?.getAttribute("href")?.slice(1);
      if (!h || !ids.has(h)) return;
      e.preventDefault();
      history.replaceState(null, "", `#${h}`);
      reveal(h, true);
    };
    window.addEventListener("hashchange", fromHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = sections.length;
    const next = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setActive(sections[next].id);
    tabs.current[next]?.focus();
  };

  return (
    <div ref={root} className="scroll-mt-32 lg:scroll-mt-40">
      <div role="tablist" aria-label="Informações do produto" className="hidden gap-1 border-b border-border lg:flex">
        {sections.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`tab-${s.id}`}
            aria-selected={active === s.id}
            aria-controls={`panel-${s.id}`}
            tabIndex={active === s.id ? 0 : -1}
            onClick={() => setActive(s.id)}
            onKeyDown={(e) => onTabKey(e, i)}
            className={cn(
              "relative -mb-px flex h-12 items-center gap-2 border-b-2 px-4 text-[15px] font-medium transition-colors",
              active === s.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
            {s.count != null && s.count > 0 && <span className="tabular rounded-full bg-elevated px-2 py-0.5 text-xs text-muted-foreground">{s.count}</span>}
          </button>
        ))}
      </div>

      <div className="divide-y divide-border border-y border-border lg:divide-y-0 lg:border-0">
        {sections.map((s) => {
          const isOpen = !!open[s.id];
          return (
            <section key={s.id} id={s.id} className="scroll-mt-32 lg:scroll-mt-40" aria-labelledby={`acc-${s.id}`}>
              <h2 className="lg:hidden">
                <button
                  type="button"
                  id={`acc-${s.id}`}
                  aria-expanded={isOpen}
                  aria-controls={`panel-${s.id}`}
                  onClick={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
                  className="flex min-h-14 w-full items-center justify-between gap-3 py-3 text-left text-base font-semibold"
                >
                  <span className="flex items-center gap-2">
                    {s.label}
                    {s.count != null && s.count > 0 && <span className="tabular rounded-full bg-elevated px-2 py-0.5 text-xs font-normal text-muted-foreground">{s.count}</span>}
                  </span>
                  <ChevronDown className={cn("size-5 shrink-0 text-subtle transition-transform", isOpen && "rotate-180")} aria-hidden />
                </button>
              </h2>
              <div
                id={`panel-${s.id}`}
                className={cn("pb-6 lg:pb-0 lg:pt-8", isOpen ? "block" : "hidden", active === s.id ? "lg:block" : "lg:hidden")}
              >
                {s.content}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
