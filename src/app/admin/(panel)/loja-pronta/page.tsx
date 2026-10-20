import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, CircleAlert } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getReadiness, readinessScore, type CheckLevel } from "@/lib/admin/readiness";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Loja pronta" };

const LEVEL: Record<CheckLevel, { label: string; tone: "danger" | "warning" | "neutral" }> = {
  required: { label: "Obrigatório", tone: "danger" },
  recommended: { label: "Recomendado", tone: "warning" },
  optional: { label: "Opcional", tone: "neutral" },
};

export default async function ReadinessPage() {
  await requireAdmin(["OWNER", "ADMIN"]);
  const groups = await getReadiness();
  const score = readinessScore(groups);
  const pct = Math.round((score.done / Math.max(1, score.total)) * 100);

  return (
    <>
      <PageHeader title="Loja pronta" description="Tudo o que falta antes de abrir e o que ajuda a vender mais. Atualiza sozinho conforme você configura." />

      <section className="relative mb-6 overflow-hidden rounded-2xl border border-border bg-card p-5">
        <div aria-hidden className="glow-orange pointer-events-none absolute -right-24 -top-24 size-72 opacity-70" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="tabular text-3xl font-semibold tracking-tight">
              {score.done}
              <span className="text-lg text-subtle">/{score.total}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {score.requiredMissing === 0
                ? "Tudo o que é obrigatório está pronto. A loja pode abrir."
                : `${score.requiredMissing === 1 ? "Falta 1 item obrigatório" : `Faltam ${score.requiredMissing} itens obrigatórios`} para abrir a loja.`}
            </p>
          </div>
          <div className="flex items-center gap-3 sm:w-72">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso">
              <div className={cn("h-full rounded-full", score.requiredMissing ? "bg-primary" : "bg-success")} style={{ width: `${pct}%` }} />
            </div>
            <span className="tabular text-sm text-muted-foreground">{pct}%</span>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        {groups.map((g) => {
          const sorted = [...g.checks].sort((a, b) => Number(a.ok) - Number(b.ok) || ["required", "recommended", "optional"].indexOf(a.level) - ["required", "recommended", "optional"].indexOf(b.level));
          return (
            <section key={g.title} aria-labelledby={`g-${g.title}`}>
              <h2 id={`g-${g.title}`} className="mb-2.5 flex items-center gap-2 text-[15px] font-semibold">
                {g.title}
                <span className="tabular text-xs font-normal text-subtle">
                  {g.checks.filter((c) => c.ok).length}/{g.checks.length}
                </span>
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {sorted.map((c) => (
                  <li key={c.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                    <span className="mt-0.5 shrink-0" aria-hidden>
                      {c.ok ? (
                        <CheckCircle2 className="size-5 text-success" />
                      ) : c.level === "required" ? (
                        <CircleAlert className="size-5 text-danger" />
                      ) : (
                        <Circle className="size-5 text-subtle" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className={cn(c.ok && "text-muted-foreground")}>{c.title}</span>
                        <span className="sr-only">{c.ok ? "(pronto)" : "(pendente)"}</span>
                        {!c.ok && (
                          <Badge tone={LEVEL[c.level].tone} size="sm">
                            {LEVEL[c.level].label}
                          </Badge>
                        )}
                      </p>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">{c.detail}</p>
                      {!c.ok && c.examples && c.examples.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {c.examples.map((x) => (
                            <li key={x.href + x.label}>
                              <Link href={x.href} className="inline-flex max-w-[240px] truncate rounded-lg border border-border bg-elevated/50 px-2 py-1 text-xs hover:border-border-strong">
                                {x.label}
                              </Link>
                            </li>
                          ))}
                          {(c.count ?? 0) > c.examples.length && <li className="px-1 py-1 text-xs text-subtle">e mais {(c.count ?? 0) - c.examples.length}</li>}
                        </ul>
                      )}
                    </div>
                    {!c.ok && c.href && (
                      <Link href={c.href} className="inline-flex shrink-0 items-center gap-1 self-start rounded-xl px-3 py-2 text-sm font-medium text-primary hover:bg-primary-soft">
                        {c.cta} <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
