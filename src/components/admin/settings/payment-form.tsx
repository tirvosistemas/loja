"use client";

import Link from "next/link";
import { ArrowRight, Banknote, CreditCard, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Switch } from "@/components/ui/switch";
import { formatBRL } from "@/lib/format";
import { savePaymentSettings, type PaymentInput } from "@/app/admin/(panel)/configuracoes/actions";
import { Callout, NumberInput, SaveBar, Section, SettingsField, useSettingsForm } from "./form-kit";

export type PaymentFormValues = PaymentInput;

const KEY_TYPES = [
  { value: "cnpj", label: "CNPJ", placeholder: "00.000.000/0000-00" },
  { value: "cpf", label: "CPF", placeholder: "000.000.000-00" },
  { value: "email", label: "E-mail", placeholder: "pix@sualoja.com.br" },
  { value: "phone", label: "Celular", placeholder: "(41) 99999-8888" },
  { value: "random", label: "Chave aleatória", placeholder: "1234abcd-12ab-34cd-56ef-1234567890ab" },
] as const;

export function PaymentForm({ initial, stripeKeysReady }: { initial: PaymentFormValues; stripeKeysReady: boolean }) {
  const f = useSettingsForm(initial, savePaymentSettings, { onSaved: (data, values) => (data ? { ...values, ...data } : values) });
  const { values: v, set, errors: e } = f;

  const anyMethod = (v.stripeEnabled && stripeKeysReady) || (v.pixManualEnabled && !!v.pixKey) || v.onDeliveryCash || v.onDeliveryCard || v.onDeliveryPix;
  const keyType = KEY_TYPES.find((k) => k.value === v.pixKeyType) ?? KEY_TYPES[0];
  const example = 129990;

  return (
    <form onSubmit={f.submit} noValidate className="space-y-5">
      {!anyMethod && (
        <Callout tone="danger" title="Nenhuma forma de pagamento ativa">
          Ative pelo menos uma forma abaixo, senão o cliente não consegue finalizar a compra.
        </Callout>
      )}

      <Section
        title="Pagamento online com Stripe"
        description="Cartão de crédito, Pix e boleto numa página segura da Stripe. O pedido é confirmado sozinho."
        action={stripeKeysReady ? <Badge tone="success">Pronto</Badge> : <Badge tone="warning">Faltam as chaves</Badge>}
      >
        <Switch checked={v.stripeEnabled} onChange={(c) => set("stripeEnabled", c)} label="Aceitar pagamento online" description="Aparece no checkout como “Pagamento online”." />
        {v.stripeEnabled && !stripeKeysReady && (
          <Callout tone="warning" title="Cadastre as chaves da Stripe">
            Enquanto as chaves não forem cadastradas, o pagamento online não aparece no checkout.{" "}
            <Link href="/admin/configuracoes?aba=integracoes" className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline">
              Ir para Integrações <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </Callout>
        )}
      </Section>

      <Section title="Pix para a chave da loja" description="O cliente vê a chave no fim da compra e envia o comprovante pelo WhatsApp.">
        <Switch checked={v.pixManualEnabled} onChange={(c) => set("pixManualEnabled", c)} label="Aceitar Pix na hora da compra" />
        {v.pixManualEnabled && (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
            <SettingsField name="pixKeyType" label="Tipo de chave" htmlFor="pay-keytype" error={e.pixKeyType}>
              <Select id="pay-keytype" value={v.pixKeyType} onChange={(x) => set("pixKeyType", x.target.value as PaymentFormValues["pixKeyType"])}>
                {KEY_TYPES.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </SettingsField>
            <SettingsField name="pixKey" label="Chave Pix" htmlFor="pay-key" required error={e.pixKey}>
              <Input id="pay-key" value={v.pixKey} placeholder={keyType.placeholder} maxLength={140} onChange={(x) => set("pixKey", x.target.value)} aria-invalid={!!e.pixKey} leading={<QrCode />} />
            </SettingsField>
            <SettingsField name="pixHolder" label="Nome do titular" htmlFor="pay-holder" required error={e.pixHolder} hint="Como aparece no app do banco." className="sm:col-span-2">
              <Input id="pay-holder" value={v.pixHolder} maxLength={120} onChange={(x) => set("pixHolder", x.target.value)} aria-invalid={!!e.pixHolder} />
            </SettingsField>
          </div>
        )}
      </Section>

      <Section title="Pagamento na entrega" description="O motoboy recebe na hora da entrega (ou a loja, na retirada).">
        <Switch checked={v.onDeliveryCash} onChange={(c) => set("onDeliveryCash", c)} label={<span className="inline-flex items-center gap-2"><Banknote className="size-4 text-subtle" aria-hidden /> Dinheiro</span>} description="O cliente informa se precisa de troco." />
        <Switch checked={v.onDeliveryCard} onChange={(c) => set("onDeliveryCard", c)} label={<span className="inline-flex items-center gap-2"><CreditCard className="size-4 text-subtle" aria-hidden /> Cartão na maquininha</span>} />
        <Switch checked={v.onDeliveryPix} onChange={(c) => set("onDeliveryPix", c)} label={<span className="inline-flex items-center gap-2"><QrCode className="size-4 text-subtle" aria-hidden /> Pix na entrega</span>} />
      </Section>

      <Section title="Desconto e parcelamento" description="Como os preços aparecem nas páginas de produto.">
        <div className="grid gap-4 sm:grid-cols-3">
          <SettingsField name="pixDiscountPercent" label="Desconto no Pix" htmlFor="pay-pixdisc" error={e.pixDiscountPercent} hint="Vale para Pix na compra e na entrega. 0 = sem desconto.">
            <NumberInput id="pay-pixdisc" value={v.pixDiscountPercent} min={0} max={50} step={0.5} suffix="%" onChange={(n) => set("pixDiscountPercent", n ?? 0)} aria-invalid={!!e.pixDiscountPercent} />
          </SettingsField>
          <SettingsField name="installmentsMax" label="Máximo de parcelas" htmlFor="pay-inst" error={e.installmentsMax} hint="Exibido como “sem juros”.">
            <NumberInput id="pay-inst" value={v.installmentsMax} integer min={1} max={24} suffix="x" onChange={(n) => set("installmentsMax", n ?? 1)} aria-invalid={!!e.installmentsMax} />
          </SettingsField>
          <SettingsField name="installmentsMinCents" label="Parcela mínima" htmlFor="pay-instmin" error={e.installmentsMinCents}>
            <MoneyInput id="pay-instmin" value={v.installmentsMinCents} onChange={(c) => set("installmentsMinCents", c ?? 0)} aria-invalid={!!e.installmentsMinCents} />
          </SettingsField>
        </div>
        <p className="rounded-xl border border-border bg-elevated/40 px-4 py-3 text-[13px] text-muted-foreground">
          Exemplo para um produto de <strong className="text-foreground">{formatBRL(example)}</strong>:{" "}
          {v.pixDiscountPercent > 0 && (
            <>
              {formatBRL(Math.round(example * (1 - v.pixDiscountPercent / 100)))} no Pix ·{" "}
            </>
          )}
          {(() => {
            const n = Math.max(1, Math.min(v.installmentsMax, Math.floor(example / Math.max(1, v.installmentsMinCents))));
            return n > 1 ? `ou ${n}x de ${formatBRL(Math.ceil(example / n))} sem juros` : "sem parcelamento";
          })()}
        </p>
      </Section>

      <SaveBar dirty={f.dirty} pending={f.pending} onReset={f.reset} />
    </form>
  );
}
