"use client";

import { BadgePercent, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Switch } from "@/components/ui/switch";
import { NumberInput } from "@/components/admin/settings/form-kit";
import { formatBRL, pluralize } from "@/lib/format";
import { cn, onlyDigits } from "@/lib/utils";
import { FormField, FormSection, type FormApi } from "./form-kit";

export function PricingSection({ form, active }: { form: FormApi; active: boolean }) {
  const { values: v, set, errors: e } = form;
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

      {(profit != null || discount != null) && (
        <div className="grid gap-3 sm:grid-cols-2" aria-live="polite">
          {profit != null && margin != null && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/40 px-4 py-3">
              <TrendingUp className={cn("size-5 shrink-0", profit > 0 ? "text-success" : "text-danger")} aria-hidden />
              <div className="min-w-0 text-sm">
                <p>
                  Margem <span className={cn("tabular font-semibold", profit > 0 ? "text-success" : "text-danger")}>{margin.toLocaleString("pt-BR")}%</span>
                </p>
                <p className="tabular text-[13px] text-muted-foreground">
                  {profit >= 0 ? "Lucro" : "Prejuízo"} de {formatBRL(Math.abs(profit))} por unidade
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
            placeholder="ex.: GEL-375-INOX"
            aria-invalid={!!e.sku}
            onChange={(ev) => set("sku", ev.target.value)}
          />
        </FormField>
        <FormField name="ean" label="EAN (código de barras)" htmlFor="p-ean" error={e.ean} hint="8 a 14 números, como na caixa do produto.">
          <Input
            id="p-ean"
            value={v.ean}
            inputMode="numeric"
            maxLength={14}
            className="tabular font-mono"
            placeholder="7891234567890"
            aria-invalid={!!e.ean}
            onChange={(ev) => set("ean", onlyDigits(ev.target.value).slice(0, 14))}
          />
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
