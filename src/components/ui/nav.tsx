import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Breadcrumbs({ items, className }: { items: { label: string; href?: string }[]; className?: string }) {
  return (
    <nav aria-label="Você está em" className={cn("text-[13px] text-subtle", className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden />}
            {it.href ? (
              <Link href={it.href} className="-my-2.5 truncate py-2.5 hover:text-foreground">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate text-muted-foreground">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Paginação por links. `hrefFor(page)` monta a URL de cada página. */
export function Pagination({ page, pageCount, hrefFor, className }: { page: number; pageCount: number; hrefFor: (p: number) => string; className?: string }) {
  if (pageCount <= 1) return null;
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  const cell = "grid h-10 min-w-10 place-items-center rounded-xl px-3 text-sm tabular transition-colors";
  return (
    <nav aria-label="Paginação" className={cn("flex items-center justify-center gap-1", className)}>
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(cell, "hover:bg-elevated")} aria-label="Página anterior">
          <ChevronLeft className="size-4" />
        </Link>
      ) : null}
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className={cn(cell, "text-subtle")}>
            …
          </span>
        ) : (
          <Link key={p} href={hrefFor(p)} aria-current={p === page ? "page" : undefined} className={cn(cell, p === page ? "bg-inverse text-inverse-foreground font-semibold" : "hover:bg-elevated")}>
            {p}
          </Link>
        ),
      )}
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={cn(cell, "hover:bg-elevated")} aria-label="Próxima página">
          <ChevronRight className="size-4" />
        </Link>
      ) : null}
    </nav>
  );
}
