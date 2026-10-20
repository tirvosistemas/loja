"use client";

import { useState } from "react";
import { BadgePercent, Calculator, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Switch } from "@/components/ui/switch";
import { NumberInput } from "@/components/admin/settings/form-kit";
import { formatBRL, pluralize } from "@/lib/format";
import { cn, onlyDigits } from "@/lib/utils";
import { priceBreakdown, suggestPrice, type PriceCalcConfig } from "@/lib/price-calc";
import { FormField, FormSection, type FormApi } from "./form-kit";
import { BarcodeTools } from "./barcode-tools";

/** Sugere o preço pelo custo e mostra quanto sobra de verdade (taxa, imposto e embalagem). */
function PriceCalculator({ form, cfg }: { form: FormApi; cfg: PriceCalcConfig }) {
  const { values: v, set } = form;
  const [margin, setMargin] = useState<number | null>(cfg.targetMarginPercent);
  const cost = v.costCents ?? 0;
  const suggested = cost > 0 && margin != null ? suggestPrice(cost, cfg, margin) : null;
  const price = v.priceCents ?? 0;
  const card = price > 0 ? priceBreakdown(price, cost, cfg, "card") : null;
  const pix = price > 0 ? priceBreakdown(price, cost, cfg, "pix") : null;
  return (
    <div className="space-y-4 rounded-xl border border-border bg-background/40 p-4" aria-live="polite">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Calculator className="size-4 text-primary" aria-hidden /> Calculadora de preço
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="w-36 text-sm">
          <span className="mb-1.5 block text-[13px] text-muted-foreground">Margem desejada</span>
          <NumberInput value={margin} onChange={setMargin} allowEmpty min={0} max={80} step={0.5} suffix="%" />
        </label>
        <div className="min-w-0 flex-1 text-sm">
          {!cost ? (
            <p className="text-muted-foreground">Informe o custo para ver o preço sugerido.</p>
          ) : suggested ? (
            <p>
              Preço sugerido <span className="tabular text-lg font-semibold text-primary">{formatBRL(suggested)}</span>
            </p>
          ) : (
            <p className="text-warning">Taxas, imposto e margem somam demais: reduza a margem.</p>
          )}
        </div>
        {suggested && suggested !== price && (
          <Button type="button" size="sm" variant="secondary" onClick={() => set("priceCents", suggested)}>
            Usar {formatBRL(suggested)}
          </Button>
        )}
      </div>
      {card && pix && cost > 0 && (
        <div className="grid gap-2 text-[13px] sm:grid-cols-2">
          {[
            { label: "No cartão", b: card },
            { label: "No Pix", b: pix },
          ].map(({ label, b }) => (
            <div key={label} className="rounded-lg border border-border px-3 py-2">
              <p className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{label}, sobra</span>
                <span className={cn("tabular font-semibold", b.profitCents > 0 ? "text-success" : "text-danger")}>
                  {formatBRL(b.profitCents)} ({b.marginPercent.toLocaleString("pt-BR")}%)
                </span>
              </p>
              <p className="tabular mt-0.5 text-subtle">
                taxa {formatBRL(b.feeCents)} · imposto {formatBRL(b.taxCents)} · custo + embalagem {formatBRL(b.fixedCents)}
              </p>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-subtle">
        Taxas e embalagem vêm de{" "}
        <a href="/admin/configuracoes?aba=catalogo" className="underline-offset-4 hover:underline">
          Configurações → Ferramentas do catálogo
        </a>
        .
      </p>
    </div>
  );
}

export function PricingSection({
  form,
  active,
  price: priceCfg,
  productId,
  onBrandFound,
}: {
  form: FormApi;
  active: boolean;
  price: PriceCalcConfig;
  productId: string | null;
  onBrandFound: (b: { id: string | null; name: string }) => void;
}) {
  const { values: v, set, errors: e } = form;
  const [existing, setExisting] = useState<{ id: string; name: string } | null>(null);
  const price = v.priceCents ?? 0;
  const cost = v.costCents;
  const profit = cost != null && price > 0 ? price - cost : null;
  const margin = profit != null && price > 0 ? Math.round((profit / price) * 1000) / 10 : null;
  const discount = v.compareAtCents && price > 0 && v.compareAtCents > price ? Math.round((1 - price / v.compareAtCents) * 100) : null;
  const hasVariants = v.variants.length > 0;
  const variantStock = v.variants.filter((x) => x.active).reduce((n, x) => n + x.stock, 0);

  return (
    <FormSection id="preco" title="Preço e estoque" description="Valores em reais. As promoções automáticas mudam o preço exibido sem alterar este cadastro." active={active}>
      <div className="grid gap-5 sm:grid-cols-3">
        <FormField name="priceCents" label="Preço de venda" htmlFor="p-price" required error={e.priceCents}>
          <MoneyInput id="p-price" value={v.priceCents} allowEmpty onChange={(c) => set("priceCents", c)} aria-invalid={!!e.priceCents} />
        </FormField>
        <FormField name="compareAtCents" label="Preço “de”" htmlFor="p-compare" error={e.compareAtCents} hint="Aparece riscado. Precisa ser maior que o preço.">
          <MoneyInput id="p-compare" value={v.compareAtCents} allowEmpty onChange={(c) => set("compareAtCents", c)} aria-invalid={!!e.compareAtCents} />
        </FormField>
        <FormField name="costCents" label="Custo" htmlFor="p-cost" error={e.costCents} hint="Só você vê. Serve para calcular a margem.">
          <MoneyInput id="p-cost" value={v.costCents} allowEmpty onChange={(c) => set("costCents", c)} aria-invalid={!!e.costCents} />
        </FormField>
      </div>

      <PriceCalculator form={form} cfg={priceCfg} />

      {(profit != null || discount != null) && (
        <div className="grid gap-3 sm:grid-cols-2" aria-live="polite">
          {profit != null && margin != null && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 px-4 py-3">
              <TrendingUp className={cn("size-5 shrink-0", profit > 0 ? "text-success" : "text-danger")} aria-hidden />
              <div className="min-w-0 text-sm">
                <p>
                  Margem bruta <span className={cn("tabular font-semibold", profit > 0 ? "text-success" : "text-danger")}>{margin.toLocaleString("pt-BR")}%</span>
                </p>
                <p className="tabular text-[13px] text-muted-foreground">
                  {profit >= 0 ? "Lucro" : "Prejuízo"} de {formatBRL(Math.abs(profit))} por unidade, antes de taxas e imposto
                </p>
              </div>
            </div>
          )}
          {discount != null && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 px-4 py-3">
              <BadgePercent className="size-5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 text-sm">
                <p>
                  Desconto exibido <span className="tabular font-semibold text-primary">{discount}%</span>
                </p>
                <p className="tabular text-[13px] text-muted-foreground">
                  de {formatBRL(v.compareAtCents ?? 0)} por {formatBRL(price)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField name="sku" label="SKU (código interno)" htmlFor="p-sku" error={e.sku} hint="Único por produto. Aparece no pedido para facilitar a separação.">
          <Input
            id="p-sku"
            value={v.sku}
            maxLength={64}
            autoCapitalize="characters"
            spellCheck={false}
            className="font-mono"
            placeholder="ex.: HS-RGB-71-PT"
            aria-invalid={!!e.sku}
            onChange={(ev) => set("sku", ev.target.value)}
          />
        </FormField>
        <FormField
          name="ean"
          label="EAN (código de barras)"
          htmlFor="p-ean"
          error={e.ean}
          hint={
            existing ? (
              <span className="text-warning">
                Já cadastrado:{" "}
                <a href={`/admin/produtos/${existing.id}`} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4">
                  {existing.name}
                </a>
                . Confira antes de salvar para não ficar repetido.
              </span>
            ) : (
              "Digite (ou bipe) e clique em Buscar: nome, marca, foto e medidas vêm sozinhos."
            )
          }
        >
          <div className="flex gap-2">
            <Input
              id="p-ean"
              value={v.ean}
              inputMode="numeric"
              maxLength={14}
              className="tabular min-w-0 flex-1 font-mono"
              placeholder="7891234567890"
              aria-invalid={!!e.ean}
              onChange={(ev) => {
                set("ean", onlyDigits(ev.target.value).slice(0, 14));
                setExisting(null);
              }}
            />
            <BarcodeTools form={form} productId={productId} onBrandFound={onBrandFound} onExisting={setExisting} />
          </div>
        </FormField>
      </div>

      <div className="rounded-xl border border-border">
        <Switch
          className="p-4"
          checked={v.trackStock}
          onChange={(on) => set("trackStock", on)}
          label="Controlar estoque"
          description="O estoque baixa a cada pedido e volta se o pedido for cancelado."
        />
        {v.trackStock && (
          <div className="space-y-5 border-t border-border p-4">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                name="stock"
                label="Estoque"
                htmlFor="p-stock"
                error={e.stock}
                hint={hasVariants ? `Vem das variações: ${pluralize(variantStock, "unidade", "unidades")} no total.` : "Quantidade disponível para venda."}
              >
                {hasVariants ? (
                  <Input id="p-stock" disabled readOnly value={variantStock.toLocaleString("pt-BR")} className="tabular" trailing={<span className="pr-1.5 text-sm text-subtle">un.</span>} />
                ) : (
                  <NumberInput
                    id="p-stock"
                    integer
                    min={0}
                    max={1_000_000}
                    suffix="un."
                    value={v.stock}
                    onChange={(n) => set("stock", Math.max(0, n ?? 0))}
                    aria-invalid={!!e.stock}
                  />
                )}
              </FormField>
              <FormField name="lowStockAlert" label="Alerta de estoque baixo" htmlFor="p-low" error={e.lowStockAlert} hint="Avisamos no painel quando chegar nessa quantidade.">
                <NumberInput id="p-low" integer min={0} max={10_000} suffix="un." value={v.lowStockAlert} onChange={(n) => set("lowStockAlert", Math.max(0, n ?? 0))} aria-invalid={!!e.lowStockAlert} />
              </FormField>
            </div>
            <Switch
              checked={v.allowBackorder}
              onChange={(on) => set("allowBackorder", on)}
              label="Permitir vender sem estoque"
              description="O cliente consegue comprar mesmo com o estoque zerado; você combina o prazo pelo WhatsApp."
            />
          </div>
        )}
      </div>
    </FormSection>
  );
}
