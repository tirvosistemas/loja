"use client";

import { useState, useTransition } from "react";
import { Calculator, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { formatBRL, formatKm } from "@/lib/format";
import { cn } from "@/lib/utils";
import { simulateShippingAction, type ShippingInput, type SimulationResult } from "@/app/admin/(panel)/configuracoes/actions";
import { feeBreakdown } from "./fee-breakdown";
import { Callout, Eyebrow, NumberInput, maskCep } from "./form-kit";

function Line({ label, value, muted, strong }: { label: React.ReactNode; value: React.ReactNode; muted?: boolean; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", strong && "border-t border-border pt-2.5 text-base font-semibold")}>
      <dt className={cn("min-w-0", muted ? "text-subtle" : "text-muted-foreground", strong && "text-foreground")}>{label}</dt>
      <dd className={cn("tabular shrink-0 text-right", muted && "text-subtle")}>{value}</dd>
    </div>
  );
}

/** Simula o frete com os valores do formulário (mesmo sem salvar). */
export function ShippingSimulator({ draft }: { draft: ShippingInput }) {
  const [cep, setCep] = useState("");
  const [number, setNumber] = useState("");
  const [subtotal, setSubtotal] = useState<number | null>(50000);
  const [items, setItems] = useState<number | null>(1);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      setError(null);
      let r: Awaited<ReturnType<typeof simulateShippingAction>>;
      try {
        r = await simulateShippingAction({
          shipping: draft,
          cep,
          number,
          subtotalCents: subtotal ?? 0,
          itemCount: Math.max(1, Math.min(99, items ?? 1)),
        });
      } catch {
        setResult(null);
        setError("Falha de conexão. Tente de novo.");
        return;
      }
      if (!r.ok) {
        setResult(null);
        setError(r.error);
        return;
      }
      setResult(r.data ?? null);
    });

  const q = result?.quote;
  const b = result?.breakdown;
  const roundLabel = draft.roundToCents > 1 ? formatBRL(draft.roundToCents) : null;

  return (
    <div className="space-y-4">
      <form
        className="grid grid-cols-2 gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <div>
          <label htmlFor="sim-cep" className="mb-1.5 block text-sm font-medium">
            CEP do cliente
          </label>
          <Input id="sim-cep" inputMode="numeric" placeholder="80000-000" value={cep} onChange={(e) => setCep(maskCep(e.target.value))} />
        </div>
        <div>
          <label htmlFor="sim-number" className="mb-1.5 block text-sm font-medium">
            Número
          </label>
          <Input id="sim-number" value={number} maxLength={20} onChange={(e) => setNumber(e.target.value)} placeholder="Opcional" />
        </div>
        <div>
          <label htmlFor="sim-subtotal" className="mb-1.5 block text-sm font-medium">
            Valor do carrinho
          </label>
          <MoneyInput id="sim-subtotal" value={subtotal} onChange={setSubtotal} />
        </div>
        <div>
          <label htmlFor="sim-items" className="mb-1.5 block text-sm font-medium">
            Itens
          </label>
          <NumberInput id="sim-items" value={items} integer min={1} max={99} onChange={setItems} />
        </div>
        <Button type="submit" className="col-span-2" loading={pending} disabled={cep.replace(/\D/g, "").length !== 8}>
          <Calculator aria-hidden /> Calcular frete
        </Button>
      </form>

      <div aria-live="polite">
        {error && <Callout tone="danger">{error}</Callout>}
        {q && !q.ok && (
          <Callout tone="warning" title="Sem entrega para esse endereço">
            {q.reason}
          </Callout>
        )}
        {q?.ok && b && (
          <div className="rounded-xl border border-border bg-elevated/40 p-4">
            <p className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0">
                {[q.address.street, q.address.number].filter(Boolean).join(", ") || "Endereço do CEP"}
                <span className="block text-[13px] text-subtle">{[q.address.neighborhood, `${q.address.city}/${q.address.state}`].filter(Boolean).join(" · ")}</span>
              </span>
            </p>
            {result?.deliveryDisabled && (
              <Callout tone="warning" className="mt-3">
                A entrega está desligada: este é só um teste dos valores.
              </Callout>
            )}
            <dl className="mt-3 text-sm">
              <Line
                label={
                  <>
                    Distância <span className="text-subtle">· {q.method === "route" ? "rota de carro" : `linha reta × ${String(draft.straightLineFactor).replace(".", ",")}`}</span>
                  </>
                }
                value={formatKm(b.km)}
              />
              {q.method === "straight" && draft.distanceMode === "route" && (
                <p className="pb-1 text-xs text-subtle">A rota de carro não pôde ser calculada; usamos a linha reta com o fator.</p>
              )}
              {!q.available ? (
                <Callout tone="warning" className="mt-2">
                  {q.reason}
                </Callout>
              ) : (
                <>
                  <Line label="Taxa de saída" value={formatBRL(b.baseCents)} />
                  <Line label={`${formatKm(b.km)} × ${formatBRL(draft.pricePerKmCents)}`} value={formatBRL(b.kmCents)} />
                  {b.extraItems > 0 && draft.extraPerItemCents > 0 && (
                    <Line label={`${b.extraItems} ${b.extraItems === 1 ? "item extra" : "itens extras"} × ${formatBRL(draft.extraPerItemCents)}`} value={formatBRL(b.extraCents)} />
                  )}
                  <Line label="Soma" value={formatBRL(b.rawCents)} />
                  <Line label={`Frete mínimo (${formatBRL(draft.minFeeCents)})`} value={b.minApplied ? "aplicado" : "não aplicado"} muted={!b.minApplied} />
                  {roundLabel && <Line label={`Arredondamento para cima (${roundLabel})`} value={b.roundingApplied ? formatBRL(b.roundedCents) : "sem mudança"} muted={!b.roundingApplied} />}
                  {q.free ? (
                    <Line label={<span className="text-success">Frete grátis aplicado</span>} value={<s className="text-subtle">{formatBRL(b.roundedCents)}</s>} />
                  ) : b.outsideFreeRadius ? (
                    <Line label="Frete grátis" value={`só até ${formatKm(draft.freeShippingMaxKm ?? 0)}`} muted />
                  ) : q.missingForFreeCents ? (
                    <Line label="Frete grátis" value={`faltam ${formatBRL(q.missingForFreeCents)}`} muted />
                  ) : null}
                  <Line strong label="Cliente paga" value={q.free ? <span className="text-success">Grátis</span> : formatBRL(q.feeCents)} />
                </>
              )}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

const REFERENCE_KM = [3, 5, 10, 20, 30];

/** Tabela rápida de quanto custa o frete em algumas distâncias, com os valores atuais. */
export function ShippingReferenceTable({ draft }: { draft: ShippingInput }) {
  const cfg = {
    pricePerKmCents: draft.pricePerKmCents,
    baseFeeCents: draft.baseFeeCents,
    minFeeCents: draft.minFeeCents,
    extraPerItemCents: draft.extraPerItemCents,
    maxDistanceKm: draft.maxDistanceKm,
    freeShippingAboveCents: draft.freeShippingAboveCents ?? null,
    freeShippingMaxKm: draft.freeShippingMaxKm ?? null,
    roundToCents: draft.roundToCents,
  };
  return (
    <div>
      <Eyebrow className="mb-2.5">Referência · 1 item</Eyebrow>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-subtle">
            <th scope="col" className="py-2 font-medium">
              Distância
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Frete
            </th>
            {cfg.freeShippingAboveCents != null && (
              <th scope="col" className="py-2 text-right font-medium">
                Acima de {formatBRL(cfg.freeShippingAboveCents)}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="tabular">
          {REFERENCE_KM.map((km) => {
            const b = feeBreakdown(cfg, { distanceKm: km, itemCount: 1, subtotalCents: 0 });
            const free = cfg.freeShippingAboveCents != null && feeBreakdown(cfg, { distanceKm: km, itemCount: 1, subtotalCents: cfg.freeShippingAboveCents }).freeByThreshold;
            return (
              <tr key={km} className="border-b border-border last:border-0">
                <td className="py-2">{formatKm(km)}</td>
                <td className="py-2 text-right font-medium">{b.available ? formatBRL(b.finalCents) : <span className="text-subtle">fora do raio</span>}</td>
                {cfg.freeShippingAboveCents != null && (
                  <td className="py-2 text-right">{!b.available ? "—" : free ? <span className="text-success">grátis</span> : <span className="text-subtle">{formatBRL(b.finalCents)}</span>}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
