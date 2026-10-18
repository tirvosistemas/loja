"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Bike, Clock, ExternalLink, Loader2, MapPin, Store } from "lucide-react";
import type { QuoteShipping } from "@/lib/orders/quote";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/tabs";
import { formatBRL, formatCep, formatKm } from "@/lib/format";
import { cn, onlyDigits } from "@/lib/utils";
import type { CheckoutForm, DeliveryType, FieldErrors } from "./form";

const UFS = ["PR", "SC", "SP", "RS", "MG", "RJ", "MS", "GO", "DF", "ES", "BA", "MT", "TO", "PE", "CE", "PA", "AM", "MA", "PB", "RN", "AL", "SE", "PI", "RO", "AC", "AP", "RR"];

export type PickupInfo = { place: string | null; instructions: string; hours: string };

// Ao trocar entre entrega e retirada, os erros do endereço deixam de valer (os campos somem).
const ADDRESS_ERRORS = ["deliveryType", "address", "address.cep", "address.street", "address.number", "address.complement", "address.neighborhood", "address.city", "address.state", "address.reference"];

export function DeliveryFields({
  form,
  errors,
  onChange,
  options,
  pickup,
  shipping,
  quoting,
  addressReady,
}: {
  form: CheckoutForm;
  errors: FieldErrors;
  onChange: (patch: Partial<CheckoutForm>, clear?: string[]) => void;
  options: { delivery: boolean; pickup: boolean };
  pickup: PickupInfo;
  shipping: QuoteShipping | null;
  quoting: boolean;
  addressReady: boolean;
}) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const filledFor = useRef<string>(onlyDigits(form.cep));
  const lookupSeq = useRef(0);

  const err = (k: string) => errors[k];

  const lookup = async (digits: string) => {
    const seq = ++lookupSeq.current;
    setCepLoading(true);
    setCepError(null);
    try {
      const res = await fetch(`/api/cep/${digits}`);
      if (seq !== lookupSeq.current) return;
      if (res.status === 404) {
        setCepError("CEP não encontrado. Confira os números ou preencha o endereço abaixo.");
        return;
      }
      if (!res.ok) {
        setCepError("Não conseguimos consultar o CEP agora. Preencha o endereço abaixo.");
        return;
      }
      const info = (await res.json()) as { street: string; neighborhood: string; city: string; state: string };
      filledFor.current = digits;
      onChange(
        {
          street: info.street || "",
          neighborhood: info.neighborhood || "",
          city: info.city || "",
          state: (info.state || "PR").toUpperCase(),
        },
        ["address", "address.cep", "address.street", "address.neighborhood", "address.city", "address.state"],
      );
      // Leva o cliente direto ao próximo campo que falta.
      setTimeout(() => {
        const next = !info.street ? "co-street" : !form.number ? "co-number" : null;
        if (next) document.getElementById(next)?.focus();
      }, 0);
    } catch {
      if (seq === lookupSeq.current) setCepError("Sem conexão para consultar o CEP. Preencha o endereço abaixo.");
    } finally {
      if (seq === lookupSeq.current) setCepLoading(false);
    }
  };

  const onCep = (value: string) => {
    const masked = formatCep(value);
    const digits = onlyDigits(masked);
    onChange({ cep: masked }, ["address", "address.cep"]);
    setCepError(null);
    if (digits.length === 8 && digits !== filledFor.current) void lookup(digits);
  };

  const choices: { value: DeliveryType; label: React.ReactNode }[] = [];
  if (options.delivery)
    choices.push({
      value: "DELIVERY",
      label: (
        <>
          <Bike className="size-4" aria-hidden /> <span className="sm:hidden">Motoboy</span>
          <span className="max-sm:hidden">Entrega por motoboy</span>
        </>
      ),
    });
  if (options.pickup)
    choices.push({ value: "PICKUP", label: <><Store className="size-4" aria-hidden /> Retirar na loja</> });

  const input = (k: keyof CheckoutForm, key: string) => ({
    value: String(form[k] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange({ [k]: e.target.value } as Partial<CheckoutForm>, [key, "address"]),
    "aria-invalid": !!err(key) || undefined,
  });

  return (
    <div>
      {choices.length > 1 && (
        <div id="co-delivery" tabIndex={-1} className="outline-none">
          <Segmented
            value={form.deliveryType}
            onChange={(v) => onChange({ deliveryType: v }, ADDRESS_ERRORS)}
            options={choices}
            className="flex w-full [&>button]:min-h-10"
          />
        </div>
      )}
      {err("deliveryType") && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {err("deliveryType")}
        </p>
      )}

      {form.deliveryType === "DELIVERY" ? (
        <div className={cn(choices.length > 1 && "mt-5")}>
          <div className="grid grid-cols-6 gap-4">
            <Field
              label="CEP"
              htmlFor="co-cep"
              required
              className="col-span-6 sm:col-span-3"
              error={(err("address.cep") || cepError) && <span id="co-cep-err">{err("address.cep") || cepError}</span>}
            >
              <Input
                id="co-cep"
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="00000-000"
                maxLength={9}
                value={form.cep}
                onChange={(e) => onCep(e.target.value)}
                aria-invalid={!!err("address.cep") || undefined}
                aria-describedby={err("address.cep") || cepError ? "co-cep-err" : undefined}
                aria-required
                className="tabular"
                trailing={cepLoading ? <Loader2 className="mr-1.5 size-4 animate-spin text-subtle" aria-label="Buscando CEP" /> : undefined}
              />
            </Field>
            <div className="col-span-6 flex items-end sm:col-span-3 sm:pb-2.5">
              <a
                href="https://buscacepinter.correios.com.br/app/endereco/index.php"
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-10 items-center gap-1 text-[13px] text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                Não sei meu CEP <ExternalLink className="size-3.5" aria-hidden />
                <span className="sr-only">(abre em nova aba)</span>
              </a>
            </div>
            <Field label="Rua" htmlFor="co-street" required error={err("address.street")} className="col-span-6">
              <Input id="co-street" autoComplete="address-line1" maxLength={160} aria-required {...input("street", "address.street")} />
            </Field>
            <Field label="Número" htmlFor="co-number" required error={err("address.number")} className="col-span-2">
              <Input id="co-number" autoComplete="off" maxLength={20} aria-required {...input("number", "address.number")} />
            </Field>
            <Field label="Complemento" htmlFor="co-complement" error={err("address.complement")} className="col-span-4">
              <Input id="co-complement" autoComplete="address-line2" placeholder="Apto, bloco, casa…" maxLength={120} {...input("complement", "address.complement")} />
            </Field>
            <Field label="Bairro" htmlFor="co-neighborhood" required error={err("address.neighborhood")} className="col-span-6 sm:col-span-3">
              <Input id="co-neighborhood" maxLength={120} aria-required {...input("neighborhood", "address.neighborhood")} />
            </Field>
            <Field label="Cidade" htmlFor="co-city" required error={err("address.city")} className="col-span-4 sm:col-span-2">
              <Input id="co-city" autoComplete="address-level2" maxLength={120} aria-required {...input("city", "address.city")} />
            </Field>
            <Field label="UF" htmlFor="co-state" required error={err("address.state")} className="col-span-2 sm:col-span-1">
              <select
                id="co-state"
                autoComplete="address-level1"
                value={form.state}
                onChange={(e) => onChange({ state: e.target.value }, ["address.state", "address"])}
                aria-invalid={!!err("address.state") || undefined}
                className="h-11 w-full appearance-none rounded-xl border border-input bg-card px-3 text-center text-[15px] text-foreground hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              >
                {(UFS.includes(form.state) ? UFS : [form.state, ...UFS]).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Ponto de referência"
              htmlFor="co-reference"
              hint="Ajuda o motoboy a achar mais rápido."
              error={err("address.reference")}
              className="col-span-6"
            >
              <Input id="co-reference" placeholder="Ex.: portão azul, ao lado da farmácia" maxLength={160} {...input("reference", "address.reference")} />
            </Field>
          </div>

          <div aria-live="polite" className="mt-5">
            <ShippingResult
              shipping={shipping}
              quoting={quoting}
              addressReady={addressReady}
              error={err("address")}
              onPickup={options.pickup ? () => onChange({ deliveryType: "PICKUP" }, ADDRESS_ERRORS) : undefined}
            />
          </div>
        </div>
      ) : (
        <div className={cn("rounded-2xl border border-border bg-elevated p-4 sm:p-5", choices.length > 1 && "mt-5")}>
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <Store className="size-4.5 text-primary" aria-hidden /> Retirada na loja · <span className="text-success">grátis</span>
          </p>
          {pickup.place && (
            <p className="mt-2 flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden /> {pickup.place}
            </p>
          )}
          {pickup.hours && (
            <p className="mt-1.5 flex items-start gap-2 text-sm text-muted-foreground">
              <Clock className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden /> {pickup.hours}
            </p>
          )}
          {pickup.instructions && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{pickup.instructions}</p>}
          <p className="mt-3 text-[13px] text-subtle">Avisamos no WhatsApp quando o pedido estiver separado para retirada.</p>
        </div>
      )}
    </div>
  );
}

function ShippingResult({
  shipping,
  quoting,
  addressReady,
  error,
  onPickup,
}: {
  shipping: QuoteShipping | null;
  quoting: boolean;
  addressReady: boolean;
  error?: string;
  onPickup?: () => void;
}) {
  if (!addressReady) {
    return (
      <p className={cn("flex items-start gap-2 rounded-xl border border-dashed px-4 py-3 text-sm", error ? "border-danger/40 text-danger" : "border-border text-muted-foreground")}>
        <Bike className="mt-0.5 size-4 shrink-0" aria-hidden />
        {error || "Informe o CEP e o número para calcular o frete por motoboy."}
      </p>
    );
  }
  if (quoting || !shipping) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-border bg-elevated px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Calculando o frete até o seu endereço…
      </p>
    );
  }
  if (!shipping.ok || !shipping.available) {
    return (
      <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3.5">
        <p className="flex items-start gap-2 text-sm font-medium text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          {shipping.reason || "Não entregamos nesse endereço."}
        </p>
        {onPickup && (
          <button
            type="button"
            onClick={onPickup}
            className="mt-2 flex min-h-10 items-center gap-2 pl-6 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <Store className="size-4" aria-hidden /> Prefiro retirar na loja
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-success/30 bg-success-soft px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Bike className="size-4.5 shrink-0 text-success" aria-hidden /> Entregamos no seu endereço
        </p>
        <p className="tabular shrink-0 text-sm font-semibold">
          {shipping.free ? (
            <span className="text-success">
              {shipping.originalFeeCents > 0 && <s className="mr-1.5 text-xs font-normal text-subtle">{formatBRL(shipping.originalFeeCents)}</s>}
              Grátis
            </span>
          ) : (
            formatBRL(shipping.feeCents)
          )}
        </p>
      </div>
      <p className="mt-1 pl-6.5 text-[13px] text-muted-foreground">
        <span className="tabular">{formatKm(shipping.distanceKm)}</span> da loja{shipping.etaText && ` · ${shipping.etaText}`}
      </p>
      {!shipping.free && shipping.missingForFreeCents != null && shipping.missingForFreeCents > 0 && (
        <p className="mt-1.5 pl-6.5 text-[13px] font-medium text-primary">
          Faltam {formatBRL(shipping.missingForFreeCents)} em produtos para ganhar frete grátis.
        </p>
      )}
    </div>
  );
}
