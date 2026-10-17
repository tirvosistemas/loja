"use client";

import type { CartQuoteResponse } from "@/lib/orders/quote";
import type { CartItem } from "@/stores/cart";
import { SmartImage } from "@/components/ui/smart-image";
import { CouponField } from "@/components/store/cart/coupon-field";
import { SummaryRows } from "@/components/store/cart/summary";
import { formatBRL } from "@/lib/format";
import type { DeliveryType } from "./form";

/** Itens, cupom e totais do checkout (sempre da cotação do servidor). */
export function CheckoutSummary({
  items,
  quote,
  loading,
  deliveryType,
  fallbackSubtotalCents,
  itemCount,
  couponError,
}: {
  items: CartItem[];
  quote: CartQuoteResponse | null;
  loading: boolean;
  deliveryType: DeliveryType;
  fallbackSubtotalCents: number;
  itemCount: number;
  couponError?: string | null;
}) {
  const byKey = new Map((quote?.lines ?? []).map((l) => [l.key, l]));
  return (
    <div>
      <ul className="max-h-[22rem] space-y-3.5 overflow-y-auto pr-1" aria-label="Itens do pedido">
        {items.map((it) => {
          const k = `${it.productId}:${it.variantId ?? ""}`;
          const l = byKey.get(k);
          const unit = l?.unitPriceCents ?? it.unitPriceCents;
          return (
            <li key={k} className="flex items-center gap-3">
              <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-well">
                <SmartImage src={l?.image ?? it.image} alt="" size="sm" sizes="56px" className="size-full object-contain p-1" />
                <span className="tabular absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-inverse px-1 font-mono text-[11px] font-semibold text-inverse-foreground ring-2 ring-card">
                  {it.quantity}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium leading-snug">{l?.name ?? it.name}</p>
                <p className="text-xs text-subtle">
                  {(l?.variantName ?? it.variantName) ? `${l?.variantName ?? it.variantName} · ` : ""}
                  {it.quantity} × <span className="tabular">{formatBRL(unit)}</span>
                </p>
              </div>
              <p className="tabular shrink-0 text-sm font-semibold">{formatBRL(unit * it.quantity)}</p>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 border-t border-border pt-4">
        <CouponField quote={quote} loading={loading} collapsible serverError={couponError} />
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <SummaryRows
          quote={quote}
          loading={loading}
          fallbackSubtotalCents={fallbackSubtotalCents}
          itemCount={itemCount}
          deliveryType={deliveryType}
          pendingShippingText="Informe o endereço"
        />
      </div>
    </div>
  );
}
