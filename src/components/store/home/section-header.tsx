import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Rótulo pequeno em fonte mono, com o ponto laranja da marca. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-subtle", className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-primary" />
      {children}
    </p>
  );
}

/** Cabeçalho de seção da página inicial. */
export function SectionHeader({
  eyebrow,
  title,
  description,
  href,
  hrefLabel = "Ver todos",
  id,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h2 id={id} className="text-xl font-semibold sm:text-2xl">
          {title}
        </h2>
        {description && <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {href && (
        <Link href={href} className="-my-2.5 hidden shrink-0 items-center gap-1.5 py-2.5 text-sm font-medium text-muted-foreground hover:text-primary sm:flex">
          {hrefLabel} <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}
