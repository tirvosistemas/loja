"use client";

import Link from "next/link";
import { ArrowRight, BellRing, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { savePushSettings, type PushInput } from "@/app/admin/(panel)/configuracoes/actions";
import { CopyButton } from "@/components/admin/orders/copy-button";
import { Eyebrow, NumberInput, SaveBar, Section, SettingsField, useSettingsForm } from "./form-kit";

export type AppFormValues = PushInput;

export function AppForm({ initial, vapidPublicKey, subscribers }: { initial: AppFormValues; vapidPublicKey: string; subscribers: number }) {
  const f = useSettingsForm({ ...initial, subject: initial.subject.replace(/^mailto:/i, "") }, savePushSettings);
  const { values: v, set, errors: e } = f;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Inscritos nas notificações</span>
            <BellRing className="size-4.5 text-subtle" aria-hidden />
          </div>
          <p className="tabular mt-2 text-2xl font-semibold tracking-tight">{subscribers.toLocaleString("pt-BR")}</p>
          <p className="mt-1 text-xs text-subtle">Aparelhos que aceitaram receber avisos da loja.</p>
        </div>
        <Link
          href="/admin/notificacoes"
          className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:border-border-strong"
        >
          <span className="text-sm text-muted-foreground">Enviar uma promoção agora</span>
          <span className="mt-2 inline-flex items-center gap-2 text-base font-semibold">
            Notificações do app <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
          <span className="mt-1 text-xs text-subtle">Escreva o aviso e mande para todos os inscritos.</span>
        </Link>
      </div>

      <form onSubmit={f.submit} noValidate className="space-y-5">
        <Section title="Notificações push" description="Avisos que chegam no celular e no computador de quem ativou, mesmo com o site fechado.">
          <Switch
            checked={v.promptEnabled}
            onChange={(c) => set("promptEnabled", c)}
            label="Convidar visitantes para ativar notificações"
            description="Mostra um convite discreto depois de alguns segundos navegando."
          />
          {v.promptEnabled && (
            <SettingsField name="promptDelaySeconds" label="Mostrar o convite depois de" htmlFor="app-delay" error={e.promptDelaySeconds} className="sm:max-w-xs">
              <NumberInput id="app-delay" value={v.promptDelaySeconds} integer min={0} max={600} suffix="seg" onChange={(n) => set("promptDelaySeconds", n ?? 0)} aria-invalid={!!e.promptDelaySeconds} />
            </SettingsField>
          )}
          <Switch
            checked={v.autoNotifyPromotions}
            onChange={(c) => set("autoNotifyPromotions", c)}
            label="Avisar clientes automaticamente ao criar promoções"
            description="Quando uma promoção nova é ativada, os inscritos recebem um aviso."
          />
          <SettingsField name="subject" label="E-mail do remetente" htmlFor="app-subject" required error={e.subject} hint="Exigido pelos navegadores para contato técnico. Não aparece para o cliente.">
            <Input id="app-subject" type="email" value={v.subject} placeholder="contato@sualoja.com.br" onChange={(x) => set("subject", x.target.value)} aria-invalid={!!e.subject} />
          </SettingsField>
        </Section>

        <SaveBar dirty={f.dirty} pending={f.pending} onReset={f.reset} />
      </form>

      <Section title="Chave pública VAPID" description="Identifica a loja para os serviços de notificação. É gerada sozinha e não precisa ser alterada.">
        <div className="flex gap-2">
          <code className="flex min-h-11 min-w-0 flex-1 items-center break-all rounded-xl border border-border bg-elevated/50 px-3.5 py-2 font-mono text-xs">{vapidPublicKey}</code>
          <CopyButton text={vapidPublicKey} iconOnly label="Copiar chave pública" toastMessage="Chave copiada." className="size-11" />
        </div>
        <p className="text-[13px] text-subtle">A chave privada fica guardada criptografada. Trocar as chaves desativaria todas as inscrições atuais.</p>
      </Section>

      <Section
        title={
          <span className="inline-flex items-center gap-2">
            <Smartphone className="size-4 text-subtle" aria-hidden /> Como o cliente instala o app
          </span>
        }
        description="A loja funciona como aplicativo (PWA): abre em tela cheia, com ícone na tela inicial."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <Eyebrow>Android</Eyebrow>
            <ol className="mt-2.5 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>Abrir o site no Chrome.</li>
              <li>Tocar em “Instalar app” no site (ou no menu ⋮ → Instalar app).</li>
              <li>Ao ativar as notificações, os avisos chegam como os de qualquer app.</li>
            </ol>
          </div>
          <div className="rounded-xl border border-border p-4">
            <Eyebrow>iPhone</Eyebrow>
            <ol className="mt-2.5 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>Abrir o site no Safari.</li>
              <li>Tocar em Compartilhar → “Adicionar à Tela de Início”.</li>
              <li>Abrir pelo ícone e ativar as notificações (iOS 16.4 ou mais novo).</li>
            </ol>
          </div>
        </div>
        <p className="text-[13px] text-subtle">
          A página <Link href="/app" target="_blank" className="font-medium text-foreground hover:text-primary">/app</Link> da loja explica esse passo a passo para os clientes.
        </p>
      </Section>
    </div>
  );
}
