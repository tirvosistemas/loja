import { Check, X } from "lucide-react";
import { ORDER_FLOW_DELIVERY, ORDER_FLOW_PICKUP } from "@/lib/constants";
import type { PublicOrder } from "@/lib/orders/public-order";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// Linha do tempo do pedido, com o passo atual em destaque e a hora de cada mudança.

const STEP: Record<string, { label: string; pickupLabel?: string; text: string; pickupText?: string }> = {
  NEW: { label: "Pedido recebido", text: "Recebemos o seu pedido e vamos confirmar pelo WhatsApp." },
  CONFIRMED: { label: "Pedido confirmado", text: "A loja confirmou os itens do seu pedido." },
  PREPARING: { label: "Em separação", text: "Estamos separando e conferindo os seus produtos." },
  OUT_FOR_DELIVERY: { label: "Saiu para entrega", text: "O motoboy está a caminho do seu endereço." },
  READY_FOR_PICKUP: { label: "Pronto para retirada", text: "Já pode vir buscar na loja. Leve o número do pedido." },
  DELIVERED: {
    label: "Entregue",
    pickupLabel: "Retirado",
    text: "Pedido entregue. Aproveite!",
    pickupText: "Pedido retirado na loja. Aproveite!",
  },
};

export function OrderTimeline({ order }: { order: PublicOrder }) {
  const pickup = order.deliveryType === "PICKUP";
  const flow: readonly string[] = pickup ? ORDER_FLOW_PICKUP : ORDER_FLOW_DELIVERY;
  const statusEvents = order.events.filter((e) => e.type === "status" && e.status);
  const timeOf = (status: string) => {
    const ev = [...statusEvents].reverse().find((e) => e.status === status);
    return ev?.createdAt ?? (status === "NEW" ? order.createdAt : null);
  };

  const canceled = order.status === "CANCELED";
  let current = flow.indexOf(order.status);
  if (canceled) {
    // Até onde o pedido chegou antes de ser cancelado.
    current = statusEvents.reduce((max, e) => Math.max(max, flow.indexOf(e.status!)), 0);
  }
  const steps = canceled ? flow.slice(0, current + 1) : flow;
  const finished = order.status === "DELIVERED";

  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const done = canceled ? true : i < current || (finished && i === current);
        const active = !canceled && i === current && !finished;
        const at = i <= current ? timeOf(s) : null;
        const info = STEP[s];
        const last = i === steps.length - 1 && !canceled;
        return (
          <li key={s} className="relative flex gap-4 pb-6 last:pb-0" aria-current={active ? "step" : undefined}>
            {!last && (
              <span
                aria-hidden
                className={cn("absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px", done ? "bg-primary/60" : "bg-border")}
              />
            )}
            <span
              aria-hidden
              className={cn(
                "relative grid size-8 shrink-0 place-items-center rounded-full border transition-colors",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary bg-primary-soft",
                !done && !active && "border-border-strong bg-card",
              )}
            >
              {done ? (
                <Check className="size-4" />
              ) : active ? (
                <span className="size-2.5 rounded-full bg-primary animate-pulse-dot" />
              ) : (
                <span className="size-1.5 rounded-full bg-border-strong" />
              )}
            </span>
            <div className="min-w-0 pt-1">
              <p className={cn("text-[15px] font-medium leading-tight", !done && !active && "text-muted-foreground")}>
                {pickup && info.pickupLabel ? info.pickupLabel : info.label}
                {active && <span className="sr-only"> (etapa atual)</span>}
              </p>
              {(done || active) && (
                <p className="mt-1 text-[13px] text-muted-foreground">{pickup && info.pickupText ? info.pickupText : info.text}</p>
              )}
              {at && <p className="tabular mt-1 font-mono text-[11px] uppercase tracking-wider text-subtle">{formatDateTime(at)}</p>}
            </div>
          </li>
        );
      })}
      {canceled && (
        <li className="relative flex gap-4" aria-current="step">
          <span aria-hidden className="relative grid size-8 shrink-0 place-items-center rounded-full border border-danger bg-danger text-white">
            <X className="size-4" />
          </span>
          <div className="min-w-0 pt-1">
            <p className="text-[15px] font-medium leading-tight text-danger">Pedido cancelado</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Os itens voltaram para o estoque. Se tiver dúvidas, fale com a loja.</p>
            {timeOf("CANCELED") && (
              <p className="tabular mt-1 font-mono text-[11px] uppercase tracking-wider text-subtle">{formatDateTime(timeOf("CANCELED")!)}</p>
            )}
          </div>
        </li>
      )}
    </ol>
  );
}
