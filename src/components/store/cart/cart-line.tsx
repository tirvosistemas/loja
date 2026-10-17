"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { AlertTriangle, Trash2, Truck } from "lucide-react";
import type { QuoteLine } from "@/lib/orders/quote";
import type { CartItem } from "@/stores/cart";
import { useCart } from "@/stores/cart";
import { Badge } from "@/components/ui/badge";
import { QuantityStepper } from "@/components/ui/quantity";
import { SmartImage } from "@/components/ui/smart-image";
import { formatBRL } from "@/lib/format";

/** Item do carrinho. Usa os valores do servidor quando já chegaram; antes, o retrato salvo. */
export function CartPageLine({ item, line }: { item: CartItem; line?: QuoteLine }) {
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);

  const name = line?.name ?? item.name;
  const slug = line?.slug || item.slug;
  const href = slug ? `/produto/${slug}` : null;
  const image = line?.image ?? item.image;
  const variantName = line?.variantName ?? item.variantName;
  const unit = line?.unitPriceCents ?? item.unitPriceCents;
  const compareAt = line?.compareAtCents ?? item.compareAtCents;
  const max = Math.max(1, line?.maxQuantity ?? item.maxQuantity ?? 1);
  const quantity = item.quantity;
  const showCompare = compareAt != null && compareAt > unit;

  const Thumb = (
    <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-well sm:size-24">
      <SmartImage src={image} alt="" size="sm" sizes="96px" className="size-full object-contain p-1.5" />
    </span>
  );

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3 py-5 first:pt-0 last:pb-0 sm:gap-4"
    >
      {href ? (
        <Link href={href} tabIndex={-1} aria-hidden>
          {Thumb}
        </Link>
      ) : (
        Thumb
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {href ? (
              <Link href={href} className="line-clamp-2 text-[15px] font-medium leading-snug hover:text-primary">
                {name}
              </Link>
            ) : (
              <p className="line-clamp-2 text-[15px] font-medium leading-snug">{name}</p>
            )}
            {variantName && <p className="mt-0.5 text-[13px] text-subtle">{variantName}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {line?.promoted && (
                <Badge tone="accent" size="sm">
                  {line.promotionName || "Oferta"}
                </Badge>
              )}
              {line?.freeShipping && (
                <Badge tone="success" size="sm">
                  <Truck aria-hidden /> Frete grátis
                </Badge>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => remove(item.productId, item.variantId)}
            aria-label={`Remover ${name} do carrinho`}
            className="-mr-1.5 -mt-1.5 grid size-10 shrink-0 place-items-center rounded-lg text-subtle transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-3">
          <div>
            <QuantityStepper value={quantity} max={max} onChange={(v) => setQuantity(item.productId, item.variantId, v)} />
            {quantity > 1 && <p className="tabular mt-1 text-xs text-subtle">{formatBRL(unit)} cada</p>}
          </div>
          <div className="tabular text-right">
            {showCompare && <s className="block text-xs text-subtle">{formatBRL(compareAt! * quantity)}</s>}
            <p className="text-base font-semibold">{formatBRL(unit * quantity)}</p>
          </div>
        </div>

        {line?.issue ? (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-warning">
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> {line.issue}
          </p>
        ) : quantity >= max && max > 1 ? (
          <p className="mt-2 text-[13px] text-subtle">Quantidade máxima disponível para este item.</p>
        ) : null}
      </div>
    </motion.li>
  );
}
