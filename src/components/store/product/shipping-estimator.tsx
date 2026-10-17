"use client";

import { useEffect, useId, useState } from "react";
import { Bike, ExternalLink, Loader2, MapPin, Store, Truck } from "lucide-react";
import { formatBRL, formatCep, formatKm } from "@/lib/format";
import { onlyDigits, cn } from "@/lib/utils";
import { useCart } from "@/stores/cart";
import { usePurchase } from "./purchase-context";

// Cálculo do frete por motoboy na página do produto (CEP + número). O resultado fica
// guardado no carrinho para o checkout já abrir com o endereço.

type Quote = {
  ok: boolean;
  available: boolean;
  reason?: string;
  feeCents: number;
  originalFeeCents: number;
  free: boolean;
  missingForFreeCents?: number;
  distanceKm: number;
  etaText: string;
  address: { cep: string; street: string; number: string; neighborhood: string; city: string; state: string };
};

export function ShippingEstimator({
  pickup,
  freeShippingAboveCents,
}: {
  pickup: { enabled: boolean; place: string | null; instructions: string };
  freeShippingAboveCents: number | null;
}) {
  const { product, variant, quantity } = usePurchase();
  const id = useId();
  const [cep, setCep] = useState("");
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);

  // Usa o CEP já informado antes (carrinho/checkout), depois de montar no navegador.
  useEffect(() => {
    const s = useCart.getState();
    const saved = s.shipping?.cep || s.address?.cep || "";
    if (saved) {
      setCep(formatCep(saved));
      setNumber(s.shipping?.number || s.address?.number || "");
    }
  }, []);

  // Sem variação escolhida, cota com a mais barata disponível (subtotal conservador).
  const variantForQuote =
    variant ?? [...product.variants].filter((v) => v.inStock).sort((a, b) => a.priceCents - b.priceCents)[0] ?? null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = onlyDigits(cep);
    if (digits.length !== 8) {
      setError("Digite um CEP com 8 números.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cep: digits,
          number: number.trim() || undefined,
          items: [{ productId: product.id, variantId: product.variants.length ? variantForQuote?.id ?? null : null, quantity: Math.max(1, quantity) }],
        }),
      });
      const data = (await res.json().catch(() => null)) as (Quote & { error?: string }) | null;
      if (!res.ok || !data) {
        setQuote(null);
        setError(data?.error || "Não foi possível calcular agora. Tente de novo em instantes.");
        return;
      }
      setQuote(data);
      if (data.ok && data.available) {
        const cart = useCart.getState();
        cart.setShipping({
          cep: digits,
          number: number.trim(),
          feeCents: data.feeCents,
          free: data.free,
          distanceKm: data.distanceKm,
          etaText: data.etaText,
          quotedAt: Date.now(),
        });
        const prev = cart.address;
        const same = prev && onlyDigits(prev.cep) === digits;
        cart.setAddress({
          cep: digits,
          street: data.address.street || (same ? prev.street : ""),
          number: number.trim() || (same ? prev.number : ""),
          complement: same ? prev.complement : "",
          neighborhood: data.address.neighborhood || (same ? prev.neighborhood : ""),
          city: data.address.city || (same ? prev.city : ""),
          state: data.address.state || (same ? prev.state : "PR"),
          reference: same ? prev.reference : "",
        });
      }
    } catch {
      setQuote(null);
      setError("Sem conexão. Confira sua internet e tente de novo.");
    } finally {
      setLoading(false);
    }
  };

  const addr = quote?.address;
  const addrLine = addr && [addr.street && `${addr.street}${addr.number ? `, ${addr.number}` : ""}`, addr.neighborhood, addr.city && `${addr.city}/${addr.state}`].filter(Boolean).join(" · ");

  return (
    <section aria-labelledby={`${id}-t`} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`${id}-t`} className="flex items-center gap-2 text-[15px] font-semibold">
          <Truck className="size-4.5 text-primary" aria-hidden /> Calcular frete
        </h2>
        <a
          href="https://buscacepinter.correios.com.br/app/endereco/index.php"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-9 items-center gap-1 text-[13px] text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          Não sei meu CEP <ExternalLink className="size-3.5" aria-hidden />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      </div>

      <form onSubmit={submit} className="mt-3 flex gap-2" noValidate>
        <div className="min-w-0 flex-[1.4]">
          <label htmlFor={`${id}-cep`} className="sr-only">
            CEP
          </label>
          <input
            id={`${id}-cep`}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            value={cep}
            maxLength={9}
            onChange={(e) => {
              setCep(formatCep(e.target.value));
              setError(null);
            }}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${id}-err` : undefined}
            className="tabular h-11 w-full rounded-xl border border-input bg-background px-3.5 text-[15px] text-foreground placeholder:text-subtle hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 aria-[invalid=true]:border-danger"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-num`} className="sr-only">
            Número (opcional)
          </label>
          <input
            id={`${id}-num`}
            autoComplete="address-line2"
            placeholder="Nº"
            value={number}
            maxLength={20}
            onChange={(e) => setNumber(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-[15px] text-foreground placeholder:text-subtle hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-inverse px-4 text-sm font-medium text-inverse-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {loading ? <span className="sr-only">Calculando</span> : "Calcular"}
        </button>
      </form>

      <div aria-live="polite" className="empty:hidden">
        {error && (
          <p id={`${id}-err`} className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      {!quote && !error && (
        <p className="mt-3 text-[13px] leading-relaxed text-subtle">
          Entregamos por motoboy em Curitiba e região metropolitana.
          {freeShippingAboveCents != null && freeShippingAboveCents > 0 && ` Frete grátis acima de ${formatBRL(freeShippingAboveCents)}.`}
        </p>
      )}

      {(quote || pickup.enabled) && (
        <ul className="mt-4 space-y-2" aria-live="polite">
          {quote && (
            <li className={cn("rounded-xl border px-4 py-3", quote.ok && quote.available ? "border-border bg-elevated" : "border-warning/30 bg-warning-soft")}>
              {quote.ok && quote.available ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Bike className="size-4.5 shrink-0 text-primary" aria-hidden /> Entrega por motoboy
                    </p>
                    <p className="tabular shrink-0 text-right text-sm font-semibold">
                      {quote.free ? (
                        <span className="text-success">
                          Grátis
                          {quote.originalFeeCents > 0 && <s className="ml-1.5 text-xs font-normal text-subtle">{formatBRL(quote.originalFeeCents)}</s>}
                        </span>
                      ) : (
                        formatBRL(quote.feeCents)
                      )}
                    </p>
                  </div>
                  <p className="mt-1 pl-6.5 text-[13px] text-muted-foreground">
                    <span className="tabular">{formatKm(quote.distanceKm)}</span>
                    {quote.etaText && ` · ${quote.etaText}`}
                  </p>
                  {addrLine && (
                    <p className="mt-1 flex items-start gap-1.5 pl-6.5 text-[13px] text-subtle">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {addrLine}
                    </p>
                  )}
                  {!quote.free && quote.missingForFreeCents != null && quote.missingForFreeCents > 0 && (
                    <p className="mt-2 pl-6.5 text-[13px] font-medium text-primary">
                      Faltam {formatBRL(quote.missingForFreeCents)} para ganhar frete grátis.
                    </p>
                  )}
                </>
              ) : (
                <p className="flex items-start gap-2 text-sm text-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  <span>{quote.reason || "Não entregamos nesse endereço."}</span>
                </p>
              )}
            </li>
          )}
          {pickup.enabled && (
            <li className="rounded-xl border border-border px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Store className="size-4.5 shrink-0 text-subtle" aria-hidden /> Retirar na loja
                </p>
                <p className="shrink-0 text-sm font-semibold text-success">Grátis</p>
              </div>
              {(pickup.place || pickup.instructions) && (
                <p className="mt-1 pl-6.5 text-[13px] text-muted-foreground">{pickup.place || pickup.instructions}</p>
              )}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
