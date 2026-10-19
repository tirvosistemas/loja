"use client";

import { useState } from "react";
import { Layers, Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Switch } from "@/components/ui/switch";
import { NumberInput } from "@/components/admin/settings/form-kit";
import { formatBRL, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FormField, FormSection, RowControls, moveItem, type FormApi } from "./form-kit";
import { rowKey, type VariantRow } from "./form-values";

const LABELS = ["Voltagem", "Cor", "Tamanho", "Capacidade"];
const CUSTOM = "__outro";
const MAX_VARIANTS = 50;

const PRESETS = [
  { label: "110V e 220V", group: "Voltagem", names: ["110V", "220V"] },
  { label: "Bivolt", group: "Voltagem", names: ["Bivolt"] },
  { label: "Preto e Branco", group: "Cor", names: ["Preto", "Branco"] },
];

function newVariant(name = ""): VariantRow {
  return { key: rowKey(), id: null, name, sku: "", priceCents: null, compareAtCents: null, stock: 0, active: true };
}

function focusVariant(key: string) {
  requestAnimationFrame(() => document.getElementById(`v-${key}-name`)?.focus());
}

export function VariantsSection({ form, active }: { form: FormApi; active: boolean }) {
  const { values: v, set, patch, errors: e, clearErrors } = form;
  const [custom, setCustom] = useState(!!v.variantLabel && !LABELS.includes(v.variantLabel));
  const list = v.variants;
  const totalStock = list.filter((x) => x.active).reduce((n, x) => n + x.stock, 0);

  const update = (i: number, p: Partial<VariantRow>) => {
    set(
      "variants",
      list.map((x, j) => (j === i ? { ...x, ...p } : x)),
    );
    for (const k of Object.keys(p)) clearErrors(`variants.${i}.${k}`);
  };
  const setList = (next: VariantRow[]) => {
    set("variants", next);
    clearErrors("variants");
  };
  const add = () => {
    if (list.length >= MAX_VARIANTS) return;
    const row = newVariant();
    setList([...list, row]);
    focusVariant(row.key);
  };
  const applyPreset = (p: (typeof PRESETS)[number]) => {
    const existing = new Set(list.map((x) => x.name.trim().toLowerCase()));
    const added = p.names.filter((n) => !existing.has(n.toLowerCase())).map((n) => newVariant(n));
    const label = !list.length || !v.variantLabel ? p.group : v.variantLabel;
    patch({ variantLabel: label, variants: [...list, ...added].slice(0, MAX_VARIANTS) });
    setCustom(!LABELS.includes(label));
    clearErrors("variantLabel");
    clearErrors("variants");
  };

  const selectValue = custom ? CUSTOM : v.variantLabel;

  return (
    <FormSection
      id="variacoes"
      title="Variações"
      description="Opcional. Use quando o mesmo produto tem opções, como voltagem ou cor. Cada opção tem estoque próprio e pode ter preço próprio."
      active={active}
    >
      <div>
        <p className="mb-2 text-sm font-medium">Atalhos</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-elevated px-3.5 text-sm transition-colors hover:border-primary/50 hover:text-foreground"
            >
              <Zap className="size-3.5 text-primary" aria-hidden /> {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          name="variantLabel"
          label="Nome do grupo"
          htmlFor="p-variant-label"
          error={e.variantLabel}
          hint="É o título que o cliente vê acima das opções (ex.: Voltagem)."
          required={list.length > 0}
        >
          <Select
            id="p-variant-label"
            value={selectValue}
            aria-invalid={!!e.variantLabel}
            onChange={(ev) => {
              const val = ev.target.value;
              if (val === CUSTOM) {
                setCustom(true);
                set("variantLabel", LABELS.includes(v.variantLabel) ? "" : v.variantLabel);
              } else {
                setCustom(false);
                set("variantLabel", val);
              }
            }}
          >
            <option value="">Escolha…</option>
            {LABELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
            <option value={CUSTOM}>Outro nome…</option>
          </Select>
        </FormField>
        {custom && (
          <FormField name="variantLabelCustom" label="Nome personalizado" htmlFor="p-variant-custom">
            <Input
              id="p-variant-custom"
              value={v.variantLabel}
              maxLength={40}
              placeholder="ex.: Modelo, Kit, Acabamento"
              aria-invalid={!!e.variantLabel}
              onChange={(ev) => set("variantLabel", ev.target.value)}
            />
          </FormField>
        )}
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <span className="grid size-11 place-items-center rounded-2xl bg-elevated text-muted-foreground">
            <Layers className="size-5" aria-hidden />
          </span>
          <div className="max-w-sm">
            <p className="text-sm font-medium">Sem variações</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">O produto é vendido como item único, com o preço e o estoque da seção anterior.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={add}>
            <Plus aria-hidden /> Adicionar variação
          </Button>
        </div>
      ) : (
        <>
          <ol className="space-y-3">
            {list.map((x, i) => {
              const err = (k: string) => e[`variants.${i}.${k}`];
              const id = (k: string) => `v-${x.key}-${k}`;
              const effective = x.priceCents ?? v.priceCents ?? 0;
              return (
                <li key={x.key} data-field={`variants.${i}`} className={cn("rounded-xl border bg-background/40 p-3 sm:p-4", x.active ? "border-border" : "border-dashed border-border")}>
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="mt-3 w-6 shrink-0 font-mono text-[11px] text-subtle">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <FormField name={`variants.${i}.name`} error={err("name")} className="flex-1">
                      <label htmlFor={id("name")} className="sr-only">
                        Nome da variação {i + 1}
                      </label>
                      <Input
                        id={id("name")}
                        value={x.name}
                        maxLength={80}
                        placeholder={v.variantLabel === "Cor" ? "ex.: Preto" : "ex.: 220V"}
                        aria-invalid={!!err("name")}
                        onChange={(ev) => update(i, { name: ev.target.value })}
                        className="font-medium"
                      />
                    </FormField>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:pl-9 lg:grid-cols-4">
                    <FormField name={`variants.${i}.sku`} label={<span className="text-[13px]">SKU</span>} htmlFor={id("sku")} error={err("sku")}>
                      <Input id={id("sku")} value={x.sku} maxLength={64} spellCheck={false} className="font-mono text-sm" aria-invalid={!!err("sku")} onChange={(ev) => update(i, { sku: ev.target.value })} />
                    </FormField>
                    <FormField name={`variants.${i}.stock`} label={<span className="text-[13px]">Estoque</span>} htmlFor={id("stock")} error={err("stock")}>
                      <NumberInput id={id("stock")} integer min={0} max={1_000_000} suffix="un." value={x.stock} onChange={(n) => update(i, { stock: Math.max(0, n ?? 0) })} aria-invalid={!!err("stock")} />
                    </FormField>
                    <FormField name={`variants.${i}.priceCents`} label={<span className="text-[13px]">Preço próprio</span>} htmlFor={id("price")} error={err("priceCents")}>
                      <MoneyInput id={id("price")} value={x.priceCents} allowEmpty placeholder={v.priceCents ? formatBRL(v.priceCents).replace(/^R\$\s?/, "") : "0,00"} onChange={(c) => update(i, { priceCents: c })} aria-invalid={!!err("priceCents")} />
                    </FormField>
                    <FormField name={`variants.${i}.compareAtCents`} label={<span className="text-[13px]">Preço “de”</span>} htmlFor={id("compare")} error={err("compareAtCents")}>
                      <MoneyInput id={id("compare")} value={x.compareAtCents} allowEmpty onChange={(c) => update(i, { compareAtCents: c })} aria-invalid={!!err("compareAtCents")} />
                    </FormField>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 sm:ml-9">
                    <div className="flex items-center gap-3">
                      <Switch checked={x.active} onChange={(on) => update(i, { active: on })} label={<span className="text-[13px] font-normal">Disponível</span>} className="flex-row-reverse items-center gap-2.5" />
                      <span className="tabular hidden text-xs text-subtle sm:inline">
                        {x.priceCents == null ? "Usa o preço do produto" : `Vende por ${formatBRL(effective)}`}
                      </span>
                    </div>
                    <RowControls index={i} count={list.length} label={`a variação ${x.name || i + 1}`} onMove={(from, to) => setList(moveItem(list, from, to))} onRemove={() => setList(list.filter((_, j) => j !== i))} />
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" size="sm" onClick={add} disabled={list.length >= MAX_VARIANTS}>
              <Plus aria-hidden /> Adicionar variação
            </Button>
            <p className="tabular text-[13px] text-muted-foreground">
              {pluralize(list.length, "variação", "variações")} · {pluralize(totalStock, "unidade", "unidades")} em estoque
            </p>
          </div>
          {e.variants && <p className="text-sm text-danger">{e.variants}</p>}
        </>
      )}
    </FormSection>
  );
}
