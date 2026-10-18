"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ShoppingBag, Trash2, Truck } from "lucide-react";
import { cartSubtotal, useCart, type CartItem } from "@/stores/cart";
import { Sheet } from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { SmartImage } from "@/components/ui/smart-image";
import { QuantityStepper } from "@/components/ui/quantity";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCartCount } from "./header-actions";

type FreeShipping = { enabled: boolean; aboveCents: number | null; maxKm: number | null };

function FreeShippingProgress({ subtotalCents, cfg }: { subtotalCents: number; cfg: FreeShipping }) {
  if (!cfg.enabled || cfg.aboveCents == null || cfg.aboveCents <= 0) return null;
  const missing = Math.max(0, cfg.aboveCents - subtotalCents);
  const pct = Math.min(100, Math.round((subtotalCents / cfg.aboveCents) * 100));
  const where = `em Curitiba e região${cfg.maxKm ? ` (até ${cfg.maxKm.toLocaleString("pt-BR")} km da loja)` : ""}`;
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <p className="flex items-start gap-2 text-sm">
        <Truck className={cn("mt-0.5 size-4 shrink-0", missing === 0 ? "text-success" : "text-primary")} aria-hidden />
        {missing > 0 ? (
          <span>
            Faltam <b className="tabular">{formatBRL(missing)}</b> para frete grátis <span className="text-muted-foreground">{where}</span>
          </span>
        ) : (
          <span>
            <b className="text-success">Você ganhou frete grátis</b> <span className="text-muted-foreground">{where}</span>
          </span>
        )}
      </p>
      <div
        role="progressbar"
        aria-label="Progresso para o frete grátis"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <motion.div
          className={cn("h-full rounded-full", missing === 0 ? "bg-success" : "bg-primary")}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
        />
      </div>
    </div>
  );
}

function CartLine({ item }: { item: CartItem }) {
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const close = useCart((s) => s.closeDrawer);
  const href = `/produto/${item.slug}`;
  const max = Math.max(1, item.maxQuantity || 1);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3 py-4"
    >
      <Link href={href} onClick={close} className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-well" tabIndex={-1} aria-hidden>
        <SmartImage src={item.image} alt="" size="sm" sizes="80px" className="size-full object-contain p-1.5" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Link href={href} onClick={close} className="line-clamp-2 text-sm font-medium leading-snug hover:text-primary">
              {item.name}
            </Link>
            {item.variantName && <p className="mt-0.5 text-xs text-subtle">{item.variantName}</p>}
          </div>
          <button
            type="button"
            onClick={() => remove(item.productId, item.variantId)}
            aria-label={`Remover ${item.name}`}
            className="-mr-2 -mt-1.5 grid size-10 shrink-0 place-items-center rounded-lg text-subtle hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <QuantityStepper
            size="sm"
            value={item.quantity}
            max={max}
            onChange={(v) => setQuantity(item.productId, item.variantId, v)}
          />
          <div className="tabular text-right">
            {item.compareAtCents && item.compareAtCents > item.unitPriceCents ? (
              <s className="block text-[11px] text-subtle">{formatBRL(item.compareAtCents * item.quantity)}</s>
            ) : null}
            <p className="text-sm font-semibold">{formatBRL(item.unitPriceCents * item.quantity)}</p>
          </div>
        </div>
        {item.quantity >= max && max > 1 && <p className="mt-1 text-[11px] text-warning">Quantidade máxima disponível.</p>}
      </div>
    </motion.li>
  );
}

/** Carrinho lateral, aberto por qualquer botão de carrinho da loja. */
export function CartDrawer({ freeShipping }: { freeShipping: FreeShipping }) {
  const open = useCart((s) => s.drawerOpen);
  const close = useCart((s) => s.closeDrawer);
  const items = useCart((s) => s.items);
  const subtotal = useCart(cartSubtotal);
  const count = useCartCount();
  const pathname = usePathname();

  useEffect(() => close(), [pathname, close]);

  const empty = items.length === 0;

  return (
    <Sheet
      open={open}
      onClose={close}
      side="right"
      label="Carrinho"
      title={
        <span className="flex items-center gap-2">
          Seu carrinho
          {count > 0 && <span className="tabular rounded-full bg-elevated px-2 py-0.5 font-mono text-xs text-muted-foreground">{count}</span>}
        </span>
      }
      footer={
        empty ? undefined : (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="tabular text-lg font-semibold">{formatBRL(subtotal)}</span>
            </div>
            <p className="text-xs text-subtle">Frete, cupons e desconto no Pix são calculados no checkout.</p>
            <Link href="/checkout" onClick={close} className={buttonVariants({ variant: "primary", size: "lg", block: true })}>
              Finalizar compra <ArrowRight aria-hidden />
            </Link>
            <Link href="/carrinho" onClick={close} className={buttonVariants({ variant: "outline", block: true })}>
              Ver carrinho
            </Link>
          </div>
        )
      }
    >
      {empty ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <span className="grid size-16 place-items-center rounded-2xl bg-elevated text-muted-foreground">
            <ShoppingBag className="size-7" aria-hidden />
          </span>
          <div>
            <p className="text-lg font-semibold">Seu carrinho está vazio</p>
            <p className="mt-1 text-sm text-muted-foreground">Que tal começar pelas ofertas da semana?</p>
          </div>
          <Link href="/ofertas" onClick={close} className={buttonVariants({ variant: "primary" })}>
            Ver ofertas <ArrowRight aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="px-5 pt-4">
          <FreeShippingProgress subtotalCents={subtotal} cfg={freeShipping} />
          <ul className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {items.map((it) => (
                <CartLine key={`${it.productId}:${it.variantId ?? ""}`} item={it} />
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </Sheet>
  );
}
