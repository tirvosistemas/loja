import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/lib/constants";

export function PageHeader({ title, description, actions, back, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label?: string }; className?: string }) {
  return (
    <div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> {back.label ?? "Voltar"}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const map = { neutral: "neutral", info: "info", success: "success", warning: "warning", danger: "danger", accent: "accent" } as const;
  return <Badge tone={map[tone]}>{children}</Badge>;
}

/** Tabela responsiva com o visual do painel. Use <th>/<td> normais dentro. */
export function AdminTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-x-auto rounded-2xl border border-border bg-card", className)}>
      <table className="w-full min-w-[640px] text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-subtle [&_thead]:border-b [&_thead]:border-border [&_tbody_tr]:border-b [&_tbody_tr]:border-border [&_tbody_tr:last-child]:border-0 [&_tbody_tr:hover]:bg-elevated/50">
        {children}
      </table>
    </div>
  );
}

export function StatCard({ label, value, hint, icon, trend }: { label: ReactNode; value: ReactNode; hint?: ReactNode; icon?: ReactNode; trend?: { value: string; positive: boolean } }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        {icon && <span className="text-subtle [&_svg]:size-4.5">{icon}</span>}
      </div>
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {trend && <span className={trend.positive ? "text-success" : "text-danger"}>{trend.value}</span>}
        {hint && <span className="text-subtle">{hint}</span>}
      </div>
    </div>
  );
}
