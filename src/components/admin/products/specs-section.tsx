"use client";

import { ListPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { NumberInput } from "@/components/admin/settings/form-kit";
import { cn } from "@/lib/utils";
import { FormField, FormSection, RowControls, moveItem, type FormApi } from "./form-kit";
import { rowKey, type SpecRow, type VoltageKey } from "./form-values";

const MAX_SPECS = 60;

const COMMON_LABELS = [
  "Conexão",
  "Bateria",
  "Autonomia",
  "Tempo de carga",
  "Compatibilidade",
  "Potência",
  "Temperatura máxima",
  "Alcance",
  "Material",
  "Cor",
  "Itens inclusos",
  "Dimensões da embalagem",
  "Peso da embalagem",
];

const VOLTAGE_OPTIONS: { value: VoltageKey; label: string }[] = [
  { value: "V110", label: "110V" },
  { value: "V220", label: "220V" },
  { value: "BIVOLT", label: "Bivolt" },
  { value: "NA", label: "Não se aplica (bateria, USB…)" },
];

const PLACEHOLDERS: Record<string, string> = {
  Conexão: "ex.: Bluetooth 5.3",
  Bateria: "ex.: 500 mAh",
  Autonomia: "ex.: Até 20 h",
  "Tempo de carga": "ex.: 2 h",
  Compatibilidade: "ex.: PS5, Xbox, PC e celular",
  Potência: "ex.: 40 W",
  "Temperatura máxima": "ex.: 230 °C",
  Alcance: "ex.: 10 m",
  Material: "ex.: Plástico ABS",
  Cor: "ex.: Preto",
  "Itens inclusos": "ex.: Cabo USB-C, manual",
  "Dimensões da embalagem": "ex.: 20 × 22 × 10 cm",
  "Peso da embalagem": "ex.: 450 g",
};

export function SpecsSection({ form, active }: { form: FormApi; active: boolean }) {
  const { values: v, set, errors: e, clearErrors } = form;
  const specs = v.specs;
  const used = new Set(specs.map((s) => s.label.trim().toLowerCase()));

  const setSpecs = (next: SpecRow[]) => {
    set("specs", next);
    clearErrors("specs");
  };
  const update = (i: number, p: Partial<SpecRow>) => {
    set(
      "specs",
      specs.map((s, j) => (j === i ? { ...s, ...p } : s)),
    );
    for (const k of Object.keys(p)) clearErrors(`specs.${i}.${k}`);
  };
  const add = (label = "") => {
    if (specs.length >= MAX_SPECS) return;
    const row = { key: rowKey(), label, value: "" };
    setSpecs([...specs, row]);
    requestAnimationFrame(() => document.getElementById(`spec-${row.key}-${label ? "value" : "label"}`)?.focus());
  };

  return (
    <FormSection id="ficha" title="Ficha técnica" description="Dados que ajudam o cliente a comparar e decidir. Tudo é opcional." active={active}>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField name="voltage" label="Voltagem" htmlFor="p-voltage" error={e.voltage} hint="Com variações de voltagem, deixe em branco.">
          <Select id="p-voltage" value={v.voltage} onChange={(ev) => set("voltage", ev.target.value as VoltageKey | "")}>
            <option value="">Não informar</option>
            {VOLTAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField name="warrantyMonths" label="Garantia" htmlFor="p-warranty" error={e.warrantyMonths} hint="Do fabricante, em meses.">
          <NumberInput id="p-warranty" integer allowEmpty min={0} max={240} suffix="meses" placeholder="12" value={v.warrantyMonths} onChange={(n) => set("warrantyMonths", n)} aria-invalid={!!e.warrantyMonths} />
        </FormField>
        <FormField name="model" label="Modelo" htmlFor="p-model" error={e.model} hint="Código do fabricante. Também entra na busca do painel.">
          <Input id="p-model" value={v.model} maxLength={80} placeholder="ex.: HS-710" aria-invalid={!!e.model} onChange={(ev) => set("model", ev.target.value)} />
        </FormField>
        <FormField name="color" label="Cor" htmlFor="p-color" error={e.color}>
          <Input id="p-color" value={v.color} maxLength={60} placeholder="ex.: Preto" aria-invalid={!!e.color} onChange={(ev) => set("color", ev.target.value)} />
        </FormField>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <FormField name="weightGrams" label="Peso" htmlFor="p-weight" error={e.weightGrams} hint="Do produto, em gramas (ex.: 1,2 kg = 1200).">
          <NumberInput id="p-weight" integer allowEmpty min={0} max={10_000_000} suffix="g" value={v.weightGrams} onChange={(n) => set("weightGrams", n)} aria-invalid={!!e.weightGrams} />
        </FormField>
        <fieldset data-field="dimensions" className="min-w-0">
          <legend className="mb-1.5 text-sm font-medium">Dimensões do produto (cm)</legend>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["widthCm", "Largura"],
                ["heightCm", "Altura"],
                ["depthCm", "Profundidade"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} data-field={key} className="min-w-0">
                <label htmlFor={`p-${key}`} className="mb-1 block truncate text-xs text-muted-foreground">
                  {label}
                </label>
                <NumberInput id={`p-${key}`} allowEmpty min={0} max={1000} step={0.1} suffix="cm" placeholder="0" value={v[key]} onChange={(n) => set(key, n)} aria-invalid={!!e[key]} />
              </div>
            ))}
          </div>
          <p className={cn("mt-1.5 text-[13px]", e.widthCm || e.heightCm || e.depthCm ? "text-danger" : "text-subtle")}>
            {e.widthCm || e.heightCm || e.depthCm || "Aceita decimais (ex.: 18,5)."}
          </p>
        </fieldset>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <p className="text-sm font-medium" id="specs-title">
            Especificações
          </p>
          <span className="tabular text-xs text-subtle">
            {specs.length}/{MAX_SPECS}
          </span>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Adicionar especificação comum">
          {COMMON_LABELS.map((l) => {
            const taken = used.has(l.toLowerCase());
            return (
              <button
                key={l}
                type="button"
                disabled={taken || specs.length >= MAX_SPECS}
                onClick={() => add(l)}
                className="inline-flex h-9 items-center gap-1 rounded-full border border-border px-3 text-[13px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <Plus className="size-3.5" aria-hidden /> {l}
              </button>
            );
          })}
        </div>

        {specs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-center">
            <ListPlus className="size-5 text-subtle" aria-hidden />
            <p className="max-w-sm text-[13px] text-muted-foreground">Toque num atalho acima ou adicione uma linha para montar a tabela de especificações da página do produto.</p>
          </div>
        ) : (
          <ol aria-labelledby="specs-title" className="space-y-2">
            {specs.map((s, i) => {
              const errLabel = e[`specs.${i}.label`];
              const errValue = e[`specs.${i}.value`];
              return (
                <li key={s.key} data-field={`specs.${i}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-xl border border-border bg-background/40 p-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]">
                  <div data-field={`specs.${i}.label`} className="min-w-0">
                    <label htmlFor={`spec-${s.key}-label`} className="sr-only">
                      Nome da especificação {i + 1}
                    </label>
                    <Input id={`spec-${s.key}-label`} value={s.label} maxLength={60} placeholder="ex.: Conexão" aria-invalid={!!errLabel} onChange={(ev) => update(i, { label: ev.target.value })} className="font-medium" />
                    {errLabel && <p className="mt-1 text-[13px] text-danger">{errLabel}</p>}
                  </div>
                  <div data-field={`specs.${i}.value`} className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                    <label htmlFor={`spec-${s.key}-value`} className="sr-only">
                      Valor de {s.label || `especificação ${i + 1}`}
                    </label>
                    <Input id={`spec-${s.key}-value`} value={s.value} maxLength={300} placeholder={PLACEHOLDERS[s.label] ?? "Valor"} aria-invalid={!!errValue} onChange={(ev) => update(i, { value: ev.target.value })} />
                    {errValue && <p className="mt-1 text-[13px] text-danger">{errValue}</p>}
                  </div>
                  <div className="col-start-2 row-start-1 sm:col-start-3">
                    <RowControls index={i} count={specs.length} label={s.label || `a linha ${i + 1}`} onMove={(from, to) => setSpecs(moveItem(specs, from, to))} onRemove={() => setSpecs(specs.filter((_, j) => j !== i))} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => add()} disabled={specs.length >= MAX_SPECS}>
          <Plus aria-hidden /> Adicionar linha
        </Button>
        {e.specs && <p className="mt-2 text-sm text-danger">{e.specs}</p>}
      </div>
    </FormSection>
  );
}
