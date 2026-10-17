import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, type Tone } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Event = { id: string; type: string; status: string | null; note: string | null; createdAt: Date };

const DOT: Record<Tone, string> = {
  neutral: "bg-subtle",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  accent: "bg-primary",
};

function describe(e: Event): { title: string; tone: Tone } {
  if (e.type === "status" && e.status) {
    const s = ORDER_STATUS_LABEL[e.status];
    return { title: s ? `Status: ${s.label}` : `Status: ${e.status}`, tone: s?.tone ?? "neutral" };
  }
  if (e.type === "payment" && e.status) {
    if (e.status === "PROCESSING") return { title: "Pagamento em processamento", tone: "info" };
    if (e.status === "PARTIAL_REFUND") return { title: "Reembolso parcial", tone: "info" };
    if (e.status === "PENDING") return { title: "Pagamento aguardando", tone: "warning" };
    const s = PAYMENT_STATUS_LABEL[e.status];
    return { title: s ? `Pagamento: ${s.label.toLowerCase()}` : `Pagamento: ${e.status}`, tone: s?.tone ?? "neutral" };
  }
  return { title: "Anotação", tone: "neutral" };
}

/** Histórico do pedido, do mais recente para o mais antigo. */
export function OrderTimeline({ events }: { events: Event[] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>;
  const sorted = [...events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return (
    <ol className="relative space-y-5">
      {sorted.map((e, i) => {
        const d = describe(e);
        return (
          <li key={e.id} className="relative flex gap-3.5">
            {i < sorted.length - 1 && <span aria-hidden className="absolute left-[5px] top-4 h-[calc(100%+0.5rem)] w-px bg-border" />}
            <span aria-hidden className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-card", DOT[d.tone])} />
            <div className="min-w-0">
              <p className="text-sm font-medium">{d.title}</p>
              {e.note && <p className="mt-0.5 break-words text-[13px] text-muted-foreground">{e.note}</p>}
              <p className="tabular mt-0.5 text-xs text-subtle">{formatDateTime(e.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
