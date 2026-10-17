"use client";

import { ExternalLink, MessageCircle } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveStoreSettings } from "@/app/admin/(panel)/configuracoes/actions";
import { Callout, SaveBar, Section, SettingsField, maskCnpj, maskPhone, useSettingsForm } from "./form-kit";

export type StoreFormValues = {
  name: string;
  tagline: string;
  description: string;
  whatsapp: string;
  phone: string;
  email: string;
  legalName: string;
  cnpj: string;
  businessHours: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  youtube: string;
  announcementEnabled: boolean;
  announcementText: string;
  announcementHref: string;
};

export function StoreForm({ initial }: { initial: StoreFormValues }) {
  const f = useSettingsForm({ ...initial, whatsapp: maskPhone(initial.whatsapp), phone: initial.phone ? maskPhone(initial.phone) : "" }, saveStoreSettings, {
    onSaved: (data, values) => (data ? { ...values, ...data, whatsapp: maskPhone(data.whatsapp), phone: data.phone ? maskPhone(data.phone) : "" } : values),
  });
  const { values: v, set, errors: e } = f;
  const waDigits = v.whatsapp.replace(/\D/g, "");
  const waValid = waDigits.length === 10 || waDigits.length === 11;

  return (
    <form onSubmit={f.submit} noValidate className="space-y-5">
      <Section title="Identidade" description="Como a loja aparece no site, no app e nas mensagens.">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsField name="name" label="Nome da loja" htmlFor="st-name" required error={e.name}>
            <Input id="st-name" value={v.name} maxLength={60} onChange={(x) => set("name", x.target.value)} aria-invalid={!!e.name} />
          </SettingsField>
          <SettingsField name="tagline" label="Frase da marca" htmlFor="st-tagline" error={e.tagline}>
            <Input id="st-tagline" value={v.tagline} maxLength={140} onChange={(x) => set("tagline", x.target.value)} aria-invalid={!!e.tagline} />
          </SettingsField>
        </div>
        <SettingsField name="description" label="Descrição curta" htmlFor="st-desc" hint="Aparece no rodapé e em alguns textos do site." error={e.description}>
          <Textarea id="st-desc" rows={3} value={v.description} maxLength={300} onChange={(x) => set("description", x.target.value)} aria-invalid={!!e.description} />
        </SettingsField>
      </Section>

      <Section title="WhatsApp e contato" description="Os pedidos do site chegam organizados no WhatsApp abaixo.">
        {!waValid && (
          <Callout tone="warning" title="Cadastre o WhatsApp que recebe os pedidos">
            Sem esse número, o cliente não consegue enviar o pedido no final da compra.
          </Callout>
        )}
        <SettingsField
          name="whatsapp"
          label="WhatsApp que recebe os pedidos"
          htmlFor="st-wa"
          required
          error={e.whatsapp}
          hint="Use o número com DDD. Ele também aparece no botão de WhatsApp do site."
        >
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Input
                id="st-wa"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(41) 99999-8888"
                value={v.whatsapp}
                onChange={(x) => set("whatsapp", maskPhone(x.target.value))}
                aria-invalid={!!e.whatsapp}
                leading={<MessageCircle />}
              />
            </div>
            <a
              href={waValid ? `https://wa.me/55${waDigits}?text=${encodeURIComponent("Teste do WhatsApp de pedidos da loja.")}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!waValid}
              className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border px-3.5 text-sm font-medium transition-colors ${waValid ? "hover:border-border-strong hover:bg-elevated" : "pointer-events-none opacity-50"}`}
            >
              Testar <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
        </SettingsField>
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsField name="phone" label="Telefone fixo" htmlFor="st-phone" error={e.phone}>
            <Input id="st-phone" inputMode="tel" placeholder="(41) 3333-4444" value={v.phone} onChange={(x) => set("phone", maskPhone(x.target.value))} aria-invalid={!!e.phone} />
          </SettingsField>
          <SettingsField name="email" label="E-mail de atendimento" htmlFor="st-email" error={e.email}>
            <Input id="st-email" type="email" autoComplete="email" placeholder="contato@sualoja.com.br" value={v.email} onChange={(x) => set("email", x.target.value)} aria-invalid={!!e.email} />
          </SettingsField>
        </div>
        <SettingsField name="businessHours" label="Horário de atendimento" htmlFor="st-hours" error={e.businessHours}>
          <Input id="st-hours" value={v.businessHours} maxLength={120} placeholder="Seg a sex, 9h às 18h · Sáb, 9h às 13h" onChange={(x) => set("businessHours", x.target.value)} aria-invalid={!!e.businessHours} />
        </SettingsField>
      </Section>

      <Section title="Dados da empresa" description="Mostrados no rodapé e no comprovante de entrega.">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsField name="legalName" label="Razão social" htmlFor="st-legal" error={e.legalName}>
            <Input id="st-legal" value={v.legalName} maxLength={120} onChange={(x) => set("legalName", x.target.value)} aria-invalid={!!e.legalName} />
          </SettingsField>
          <SettingsField name="cnpj" label="CNPJ" htmlFor="st-cnpj" error={e.cnpj}>
            <Input id="st-cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" value={v.cnpj} onChange={(x) => set("cnpj", maskCnpj(x.target.value))} aria-invalid={!!e.cnpj} />
          </SettingsField>
        </div>
      </Section>

      <Section title="Redes sociais" description="Cole o link completo do perfil. Deixe em branco para não mostrar.">
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["instagram", "Instagram", "https://instagram.com/sualoja"],
              ["facebook", "Facebook", "https://facebook.com/sualoja"],
              ["tiktok", "TikTok", "https://tiktok.com/@sualoja"],
              ["youtube", "YouTube", "https://youtube.com/@sualoja"],
            ] as const
          ).map(([key, label, ph]) => (
            <SettingsField key={key} name={key} label={label} htmlFor={`st-${key}`} error={e[key]}>
              <Input id={`st-${key}`} type="url" inputMode="url" placeholder={ph} value={v[key]} onChange={(x) => set(key, x.target.value)} aria-invalid={!!e[key]} />
            </SettingsField>
          ))}
        </div>
      </Section>

      <Section title="Barra de aviso" description="Faixa fina no topo do site, para avisos e promoções.">
        <Switch checked={v.announcementEnabled} onChange={(c) => set("announcementEnabled", c)} label="Mostrar barra de aviso" description="Aparece em todas as páginas da loja." />
        {v.announcementEnabled && (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <SettingsField name="announcementText" label="Texto" htmlFor="st-ann" required error={e.announcementText}>
              <Input id="st-ann" value={v.announcementText} maxLength={160} onChange={(x) => set("announcementText", x.target.value)} aria-invalid={!!e.announcementText} />
            </SettingsField>
            <SettingsField name="announcementHref" label="Link (opcional)" htmlFor="st-ann-href" error={e.announcementHref} hint="Ex.: /ofertas">
              <Input id="st-ann-href" value={v.announcementHref} placeholder="/ofertas" onChange={(x) => set("announcementHref", x.target.value)} aria-invalid={!!e.announcementHref} />
            </SettingsField>
          </div>
        )}
      </Section>

      <SaveBar dirty={f.dirty} pending={f.pending} onReset={f.reset} />
    </form>
  );
}
