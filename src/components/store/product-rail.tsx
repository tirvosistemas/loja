"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductCardDTO } from "@/lib/catalog";
import { ProductCard } from "./product-card";
import { cn } from "@/lib/utils";

const ARROW =
  "grid size-10 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground disabled:pointer-events-none disabled:opacity-35";

/** Fileira horizontal de produtos com rolagem por arraste/toque e setas no computador. */
export function ProductRail({
  title,
  eyebrow,
  href,
  hrefLabel = "Ver todos",
  products,
  className,
  headerExtra,
  belowHeader,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  products: ProductCardDTO[];
  className?: string;
  headerExtra?: React.ReactNode;
  belowHeader?: React.ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  // Setas desativadas no começo/fim da fileira (e as duas quando tudo já cabe na tela).
  const [edges, setEdges] = useState({ start: true, end: false });
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure, products.length]);
  if (!products.length) return null;
  const scroll = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };
  return (
    <section className={cn("container-page", className)}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="mb-1.5 font-mono text-xs uppercase tracking-[0.16em] text-subtle">{eyebrow}</p>}
          <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {headerExtra}
          {href && (
            <Link href={href} className="-my-2.5 hidden items-center gap-1.5 py-2.5 text-sm font-medium text-muted-foreground hover:text-primary sm:flex">
              {hrefLabel} <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
          {!(edges.start && edges.end) && (
            <div className="hidden gap-1 md:flex">
              <button type="button" onClick={() => scroll(-1)} disabled={edges.start} aria-label="Anteriores" className={ARROW}>
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={() => scroll(1)} disabled={edges.end} aria-label="Próximos" className={ARROW}>
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>
      {belowHeader}
      <div ref={scroller} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 sm:gap-4 lg:mx-0 lg:scroll-px-0 lg:px-0">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23.5%] xl:w-[19%]" />
        ))}
      </div>
      {href && (
        <Link href={href} className="mt-2 flex min-h-10 items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary sm:hidden">
          {hrefLabel} <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </section>
  );
}
