"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, Lock, PackageSearch, ShieldCheck } from "lucide-react";
import { NextMascot } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { Separator, Skeleton } from "@/components/ui/card";
import { Eyebrow } from "@/components/store/catalog/headers";
import { useMounted } from "@/components/store/layout/ui-store";
import { formatBRL, pluralize } from "@/lib/format";
import { onlyDigits } from "@/lib/utils";
import { cartCount, cartSubtotal, useCart } from "@/stores/cart";
import { CartPageLine } from "./cart-line";
import { CartNotices, QuoteError } from "./cart-notices";
import { CouponField } from "./coupon-field";
import { ShippingCalculator, type ShipTo } from "./shipping-calculator";
import { FreeShippingProgress, SummaryRows, type FreeShippingCfg } from "./summary";
import { useCartQuote } from "./use-cart-quote";
import { rememberShipping } from "./shared";

export function CartView({ freeShipping, pickup }: { freeShipping: FreeShippingCfg; pickup: { enabled: boolean; place: string | null } }) {
  const mounted = useMounted();
  const items = useCart((s) => s.items);
  const couponCode = useCart((s) => s.couponCode);
  const count = useCart(cartCount);
  const localSubtotal = useCart(cartSubtotal);
  const [shipTo, setShipTo] = useState<ShipTo | null>(null);

  // CEP e número já usados antes (produto, carrinho ou checkout).
  useEffect(() => {
    const s = useCart.getState();
    const cep = onlyDigits(s.shipping?.cep || s.address?.cep || "");
    const number = (s.shipping?.number || s.address?.number || "").trim();
    if (cep.length === 8 && number) setShipTo({ cep, number });
  }, []);

  const q = useCartQuote({ couponCode, address: shipTo, deliveryType: "DELIVERY" }, { enabled: mounted });
  const { quote, loading } = q;

  useEffect(() => {
    if (!shipTo || loading || !quote?.shipping) return;
    rememberShipping(quote.shipping, shipTo.number);
  }, [quote, loading, shipTo]);

  const linesByKey = useMemo(() => new Map((quote?.lines ?? []).map((l) => [l.key, l])), [quote]);
  const subtotal = quote?.totals.subtotalCents ?? localSubtotal;
  const total = quote?.totals.totalCents ?? localSubtotal;
  const itemCount = quote?.itemCount ?? count;

  if (!mounted) return <CartSkeleton />;
  if (items.length === 0) return <EmptyCart />;

  return (
    <>
      <div className="mt-6 grid gap-6 sm:mt-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8 xl:gap-10">
        <div className="min-w-0 space-y-4">
          <CartNotices notices={q.notices} onDismiss={q.dismissNotices} />
          {q.error && <QuoteError message={q.error} onRetry={q.refresh} />}
          <FreeShippingProgress cfg={freeShipping} quote={quote} subtotalCents={subtotal} />

          <section aria-labelledby="carrinho-itens" className="rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 id="carrinho-itens" className="text-[15px] font-semibold">
                Itens <span className="tabular font-mono text-xs font-normal text-subtle">({itemCount})</span>
              </h2>
              <Link href="/" className="flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" aria-hidden /> Continuar comprando
              </Link>
            </div>
            <ul className="divide-y divide-border">
              <AnimatePresence initial={false}>
                {items.map((it) => {
                  const k = `${it.productId}:${it.variantId ?? ""}`;
                  return <CartPageLine key={k} item={it} line={linesByKey.get(k)} />;
                })}
              </AnimatePresence>
            </ul>
          </section>

          <ul className="grid gap-3 text-[13px] text-muted-foreground sm:grid-cols-2">
            <li className="flex items-start gap-2.5 rounded-2xl border border-border px-4 py-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              Preços e estoque conferidos agora, direto do nosso sistema.
            </li>
            <li className="flex items-start gap-2.5 rounded-2xl border border-border px-4 py-3">
              <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              Pagamento online em ambiente seguro ou na entrega, você escolhe.
            </li>
          </ul>
        </div>

        <aside aria-labelledby="carrinho-resumo" className="min-w-0 lg:sticky lg:top-36 lg:self-start">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <Eyebrow>Resumo</Eyebrow>
            <h2 id="carrinho-resumo" className="mt-2 text-lg font-semibold">
              Resumo do pedido
            </h2>
            <div className="mt-5 space-y-5">
              <CouponField quote={quote} loading={loading} />
              <Separator />
              <ShippingCalculator value={shipTo} onSubmit={setShipTo} quote={quote} loading={loading} pickup={pickup} />
              <Separator />
              <SummaryRows
                quote={quote}
                loading={loading}
                fallbackSubtotalCents={localSubtotal}
                itemCount={itemCount}
                deliveryType="DELIVERY"
                pendingShippingText="Calcule acima"
              />
              <Link href="/checkout" className={buttonVariants({ variant: "primary", size: "xl", block: true })}>
                Finalizar compra <ArrowRight aria-hidden />
              </Link>
              <Link href="/" className={buttonVariants({ variant: "ghost", block: true })}>
                Continuar comprando
              </Link>
            </div>
          </section>
        </aside>
      </div>

      {/* Barra fixa no celular: total e botão de finalizar */}
      <div aria-hidden className="h-24 lg:hidden" />
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 border-t border-border bg-background/95 shadow-[0_-12px_32px_-16px_rgb(0_0_0/0.5)] backdrop-blur-md md:bottom-0 md:pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="container-page flex h-[4.5rem] items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">
              {quote?.shipping?.ok && quote.shipping.available ? `Total · ${pluralize(itemCount, "item", "itens")}` : "Total sem o frete"}
            </p>
            <p className="tabular truncate text-lg font-semibold leading-tight">{formatBRL(total)}</p>
          </div>
          <Link href="/checkout" className={buttonVariants({ variant: "primary", size: "lg", className: "shrink-0" })}>
            Finalizar compra <ArrowRight aria-hidden />
          </Link>
        </div>
      </div>
    </>
  );
}

function EmptyCart() {
  return (
    <div className="relative mt-8 overflow-hidden rounded-3xl border border-dashed border-border-strong px-6 py-12 text-center sm:py-16">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="relative mx-auto flex max-w-md flex-col items-center">
        <NextMascot className="h-36 sm:h-44" />
        <Eyebrow className="mt-6">Carrinho vazio</Eyebrow>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Seu carrinho está esperando</h2>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Confira as ofertas da semana ou busque o eletrodoméstico que está faltando na sua casa.
        </p>
        <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link href="/ofertas" className={buttonVariants({ variant: "primary", size: "lg" })}>
            Ver ofertas <ArrowRight aria-hidden />
          </Link>
          <Link href="/lancamentos" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Lançamentos
          </Link>
        </div>
        <Link href="/acompanhar" className="mt-6 flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <PackageSearch className="size-4" aria-hidden /> Já fez um pedido? Acompanhe aqui
        </Link>
      </div>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="mt-6 grid gap-6 sm:mt-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8 xl:gap-10" aria-busy="true" aria-label="Carregando carrinho">
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-2xl" />
        <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="size-20 shrink-0 sm:size-24" />
              <div className="flex-1 space-y-2.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="mt-4 h-10 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
