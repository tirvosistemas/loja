"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Checkbox, Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/ui/tabs";
import { saveShippingSettings, type ShippingInput } from "@/app/admin/(panel)/configuracoes/actions";
import { Callout, Eyebrow, NumberInput, SaveBar, Section, SettingsField, useSettingsForm } from "./form-kit";
import { ShippingReferenceTable, ShippingSimulator } from "./shipping-simulator";

export type ShippingFormValues = ShippingInput & {
  freeShippingAboveCents: number | null;
  freeShippingMaxKm: number | null;
  allowedCities: string[];
};

const ROUND_OPTIONS = [
  { value: 1, label: "Sem arredondamento" },
  { value: 10, label: "R$ 0,10" },
  { value: 50, label: "R$ 0,50" },
  { value: 100, label: "R$ 1,00" },
] as const;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export function ShippingForm({ initial, rmcCities, originReady }: { initial: ShippingFormValues; rmcCities: string[]; originReady: boolean }) {
  const f = useSettingsForm<ShippingFormValues>(initial, saveShippingSettings);
  const { values: v, set, errors: e } = f;
  const [customCity, setCustomCity] = useState("");

  const selected = new Set(v.allowedCities.map(norm));
  const custom = v.allowedCities.filter((c) => !rmcCities.some((r) => norm(r) === norm(c)));
  const toggleCity = (city: string, on: boolean) =>
    set("allowedCities", on ? [...v.allowedCities, city] : v.allowedCities.filter((c) => norm(c) !== norm(city)));
  const addCustom = () => {
    const c = customCity.trim().replace(/\s+/g, " ");
    if (c.length < 2) return;
    if (!selected.has(norm(c))) set("allowedCities", [...v.allowedCities, c]);
    setCustomCity("");
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <form onSubmit={f.submit} noValidate className="min-w-0 space-y-5">
        {!originReady && (
          <Callout tone="warning" title="Falta localizar o endereço da loja">
            O frete por km precisa do ponto de saída. Cadastre e salve o endereço na aba Endereço e retirada.
          </Callout>
        )}

        <Section title="Entrega por motoboy">
          <Switch
            checked={v.enabled}
            onChange={(c) => set("enabled", c)}
            label="Entrega ativa"
            description={v.enabled ? "Os clientes podem receber em casa." : "Desligada: no checkout só aparece a retirada na loja."}
          />
          <SettingsField name="etaText" label="Texto do prazo" htmlFor="sh-eta" error={e.etaText} hint="Mostrado no carrinho e no checkout.">
            <Input id="sh-eta" value={v.etaText} maxLength={120} placeholder="Entrega em até 24 horas úteis" onChange={(x) => set("etaText", x.target.value)} aria-invalid={!!e.etaText} />
          </SettingsField>
        </Section>

        <Section title="Preço do frete" description="Taxa de saída + km rodado × preço por km (+ adicional por item extra), nunca abaixo do mínimo.">
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField name="pricePerKmCents" label="Preço por km" htmlFor="sh-km" required error={e.pricePerKmCents}>
              <MoneyInput id="sh-km" value={v.pricePerKmCents} onChange={(c) => set("pricePerKmCents", c ?? 0)} aria-invalid={!!e.pricePerKmCents} />
            </SettingsField>
            <SettingsField name="baseFeeCents" label="Taxa de saída" htmlFor="sh-base" hint="Valor fixo cobrado em toda entrega." error={e.baseFeeCents}>
              <MoneyInput id="sh-base" value={v.baseFeeCents} onChange={(c) => set("baseFeeCents", c ?? 0)} aria-invalid={!!e.baseFeeCents} />
            </SettingsField>
            <SettingsField name="minFeeCents" label="Frete mínimo" htmlFor="sh-min" error={e.minFeeCents}>
              <MoneyInput id="sh-min" value={v.minFeeCents} onChange={(c) => set("minFeeCents", c ?? 0)} aria-invalid={!!e.minFeeCents} />
            </SettingsField>
            <SettingsField name="extraPerItemCents" label="Adicional por item extra" htmlFor="sh-extra" hint="Cobrado por unidade a partir da 2ª." error={e.extraPerItemCents}>
              <MoneyInput id="sh-extra" value={v.extraPerItemCents} onChange={(c) => set("extraPerItemCents", c ?? 0)} aria-invalid={!!e.extraPerItemCents} />
            </SettingsField>
            <SettingsField name="roundToCents" label="Arredondar para cima" htmlFor="sh-round" error={e.roundToCents}>
              <Select
                id="sh-round"
                value={String(v.roundToCents)}
                onChange={(x) => set("roundToCents", Number(x.target.value) as ShippingFormValues["roundToCents"])}
              >
                {ROUND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </SettingsField>
          </div>
        </Section>

        <Section title="Distância" description="Como medimos o caminho da loja até o cliente.">
          <div>
            <p className="mb-1.5 text-sm font-medium" id="sh-mode-label">
              Cálculo da distância
            </p>
            <Segmented
              value={v.distanceMode}
              onChange={(m) => set("distanceMode", m)}
              className="w-full sm:w-auto"
              options={[
                { value: "route", label: "Rota real de carro" },
                { value: "straight", label: "Linha reta × fator" },
              ]}
            />
            <p className="mt-1.5 text-[13px] text-subtle">
              {v.distanceMode === "route"
                ? "Usa o trajeto de carro pelo provedor de mapas (aba Integrações). Se a rota falhar, usa a linha reta com o fator."
                : "Mais rápido e sem depender de rotas: distância em linha reta multiplicada pelo fator."}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField name="straightLineFactor" label="Fator da linha reta" htmlFor="sh-factor" error={e.straightLineFactor} hint="Entre 1 e 3. Em Curitiba, 1,3 fica perto da rota real.">
              <NumberInput id="sh-factor" value={v.straightLineFactor} min={1} max={3} step={0.05} suffix="×" onChange={(n) => set("straightLineFactor", n ?? 1)} aria-invalid={!!e.straightLineFactor} />
            </SettingsField>
            <SettingsField name="maxDistanceKm" label="Distância máxima" htmlFor="sh-max" error={e.maxDistanceKm} hint="Acima disso não entregamos. Use 0 para não limitar.">
              <NumberInput id="sh-max" value={v.maxDistanceKm} min={0} max={500} step={0.5} suffix="km" onChange={(n) => set("maxDistanceKm", n ?? 0)} aria-invalid={!!e.maxDistanceKm} />
            </SettingsField>
          </div>
        </Section>

        <Section title="Frete grátis" description="Incentive pedidos maiores. O cupom de frete grátis e os produtos com frete grátis valem sempre.">
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingsField name="freeShippingAboveCents" label="Frete grátis acima de" htmlFor="sh-free" error={e.freeShippingAboveCents} hint="Deixe em branco para não oferecer.">
              <MoneyInput id="sh-free" allowEmpty placeholder="Sem frete grátis" value={v.freeShippingAboveCents} onChange={(c) => set("freeShippingAboveCents", c)} aria-invalid={!!e.freeShippingAboveCents} />
            </SettingsField>
            <SettingsField name="freeShippingMaxKm" label="Frete grátis só até" htmlFor="sh-free-km" error={e.freeShippingMaxKm} hint="Em branco: vale para qualquer distância atendida.">
              <NumberInput
                id="sh-free-km"
                allowEmpty
                value={v.freeShippingMaxKm}
                min={0}
                max={500}
                step={0.5}
                suffix="km"
                placeholder="Sem limite"
                onChange={(n) => set("freeShippingMaxKm", n)}
                aria-invalid={!!e.freeShippingMaxKm}
              />
            </SettingsField>
          </div>
        </Section>

        <Section title="Cidades atendidas" description="Curitiba e região metropolitana. Endereços fora da lista não podem pedir entrega.">
          <Switch
            checked={v.restrictToAllowedCities}
            onChange={(c) => set("restrictToAllowedCities", c)}
            label="Entregar só nas cidades marcadas"
            description={v.restrictToAllowedCities ? undefined : "Desligado: vale apenas a distância máxima."}
          />
          {v.restrictToAllowedCities && (
            <div data-field="allowedCities" className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Eyebrow className="mr-auto">{v.allowedCities.length} marcadas</Eyebrow>
                <Button type="button" size="sm" variant="secondary" className="h-10 sm:h-9" onClick={() => set("allowedCities", [...rmcCities, ...custom])}>
                  Marcar todas
                </Button>
                <Button type="button" size="sm" variant="secondary" className="h-10 sm:h-9" onClick={() => set("allowedCities", ["Curitiba"])}>
                  Só Curitiba
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-10 sm:h-9" onClick={() => set("allowedCities", [])}>
                  Desmarcar
                </Button>
              </div>
              <fieldset>
                <legend className="sr-only">Cidades da região metropolitana</legend>
                <div className="grid grid-cols-1 gap-x-4 gap-y-1 min-[420px]:grid-cols-2 lg:grid-cols-3">
                  {rmcCities.map((c) => (
                    <Checkbox key={c} checked={selected.has(norm(c))} onChange={(on) => toggleCity(c, on)} label={c} className="min-h-10 rounded-lg px-1.5 hover:bg-elevated" />
                  ))}
                </div>
              </fieldset>
              {custom.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Outras cidades</p>
                  <ul className="flex flex-wrap gap-2">
                    {custom.map((c) => (
                      <li key={c} className="inline-flex items-center gap-1 rounded-full border border-border bg-elevated py-1 pl-3 pr-1 text-sm">
                        {c}
                        <button type="button" onClick={() => toggleCity(c, false)} aria-label={`Remover ${c}`} className="grid size-7 place-items-center rounded-full text-subtle hover:bg-muted hover:text-foreground">
                          <X className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <label htmlFor="sh-city" className="sr-only">
                    Adicionar outra cidade
                  </label>
                  <Input
                    id="sh-city"
                    value={customCity}
                    maxLength={80}
                    placeholder="Adicionar outra cidade"
                    onChange={(x) => setCustomCity(x.target.value)}
                    onKeyDown={(x) => {
                      if (x.key === "Enter") {
                        x.preventDefault();
                        addCustom();
                      }
                    }}
                  />
                </div>
                <Button type="button" variant="secondary" onClick={addCustom} disabled={customCity.trim().length < 2}>
                  <Plus aria-hidden /> Adicionar
                </Button>
              </div>
              {e.allowedCities && (
                <p role="alert" className="text-sm text-danger">
                  {e.allowedCities}
                </p>
              )}
            </div>
          )}
        </Section>

        <SaveBar dirty={f.dirty} pending={f.pending} onReset={f.reset} />
      </form>

      <aside className="min-w-0 space-y-5 xl:sticky xl:top-20 xl:self-start" aria-label="Simulador de frete">
        <Section title="Simulador de frete" description="Teste com os valores ao lado, mesmo antes de salvar.">
          <ShippingSimulator draft={v} />
        </Section>
        <Section title="Quanto fica" description="Com os valores atuais do formulário.">
          <ShippingReferenceTable draft={v} />
        </Section>
      </aside>
    </div>
  );
}
