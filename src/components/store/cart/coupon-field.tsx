"use client";

import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Loader2, TicketPercent, X } from "lucide-react";
import { toast } from "sonner";
import type { CartQuoteResponse } from "@/lib/orders/quote";
import { Button } from "@/components/ui/button";
import { useCart } from "@/stores/cart";
import { cn } from "@/lib/utils";

// Campo de cupom. O código fica no carrinho (useCart.couponCode); a validação é do
// servidor, pela cotação. Um código recém-digitado e recusado não fica salvo.

export function CouponField({
  quote,
  loading,
  collapsible = false,
  serverError,
  className,
}: {
  quote: CartQuoteResponse | null;
  loading: boolean;
  collapsible?: boolean;
  /** Erro vindo do envio do pedido (fieldErrors.couponCode). */
  serverError?: string | null;
  className?: string;
}) {
  const id = useId();
  const code = useCart((s) => s.couponCode);
  const setCoupon = useCart((s) => s.setCoupon);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(!collapsible);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = quote?.coupon && quote.coupon.code === code ? quote.coupon : null;

  // Resultado de um código que o cliente acabou de aplicar.
  useEffect(() => {
    if (!pending || loading) return;
    const c = quote?.coupon;
    if (c && c.code === pending) {
      if (c.ok) {
        toast.success(`Cupom ${c.code} aplicado`, { description: c.message ?? undefined });
        setInput("");
      } else {
        setError(c.error || "Cupom inválido.");
        setCoupon("");
      }
    }
    setPending(null);
  }, [pending, loading, quote, setCoupon]);

  const apply = (e?: React.FormEvent) => {
    e?.preventDefault();
    const value = input.trim().toUpperCase();
    if (!value) {
      setError("Digite o código do cupom.");
      return;
    }
    if (value.length > 40) {
      setError("Código muito longo.");
      return;
    }
    setError(null);
    setPending(value);
    setCoupon(value);
  };

  const removeCoupon = () => {
    setCoupon("");
    setPending(null);
    setError(null);
  };

  // Cupom aplicado (válido ou que deixou de valer).
  if (code && pending !== code) {
    const invalid = status && !status.ok;
    const message = serverError || (invalid ? status.error : status?.message);
    return (
      <div
        className={cn(
          "rounded-xl border px-3.5 py-3",
          invalid || serverError ? "border-danger/30 bg-danger-soft" : "border-success/30 bg-success-soft",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
            {!status && loading ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-subtle" aria-hidden />
            ) : invalid || serverError ? (
              <X className="size-4 shrink-0 text-danger" aria-hidden />
            ) : (
              <Check className="size-4 shrink-0 text-success" aria-hidden />
            )}
            <span className="truncate font-mono tracking-wide">{code}</span>
          </p>
          <button
            type="button"
            onClick={removeCoupon}
            className="-my-1 -mr-1.5 min-h-10 shrink-0 rounded-lg px-2.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Remover <span className="sr-only">cupom {code}</span>
          </button>
        </div>
        {message && (
          <p role={invalid || serverError ? "alert" : "status"} className={cn("mt-1 text-[13px]", invalid || serverError ? "text-danger" : "text-success")}>
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {collapsible && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`${id}-form`}
          className="flex min-h-10 w-full items-center justify-between gap-2 text-sm font-medium text-foreground hover:text-primary"
        >
          <span className="flex items-center gap-2">
            <TicketPercent className="size-4 text-primary" aria-hidden /> Tem um cupom de desconto?
          </span>
          <ChevronDown className={cn("size-4 text-subtle transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`${id}-form`}
            initial={collapsible ? { height: 0, opacity: 0 } : false}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* div em vez de form: o campo também aparece dentro do formulário do checkout */}
            <div className={cn(collapsible && "pt-2")}>
              {!collapsible && (
                <label htmlFor={`${id}-code`} className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                  <TicketPercent className="size-4 text-primary" aria-hidden /> Cupom de desconto
                </label>
              )}
              <div className="flex gap-2">
                <input
                  id={`${id}-code`}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value.toUpperCase().replace(/\s+/g, ""));
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") apply(e);
                  }}
                  maxLength={40}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Digite o código"
                  aria-label={collapsible ? "Código do cupom" : undefined}
                  aria-invalid={!!error || undefined}
                  aria-describedby={error ? `${id}-err` : undefined}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3.5 font-mono text-[15px] uppercase tracking-wide text-foreground placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-subtle hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 aria-[invalid=true]:border-danger"
                />
                <Button variant="inverse" onClick={() => apply()} loading={!!pending} className="shrink-0">
                  Aplicar
                </Button>
              </div>
              {error && (
                <p id={`${id}-err`} role="alert" className="mt-1.5 text-[13px] text-danger">
                  {error}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
