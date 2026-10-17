"use client";

import { useEffect, useId, useState } from "react";
import { Bike, ExternalLink, Loader2, MapPin, Store } from "lucide-react";
import type { CartQuoteResponse } from "@/lib/orders/quote";
import { formatBRL, formatCep, formatKm } from "@/lib/format";
import { cn, onlyDigits } from "@/lib/utils";

// Cálculo do frete no carrinho (CEP + número). O resultado vem da mesma cotação do
// resumo, então o valor mostrado aqui é o que vai para o checkout.

export type ShipTo = { cep: string; number: string };

export function ShippingCalculator({
  value,
  onSubmit,
  quote,
  loading,
  pickup,
}: {
  value: ShipTo | null;
  onSubmit: (v: ShipTo) => void;
  quote: CartQuoteResponse | null;
  loading: boolean;
  pickup: { enabled: boolean; place: string | null };
}) {
  const id = useId();
  const [cep, setCep] = useState(value ? formatCep(value.cep) : "");
  const [number, setNumber] = useState(value?.number ?? "");
  const [error, setError] = useState<string | null>(null);

  // Endereço salvo chega depois de montar no navegador.
  useEffect(() => {
    if (!value) return;
    setCep(formatCep(value.cep));
    setNumber(value.number);
  }, [value]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = onlyDigits(cep);
    if (digits.length !== 8) {
      setError("Digite um CEP com 8 números.");
      return;
    }
    if (!number.trim()) {
      setError("Informe o número do endereço para calcular a distância.");
      return;
    }
    setError(null);
    onSubmit({ cep: digits, number: number.trim() });
  };

  const s = value ? quote?.shipping : null;
  const busy = !!value && loading;
  const addr = s?.address;
  const addrLine =
    addr &&
    [addr.street && `${addr.street}${addr.number ? `, ${addr.number}` : ""}`, addr.neighborhood, addr.city && `${addr.city}/${addr.state}`]
      .filter(Boolean)
      .join(" · ");

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p id={`${id}-t`} className="flex items-center gap-2 text-sm font-medium">
          <Bike className="size-4 text-primary" aria-hidden /> Calcular frete
        </p>
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
      <form onSubmit={submit} noValidate aria-labelledby={`${id}-t`} className="mt-2 flex gap-2">
        <div className="min-w-0 flex-[1.4]">
          <label htmlFor={`${id}-cep`} className="sr-only">
            CEP
          </label>
          <input
            id={`${id}-cep`}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            maxLength={9}
            value={cep}
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
            Número
          </label>
          <input
            id={`${id}-num`}
            placeholder="Nº"
            maxLength={20}
            value={number}
            onChange={(e) => {
              setNumber(e.target.value);
              setError(null);
            }}
            className="h-11 w-full rounded-xl border border-input bg-background px-3.5 text-[15px] text-foreground placeholder:text-subtle hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-inverse px-4 text-sm font-medium text-inverse-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {busy ? <span className="sr-only">Calculando</span> : "Calcular"}
        </button>
      </form>

      <div aria-live="polite">
        {error && (
          <p id={`${id}-err`} role="alert" className="mt-2 text-[13px] text-danger">
            {error}
          </p>
        )}
        {s && !busy && (
          <div
            className={cn(
              "mt-3 rounded-xl border px-3.5 py-3",
              s.ok && s.available ? "border-border bg-elevated" : "border-warning/30 bg-warning-soft",
            )}
          >
            {s.ok && s.available ? (
              <>
                <div className="flex items-start justify-between gap-3 text-sm">
                  <p className="font-medium">Entrega por motoboy</p>
                  <p className="tabular shrink-0 font-semibold">
                    {s.free ? <span className="text-success">Grátis</span> : formatBRL(s.feeCents)}
                  </p>
                </div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  <span className="tabular">{formatKm(s.distanceKm)}</span>
                  {s.etaText && ` · ${s.etaText}`}
                </p>
                {addrLine && (
                  <p className="mt-1 flex items-start gap-1.5 text-[13px] text-subtle">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {addrLine}
                  </p>
                )}
              </>
            ) : (
              <p className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <span>{s.reason || "Não entregamos nesse endereço."}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {pickup.enabled && (
        <div className="mt-2 flex items-start justify-between gap-3 rounded-xl border border-border px-3.5 py-3 text-sm">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-medium">
              <Store className="size-4 shrink-0 text-subtle" aria-hidden /> Retirar na loja
            </p>
            {pickup.place && <p className="mt-0.5 text-[13px] text-muted-foreground">{pickup.place}</p>}
          </div>
          <p className="shrink-0 font-semibold text-success">Grátis</p>
        </div>
      )}
    </div>
  );
}
