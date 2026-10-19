"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Loader2, Truck } from "lucide-react";
import type { CartQuoteResponse } from "@/lib/orders/quote";
import { formatBRL, formatKm } from "@/lib/format";
import { freeShippingWhere, type FreeShippingRule } from "@/lib/shipping/free";
import { cn } from "@/lib/utils";

// Linhas do resumo (subtotal, cupom, Pix, frete, total) e a barra de frete grátis.
// Os valores vêm sempre da cotação do servidor.

/** Frete grátis da loja em vigor (null = desligado). */
export type FreeShippingCfg = FreeShippingRule | null;

function Row({ label, value, className, hint }: { label: ReactNode; value: ReactNode; className?: string; hint?: ReactNode }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 text-sm", className)}>
      <dt className="min-w-0 text-muted-foreground">
        {label}
        {hint && <span className="block text-xs text-subtle">{hint}</span>}
      </dt>
      <dd className="tabular shrink-0 text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function ShippingValue({
  quote,
  deliveryType,
  pendingText = "Calcule o frete",
}: {
  quote: CartQuoteResponse | null;
  deliveryType: "DELIVERY" | "PICKUP";
  pendingText?: string;
}) {
  if (deliveryType === "PICKUP") return <span className="text-success">Grátis</span>;
  const s = quote?.shipping;
  if (!s) return <span className="font-normal text-subtle">{pendingText}</span>;
  if (!s.ok || !s.available) return <span className="text-warning">Indisponível</span>;
  if (s.free)
    return (
      <span className="text-success">
        {s.originalFeeCents > 0 && <s className="mr-1.5 text-xs font-normal text-subtle">{formatBRL(s.originalFeeCents)}</s>}
        Grátis
      </span>
    );
  return <>{formatBRL(s.feeCents)}</>;
}

export function SummaryRows({
  quote,
  loading,
  fallbackSubtotalCents,
  itemCount,
  deliveryType,
  showPixHint = true,
  pendingShippingText,
}: {
  quote: CartQuoteResponse | null;
  loading: boolean;
  fallbackSubtotalCents: number;
  itemCount: number;
  deliveryType: "DELIVERY" | "PICKUP";
  showPixHint?: boolean;
  pendingShippingText?: string;
}) {
  const t = quote?.totals;
  const subtotal = t?.subtotalCents ?? fallbackSubtotalCents;
  const total = t?.totalCents ?? fallbackSubtotalCents;
  const shipping = quote?.shipping;
  const shippingKnown = deliveryType === "PICKUP" || (!!shipping && shipping.ok && shipping.available);
  const pixTotal = quote?.pixTotalCents ?? null;
  const showPix = showPixHint && pixTotal != null && pixTotal < total && (t?.pixDiscountCents ?? 0) === 0;

  return (
    <div aria-busy={loading || undefined}>
      <dl className="space-y-2.5">
        <Row label={`Subtotal (${itemCount} ${itemCount === 1 ? "item" : "itens"})`} value={formatBRL(subtotal)} />
        {t && t.discountCents > 0 && (
          <Row
            label={quote?.coupon?.code ? `Cupom ${quote.coupon.code}` : "Desconto do cupom"}
            value={<span className="text-success">−{formatBRL(t.discountCents)}</span>}
          />
        )}
        {t && t.pixDiscountCents > 0 && (
          <Row
            label={`Desconto Pix (${quote?.pixDiscountPercent ?? 0}%)`}
            value={<span className="text-success">−{formatBRL(t.pixDiscountCents)}</span>}
          />
        )}
        <Row
          label={deliveryType === "PICKUP" ? "Retirada na loja" : "Frete por motoboy"}
          hint={
            deliveryType === "DELIVERY" && shipping?.ok && shipping.available
              ? `${formatKm(shipping.distanceKm)}${shipping.etaText ? ` · ${shipping.etaText}` : ""}`
              : undefined
          }
          value={<ShippingValue quote={quote} deliveryType={deliveryType} pendingText={pendingShippingText} />}
        />
      </dl>
      <div className="mt-4 flex items-end justify-between gap-4 border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium">Total</p>
          {!shippingKnown && <p className="text-xs text-subtle">sem o frete</p>}
        </div>
        <div className="text-right">
          <p className="tabular flex items-center justify-end gap-2 text-2xl font-semibold tracking-tight" aria-live="polite">
            {loading && <Loader2 className="size-4 animate-spin text-subtle" aria-label="Atualizando valores" />}
            {formatBRL(total)}
          </p>
          {showPix && (
            <p className="tabular text-[13px] font-medium text-success">
              ou {formatBRL(pixTotal!)} no Pix
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Barra de progresso até o pedido mínimo do frete grátis (sem mínimo, só o aviso). */
export function FreeShippingProgress({
  cfg,
  quote,
  subtotalCents,
  className,
}: {
  cfg: FreeShippingCfg;
  quote: CartQuoteResponse | null;
  subtotalCents: number;
  className?: string;
}) {
  if (!cfg) return null;
  const ship = quote?.shipping;
  const known = !!ship && ship.ok && ship.available;
  const outsideRadius = known && cfg.maxKm != null && ship!.distanceKm > cfg.maxKm && !ship!.free;
  const won = known ? ship!.free : subtotalCents >= cfg.minCents;
  const missing = Math.max(0, cfg.minCents - subtotalCents);
  if (!won && !missing && !outsideRadius) return null;
  const pct = won ? 100 : Math.min(100, Math.round((subtotalCents / cfg.minCents) * 100));
  const where = freeShippingWhere(cfg);

  if (outsideRadius) {
    return (
      <div className={cn("rounded-2xl border border-border bg-card p-3.5 text-sm", className)}>
        <p className="flex items-start gap-2">
          <Truck className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
          <span className="text-muted-foreground">
            O frete grátis vale para endereços {where}. O seu fica a <span className="tabular">{formatKm(ship!.distanceKm)}</span>.
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-3.5", className)}>
      <p className="flex items-start gap-2 text-sm">
        <Truck className={cn("mt-0.5 size-4 shrink-0", won ? "text-success" : "text-primary")} aria-hidden />
        {won ? (
          <span>
            <b className="text-success">Você ganhou frete grátis</b>{" "}
            <span className="text-muted-foreground">{known ? "neste endereço" : where}</span>
          </span>
        ) : (
          <span>
            Faltam <b className="tabular">{formatBRL(missing)}</b> para frete grátis <span className="text-muted-foreground">{where}</span>
          </span>
        )}
      </p>
      {cfg.minCents > 0 && (
        <div
          role="progressbar"
          aria-label="Progresso para o frete grátis"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <motion.div
            className={cn("h-full rounded-full", won ? "bg-success" : "bg-primary")}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 30 }}
          />
        </div>
      )}
    </div>
  );
}
