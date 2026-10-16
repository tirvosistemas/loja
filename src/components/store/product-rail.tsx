"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProductCardDTO } from "@/lib/catalog";
import { ProductCard } from "./product-card";
import { cn } from "@/lib/utils";

/** Fileira horizontal de produtos com rolagem por arraste/toque e setas no computador. */
export function ProductRail({
  title,
  eyebrow,
  href,
  hrefLabel = "Ver todos",
  products,
  className,
  headerExtra,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  products: ProductCardDTO[];
  className?: string;
  headerExtra?: React.ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
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
            <Link href={href} className="hidden items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary sm:flex">
              {hrefLabel} <ArrowRight className="size-4" />
            </Link>
          )}
          <div className="hidden gap-1 md:flex">
            <button type="button" onClick={() => scroll(-1)} aria-label="Anteriores" className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground hover:border-border-strong hover:text-foreground">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" onClick={() => scroll(1)} aria-label="Próximos" className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground hover:border-border-strong hover:text-foreground">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <div ref={scroller} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6 sm:gap-4 lg:mx-0 lg:scroll-px-0 lg:px-0">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[23.5%] xl:w-[19%]" />
        ))}
      </div>
      {href && (
        <Link href={href} className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary sm:hidden">
          {hrefLabel} <ArrowRight className="size-4" />
        </Link>
      )}
    </section>
  );
}
