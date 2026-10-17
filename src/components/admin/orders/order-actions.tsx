"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, Ban, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ORDER_FLOW_DELIVERY, ORDER_FLOW_PICKUP, ORDER_STATUS_LABEL } from "@/lib/constants";
import { cancelOrderAction, changeOrderStatusAction, markOrderPaidAction } from "@/app/admin/(panel)/pedidos/actions";

const RANK: Record<string, number> = { NEW: 0, CONFIRMED: 1, PREPARING: 2, OUT_FOR_DELIVERY: 3, READY_FOR_PICKUP: 3, DELIVERED: 4 };
const ALL = ["NEW", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "DELIVERED"] as const;

function stepLabel(status: string, pickup: boolean) {
  switch (status) {
    case "CONFIRMED":
      return "Confirmar pedido";
    case "PREPARING":
      return "Iniciar separação";
    case "OUT_FOR_DELIVERY":
      return "Saiu para entrega";
    case "READY_FOR_PICKUP":
      return "Pronto para retirada";
    case "DELIVERED":
      return pickup ? "Marcar como retirado" : "Marcar como entregue";
    default:
      return ORDER_STATUS_LABEL[status]?.label ?? status;
  }
}

export function OrderActions({
  orderId,
  status,
  deliveryType,
  paymentMethod,
  paymentStatus,
  notifyLinks,
}: {
  orderId: string;
  status: string;
  deliveryType: "DELIVERY" | "PICKUP";
  paymentMethod: string;
  paymentStatus: string;
  /** Link do WhatsApp do cliente com a mensagem de cada novo status. */
  notifyLinks: Partial<Record<string, string>>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [other, setOther] = useState("");

  const pickup = deliveryType === "PICKUP";
  const flow: readonly string[] = pickup ? ORDER_FLOW_PICKUP : ORDER_FLOW_DELIVERY;
  const final = status === "DELIVERED" || status === "CANCELED";
  const next = flow.filter((s) => RANK[s] > (RANK[status] ?? -1));
  const canMarkPaid = paymentMethod !== "ONLINE_STRIPE" && paymentStatus !== "PAID" && status !== "CANCELED";
  const stripePaid = paymentMethod === "ONLINE_STRIPE" && paymentStatus === "PAID";

  const change = (target: string) => {
    setBusy(target);
    start(async () => {
      const r = await changeOrderStatusAction(orderId, target, note || undefined);
      setBusy(null);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setNote("");
      setOther("");
      const link = notifyLinks[target];
      toast.success(r.message ?? "Status atualizado.", link ? { action: { label: "Avisar cliente", onClick: () => window.open(link, "_blank", "noopener") } } : undefined);
      router.refresh();
    });
  };

  const markPaid = () => {
    setBusy("paid");
    start(async () => {
      const r = await markOrderPaidAction(orderId);
      setBusy(null);
      if (r.ok) toast.success(r.message ?? "Pagamento confirmado.");
      else toast.error(r.error);
      router.refresh();
    });
  };

  if (final) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-elevated/50 p-4 text-sm">
        {status === "CANCELED" ? <Ban className="mt-0.5 size-4.5 shrink-0 text-danger" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-success" aria-hidden />}
        <div>
          <p className="font-medium">{status === "CANCELED" ? "Pedido cancelado" : pickup ? "Pedido retirado" : "Pedido entregue"}</p>
          <p className="mt-0.5 text-muted-foreground">
            {status === "CANCELED"
              ? "O estoque já foi devolvido. Pedidos cancelados não podem ser reabertos."
              : "Pedido finalizado. O status não pode mais ser alterado."}
          </p>
          {canMarkPaid && (
            <Button
              className="mt-3"
              variant="secondary"
              size="sm"
              loading={busy === "paid"}
              onClick={markPaid}
            >
              <BadgeCheck aria-hidden /> Marcar como pago
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {next.length > 0 && (
        <div>
          <p className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">Próximo passo</p>
          <div className="flex flex-wrap gap-2">
            {next.map((s, i) => (
              <Button
                key={s}
                variant={i === 0 ? "primary" : "secondary"}
                size={i === 0 ? "md" : "sm"}
                className={i === 0 ? "w-full sm:w-auto" : "h-11 sm:h-9"}
                loading={busy === s}
                disabled={pending && busy !== s}
                onClick={() => change(s)}
              >
                {stepLabel(s, pickup)}
                {i === 0 && <ArrowRight aria-hidden />}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <label htmlFor="status-note" className="sr-only">
            Observação para o histórico
          </label>
          <Input id="status-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Observação para o histórico (opcional)" />
        </div>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1 sm:w-48">
            <label htmlFor="status-other" className="sr-only">
              Mudar para outro status
            </label>
            <Select id="status-other" value={other} onChange={(e) => setOther(e.target.value)}>
              <option value="">Outro status…</option>
              {ALL.filter((s) => s !== status).map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABEL[s].label}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="secondary" disabled={!other || pending} loading={!!other && busy === other} onClick={() => other && change(other)}>
            Aplicar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {canMarkPaid && (
          <Button
            variant="secondary"
            loading={busy === "paid"}
            disabled={pending && busy !== "paid"}
            onClick={markPaid}
          >
            <BadgeCheck aria-hidden className="text-success" /> Marcar como pago
          </Button>
        )}
        {paymentMethod === "ONLINE_STRIPE" && paymentStatus !== "PAID" && (
          <p className="flex items-center gap-1.5 text-[13px] text-subtle">
            <Lock className="size-3.5" aria-hidden /> O pagamento online é confirmado automaticamente pela Stripe.
          </p>
        )}
        <div className="flex-1" />
        <ConfirmButton
          variant="danger-ghost"
          title="Cancelar este pedido?"
          description={
            <>
              Os itens voltam para o estoque e o uso do cupom é liberado. Pedidos cancelados não podem ser reabertos.
              {stripePaid && (
                <span className="mt-2 block font-medium text-warning">
                  Este pedido foi pago online: o valor não é estornado automaticamente. Faça o reembolso no painel da Stripe.
                </span>
              )}
            </>
          }
          confirmLabel="Cancelar pedido"
          successMessage="Pedido cancelado e estoque devolvido."
          onConfirm={async () => {
            const r = await cancelOrderAction(orderId, note || undefined);
            if (r.ok) router.refresh();
            return r;
          }}
        >
          <Ban aria-hidden /> Cancelar pedido
        </ConfirmButton>
      </div>
    </div>
  );
}
