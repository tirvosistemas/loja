import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Bloco numerado do checkout (1 Seus dados, 2 Entrega, 3 Pagamento, 4 Observações).

export function CheckoutSection({
  id,
  step,
  title,
  description,
  done,
  children,
  className,
}: {
  id: string;
  step: number;
  title: ReactNode;
  description?: ReactNode;
  done?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className={cn("scroll-mt-28 rounded-2xl border border-border bg-card p-5 sm:p-6", className)}>
      <header className="flex items-start gap-3.5">
        <span
          aria-hidden
          className={cn(
            "tabular grid size-8 shrink-0 place-items-center rounded-full border font-mono text-[13px] font-semibold transition-colors",
            done ? "border-primary bg-primary text-primary-foreground" : "border-border-strong text-muted-foreground",
          )}
        >
          {done ? <Check className="size-4" /> : step}
        </span>
        <div className="min-w-0 pt-0.5">
          <h2 id={`${id}-titulo`} className="text-lg font-semibold leading-tight">
            <span className="sr-only">Etapa {step}: </span>
            {title}
            {done && <span className="sr-only"> (preenchido)</span>}
          </h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}
