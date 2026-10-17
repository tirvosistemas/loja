import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/ui/nav";
import { SmartImage } from "@/components/ui/smart-image";
import { CategoryIcon } from "@/components/ui/category-icon";
import { cn } from "@/lib/utils";

// Cabeçalhos das listagens. Estilo da marca: rótulo mono em caixa alta, ponto laranja,
// grade técnica ao fundo e bordas sutis.

export function Eyebrow({ children, className, pulse }: { children: ReactNode; className?: string; pulse?: boolean }) {
  return (
    <p className={cn("flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-subtle", className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full bg-primary", pulse && "animate-pulse-dot")} aria-hidden />
      {children}
    </p>
  );
}

/** Cabeçalho simples: migalhas, rótulo, título e descrição. */
export function ListingHeader({
  breadcrumbs,
  eyebrow,
  title,
  description,
  aside,
  children,
}: {
  breadcrumbs: { label: string; href?: string }[];
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header>
      <Breadcrumbs items={breadcrumbs} />
      <div className="mt-4 flex flex-col gap-4 sm:mt-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">{title}</h1>
          {description && <div className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</div>}
        </div>
        {aside}
      </div>
      {children}
    </header>
  );
}

/** Cabeçalho da categoria: banner com foto (quando houver) ou faixa com o ícone. */
export function CategoryHeader({
  category,
  icon,
  breadcrumbs,
  eyebrow = "Categoria",
}: {
  category: { name: string; description: string | null; image: string | null; children: { name: string; slug: string }[] };
  icon: string | null;
  breadcrumbs: { label: string; href?: string }[];
  eyebrow?: string;
}) {
  const hasImage = !!category.image;
  return (
    <header>
      <Breadcrumbs items={breadcrumbs} />
      <div
        className={cn(
          "relative mt-4 overflow-hidden rounded-3xl border border-border sm:mt-5",
          hasImage ? "min-h-48 sm:min-h-60" : "bg-card",
        )}
      >
        {hasImage ? (
          <>
            <SmartImage src={category.image} alt="" size="lg" sizes="100vw" priority className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/55 to-black/10" aria-hidden />
          </>
        ) : (
          <>
            <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
            <div className="glow-orange pointer-events-none absolute -right-24 -top-24 size-80" aria-hidden />
          </>
        )}
        <div className="relative flex items-center gap-5 p-6 sm:p-8 lg:p-10">
          {!hasImage && (
            <div className="relative hidden size-20 shrink-0 place-items-center rounded-2xl border border-border-strong bg-elevated text-foreground sm:grid lg:size-24">
              <CategoryIcon name={icon} className="size-9 lg:size-10" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" aria-hidden />
            </div>
          )}
          <div className={cn("min-w-0 max-w-2xl", hasImage && "py-4 text-white")}>
            <p className={cn("flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em]", hasImage ? "text-white/70" : "text-subtle")}>
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              {eyebrow}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">{category.name}</h1>
            {category.description && (
              <p className={cn("mt-2 line-clamp-3 text-[15px] leading-relaxed", hasImage ? "text-white/80" : "text-muted-foreground")}>{category.description}</p>
            )}
          </div>
        </div>
      </div>
      {category.children.length > 0 && (
        <nav aria-label="Subcategorias" className="no-scrollbar -mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex gap-2 sm:flex-wrap">
            {category.children.map((c) => (
              <li key={c.slug} className="shrink-0">
                <Link
                  href={`/categoria/${c.slug}`}
                  className="flex h-10 items-center rounded-full border border-border bg-card px-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
