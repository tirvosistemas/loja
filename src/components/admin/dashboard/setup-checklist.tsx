import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ChecklistItem } from "./data";

/** “Configure sua loja”: só os passos que ainda faltam. */
export function SetupChecklist({ items, total }: { items: ChecklistItem[]; total: number }) {
  if (items.length === 0) return null;
  const done = Math.max(0, total - items.length);
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <section aria-labelledby="setup-title" className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <div aria-hidden className="glow-orange pointer-events-none absolute -right-24 -top-24 size-72 opacity-70" />
      <div className="relative flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
            <span aria-hidden className="size-1.5 animate-pulse-dot rounded-full bg-primary" />
            Primeiros passos
          </p>
          <h2 id="setup-title" className="mt-1.5 text-[15px] font-semibold">
            Configure sua loja
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {items.length === 1 ? "Falta 1 passo" : `Faltam ${items.length} passos`} para a loja ficar redondinha.
          </p>
        </div>
        <div className="flex items-center gap-3 sm:w-56">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da configuração"
          >
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
          </div>
          <span className="tabular text-xs text-muted-foreground">
            {done}/{total}
          </span>
        </div>
      </div>
      <ul className="relative grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <li key={it.id}>
            <Link
              href={it.href}
              className="group flex h-full items-start gap-3 rounded-xl border border-border bg-background/40 p-4 transition-colors hover:border-border-strong hover:bg-elevated/50"
            >
              <span aria-hidden className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-border-strong transition-colors group-hover:border-primary">
                <span className="size-1.5 rounded-full bg-transparent transition-colors group-hover:bg-primary" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{it.title}</span>
                <span className="mt-0.5 block text-[13px] text-muted-foreground">{it.description}</span>
                <span className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-primary">
                  {it.cta} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
