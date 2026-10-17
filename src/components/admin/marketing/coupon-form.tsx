"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Percent, Truck, Wallet, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Switch } from "@/components/ui/switch";
import { Callout, NumberInput, Section, SettingsField } from "@/components/admin/settings/form-kit";
import { saveCouponAction, type CouponInput } from "@/app/admin/(panel)/cupons/actions";
import { formatBRL, formatDateTime, pluralize } from "@/lib/format";
import { randomCode } from "@/lib/utils";
import type { BrandOption, CategoryOption } from "./data";
import { DateTimeField } from "./datetime-field";
import { ChoiceCards, LabelWithCount } from "./form-bits";
import { FormFooter } from "./form-footer";
import { couponValueText, scopeSummary } from "./labels";
import { ScopeFields, type ScopeValue } from "./scope-fields";
import { useEntityForm } from "./use-entity-form";
import type { ScopeKey } from "./rules";

export type CouponFormValues = {
  code: string;
  description: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING";
  percent: number | null;
  fixedCents: number | null;
  minSubtotalCents: number | null;
  maxDiscountCents: number | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  firstOrderOnly: boolean;
  stackWithPromotions: boolean;
  scope: ScopeKey;
  categoryIds: string[];
  brandIds: string[];
  productIds: string[];
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
};

function toInput(v: CouponFormValues): CouponInput {
  return {
    code: v.code,
    description: v.description,
    type: v.type,
    value: v.type === "PERCENT" ? (v.percent ?? 0) : v.type === "FIXED" ? (v.fixedCents ?? 0) : 0,
    minSubtotalCents: v.minSubtotalCents,
    maxDiscountCents: v.type === "PERCENT" ? v.maxDiscountCents : null,
    usageLimit: v.usageLimit,
    perCustomerLimit: v.perCustomerLimit,
    firstOrderOnly: v.firstOrderOnly,
    stackWithPromotions: v.stackWithPromotions,
    scope: v.scope,
    categoryIds: v.categoryIds,
    brandIds: v.brandIds,
    productIds: v.productIds,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    active: v.active,
  };
}

/** Só letras sem acento, números, - e _ (em maiúsculas). */
function cleanCode(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 30);
}

export function CouponForm({
  id,
  initial,
  categories,
  brands,
  usedCount = 0,
}: {
  id: string | null;
  initial: CouponFormValues;
  categories: CategoryOption[];
  brands: BrandOption[];
  usedCount?: number;
}) {
  const router = useRouter();
  const f = useEntityForm(initial, (v) => saveCouponAction(id, toInput(v)), {
    onSaved: (_data, _values, message) => {
      toast.success(message ?? "Cupom salvo.");
      if (!id) router.push("/admin/cupons");
      else router.refresh();
    },
  });
  const { values: v, set, errors: e } = f;
  const scope: ScopeValue = { scope: v.scope, categoryIds: v.categoryIds, brandIds: v.brandIds, productIds: v.productIds };

  return (
    <form onSubmit={f.submit} noValidate>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="min-w-0 space-y-5">
          <Section title="Cupom">
            <SettingsField name="code" htmlFor="c-code" label="Código" required error={e.code} hint="O cliente digita no carrinho. Maiúsculas e minúsculas tanto faz.">
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    id="c-code"
                    value={v.code}
                    onChange={(x) => set("code", cleanCode(x.target.value))}
                    placeholder="Ex.: BEMVINDO10"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={30}
                    aria-invalid={!!e.code}
                    className="font-mono uppercase tracking-wider"
                  />
                </div>
                <Button type="button" variant="secondary" onClick={() => set("code", randomCode(8))}>
                  <Wand2 aria-hidden /> <span className="hidden sm:inline">Gerar código</span>
                  <span className="sr-only sm:hidden">Gerar código</span>
                </Button>
              </div>
            </SettingsField>
            <SettingsField name="description" htmlFor="c-desc" label={<LabelWithCount value={v.description} max={300}>Descrição</LabelWithCount>} error={e.description} hint="Uso interno, para lembrar do que se trata (ex.: campanha do Instagram).">
              <Textarea id="c-desc" rows={2} value={v.description} maxLength={300} onChange={(x) => set("description", x.target.value)} />
            </SettingsField>
          </Section>

          <Section title="Desconto">
            <ChoiceCards
              name="type"
              value={v.type}
              onChange={(t) => set("type", t)}
              columns={3}
              options={[
                { value: "PERCENT", label: "Porcentagem", hint: "Ex.: 10% nos produtos.", icon: <Percent aria-hidden /> },
                { value: "FIXED", label: "Valor fixo", hint: "Ex.: R$ 30,00 no pedido.", icon: <Wallet aria-hidden /> },
                { value: "FREE_SHIPPING", label: "Frete grátis", hint: "Zera a entrega por motoboy.", icon: <Truck aria-hidden /> },
              ]}
            />
            {v.type !== "FREE_SHIPPING" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <SettingsField name="value" htmlFor="c-value" label={v.type === "PERCENT" ? "Desconto (%)" : "Desconto (R$)"} required error={e.value} hint={v.type === "PERCENT" ? "De 1% a 100%." : "Limitado ao valor dos produtos."}>
                  {v.type === "PERCENT" ? (
                    <NumberInput id="c-value" value={v.percent} onChange={(n) => set("percent", n)} integer allowEmpty min={1} max={100} suffix="%" placeholder="10" aria-invalid={!!e.value} />
                  ) : (
                    <MoneyInput id="c-value" value={v.fixedCents} onChange={(c) => set("fixedCents", c)} allowEmpty aria-invalid={!!e.value} />
                  )}
                </SettingsField>
                {v.type === "PERCENT" && (
                  <SettingsField name="maxDiscountCents" htmlFor="c-max" label="Desconto máximo" error={e.maxDiscountCents} hint="Opcional. Ex.: 10% limitado a R$ 100,00.">
                    <MoneyInput id="c-max" value={v.maxDiscountCents} onChange={(c) => set("maxDiscountCents", c)} allowEmpty placeholder="Sem limite" aria-invalid={!!e.maxDiscountCents} />
                  </SettingsField>
                )}
              </div>
            )}
          </Section>

          <Section title="Regras de uso">
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField name="minSubtotalCents" htmlFor="c-min" label="Pedido mínimo" error={e.minSubtotalCents} hint="Soma dos produtos, sem o frete.">
                <MoneyInput id="c-min" value={v.minSubtotalCents} onChange={(c) => set("minSubtotalCents", c)} allowEmpty placeholder="Sem mínimo" aria-invalid={!!e.minSubtotalCents} />
              </SettingsField>
              <SettingsField name="usageLimit" htmlFor="c-limit" label="Limite total de usos" error={e.usageLimit} hint={usedCount > 0 ? `Já usado ${pluralize(usedCount, "vez", "vezes")}. Vazio = sem limite.` : "Vazio = sem limite."}>
                <NumberInput id="c-limit" value={v.usageLimit} onChange={(n) => set("usageLimit", n)} integer allowEmpty min={1} placeholder="Sem limite" aria-invalid={!!e.usageLimit} />
              </SettingsField>
              <SettingsField name="perCustomerLimit" htmlFor="c-per" label="Limite por cliente" error={e.perCustomerLimit} hint="Contado pelo WhatsApp do pedido. Vazio = sem limite.">
                <NumberInput id="c-per" value={v.perCustomerLimit} onChange={(n) => set("perCustomerLimit", n)} integer allowEmpty min={1} placeholder="Sem limite" aria-invalid={!!e.perCustomerLimit} />
              </SettingsField>
            </div>
            <Switch checked={v.firstOrderOnly} onChange={(c) => set("firstOrderOnly", c)} label="Só na primeira compra" description="Vale apenas para WhatsApp que nunca fez pedido na loja." />
            {v.type !== "FREE_SHIPPING" && (
              <Switch
                checked={v.stackWithPromotions}
                onChange={(c) => set("stackWithPromotions", c)}
                label="Vale para itens já em promoção"
                description="Desligado, o desconto do cupom ignora produtos que já estão com preço promocional."
              />
            )}
          </Section>

          <Section title="Vale para">
            {v.type === "FREE_SHIPPING" ? (
              <Callout>O frete grátis vale para o pedido inteiro. Para retirada na loja o frete já é zero.</Callout>
            ) : (
              <ScopeFields
                value={scope}
                categories={categories}
                brands={brands}
                errors={e}
                onChange={(p) => {
                  for (const [k, val] of Object.entries(p)) set(k as keyof ScopeValue, val as never);
                }}
              />
            )}
          </Section>

          <Section title="Validade" description="Horário de Brasília. Sem datas, vale até você desativar.">
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField name="startsAt" htmlFor="c-start" label="Início" error={e.startsAt}>
                <DateTimeField id="c-start" value={v.startsAt} onChange={(d) => set("startsAt", d)} quick="start" invalid={!!e.startsAt} />
              </SettingsField>
              <SettingsField name="endsAt" htmlFor="c-end" label="Fim" error={e.endsAt}>
                <DateTimeField id="c-end" value={v.endsAt} onChange={(d) => set("endsAt", d)} quick="end" invalid={!!e.endsAt} />
              </SettingsField>
            </div>
            <Switch checked={v.active} onChange={(c) => set("active", c)} label="Cupom ativo" description="Desligado, o cliente vê “Este cupom não está ativo”." />
          </Section>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-20" aria-label="Resumo do cupom">
          <CouponTicket v={v} usedCount={usedCount} />
        </aside>
      </div>

      <FormFooter
        dirty={f.dirty}
        pending={f.pending}
        onReset={f.reset}
        isNew={!id}
        submitLabel={id ? "Salvar cupom" : "Criar cupom"}
        cancel={
          <Link href="/admin/cupons" className={buttonVariants({ variant: "ghost" })}>
            Voltar
          </Link>
        }
      />
    </form>
  );
}

/** Resumo em forma de “tíquete”, atualizado enquanto edita. */
function CouponTicket({ v, usedCount }: { v: CouponFormValues; usedCount: number }) {
  const value = v.type === "PERCENT" ? (v.percent ?? 0) : v.type === "FIXED" ? (v.fixedCents ?? 0) : 0;
  const rules: string[] = [];
  if (v.minSubtotalCents) rules.push(`Pedidos a partir de ${formatBRL(v.minSubtotalCents)}`);
  if (v.type !== "FREE_SHIPPING" && v.scope !== "ALL") rules.push(`Só em ${scopeSummary(v.scope, v)}`);
  if (v.type !== "FREE_SHIPPING" && !v.stackWithPromotions) rules.push("Não vale para itens em promoção");
  if (v.firstOrderOnly) rules.push("Só na primeira compra");
  if (v.perCustomerLimit) rules.push(`${pluralize(v.perCustomerLimit, "uso", "usos")} por cliente`);
  if (v.usageLimit) rules.push(`${pluralize(v.usageLimit, "uso", "usos")} no total`);
  if (v.startsAt) rules.push(`A partir de ${formatDateTime(v.startsAt)}`);
  if (v.endsAt) rules.push(`Até ${formatDateTime(v.endsAt)}`);
  const pct = v.usageLimit ? Math.min(100, Math.round((usedCount / v.usageLimit) * 100)) : 0;

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
        <span aria-hidden className="size-1.5 rounded-full bg-primary" />
        Resumo
      </p>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
        <div className="bg-grid relative px-5 pb-5 pt-6">
          <div aria-hidden className="glow-orange pointer-events-none absolute -right-10 -top-10 size-40 opacity-60" />
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">Cupom</p>
          <p className="mt-1 break-all font-mono text-2xl font-semibold tracking-wider">{v.code || "CÓDIGO"}</p>
          <p className="mt-2 text-lg font-semibold text-primary">{couponValueText({ type: v.type, value, maxDiscountCents: v.type === "PERCENT" ? v.maxDiscountCents : null })}</p>
        </div>
        {/* picote do tíquete */}
        <div aria-hidden className="relative h-0 border-t border-dashed border-border-strong">
          <span className="absolute -left-2.5 -top-2.5 size-5 rounded-full border border-border bg-background" />
          <span className="absolute -right-2.5 -top-2.5 size-5 rounded-full border border-border bg-background" />
        </div>
        <ul className="space-y-2 px-5 py-4 text-sm">
          {rules.length ? (
            rules.map((r) => (
              <li key={r} className="flex gap-2 text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> {r}
              </li>
            ))
          ) : (
            <li className="text-muted-foreground">Sem restrições: vale em qualquer pedido.</li>
          )}
        </ul>
        {usedCount > 0 && (
          <div className="border-t border-border px-5 py-4">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Usos</span>
              <span className="tabular font-medium">
                {usedCount.toLocaleString("pt-BR")}
                {v.usageLimit ? ` / ${v.usageLimit.toLocaleString("pt-BR")}` : ""}
              </span>
            </div>
            {v.usageLimit ? (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Usos do limite">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            ) : null}
          </div>
        )}
      </div>
      {!v.active && <p className="text-[13px] text-warning">Desativado: ninguém consegue usar agora.</p>}
    </div>
  );
}
