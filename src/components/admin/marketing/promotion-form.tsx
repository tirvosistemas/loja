"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Percent, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import { Input, Textarea } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Switch } from "@/components/ui/switch";
import { buttonVariants } from "@/components/ui/button";
import { Callout, NumberInput, Section, SettingsField } from "@/components/admin/settings/form-kit";
import { savePromotionAction, type PromotionInput } from "@/app/admin/(panel)/promocoes/actions";
import { pluralize } from "@/lib/format";
import type { BrandOption, CategoryOption } from "./data";
import { DateTimeField } from "./datetime-field";
import { ChoiceCards, LabelWithCount } from "./form-bits";
import { FormFooter } from "./form-footer";
import { PUSH_BODY_MAX, PUSH_TITLE_MAX, promoNotifyText } from "./labels";
import { PromotionImpact } from "./promotion-impact";
import { PushPreviewCompact } from "./push-preview";
import { ScopeFields, type ScopeValue } from "./scope-fields";
import { useEntityForm } from "./use-entity-form";
import type { ScopeKey } from "./rules";

export type PromotionFormValues = {
  name: string;
  description: string;
  type: "PERCENT" | "FIXED";
  percent: number | null;
  fixedCents: number | null;
  scope: ScopeKey;
  categoryIds: string[];
  brandIds: string[];
  productIds: string[];
  badge: string;
  flash: boolean;
  priority: number | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
};

export type NotifyState = { enabled: boolean; title: string; body: string };

function toInput(v: PromotionFormValues, n: NotifyState): PromotionInput {
  return {
    name: v.name,
    description: v.description,
    type: v.type,
    value: v.type === "PERCENT" ? (v.percent ?? 0) : (v.fixedCents ?? 0),
    scope: v.scope,
    categoryIds: v.categoryIds,
    brandIds: v.brandIds,
    productIds: v.productIds,
    badge: v.badge,
    flash: v.flash,
    priority: v.priority ?? 0,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    active: v.active,
    notify: n,
  };
}

export function PromotionForm({
  id,
  initial,
  categories,
  brands,
  subscribers,
  autoNotify,
}: {
  id: string | null;
  initial: PromotionFormValues;
  categories: CategoryOption[];
  brands: BrandOption[];
  subscribers: number;
  /** Configurações → App: avisar automaticamente ao criar promoções. */
  autoNotify: boolean;
}) {
  const router = useRouter();
  const initialValue = initial.type === "PERCENT" ? initial.percent : initial.fixedCents;
  const [notify, setNotify] = useState<NotifyState>(() => ({
    enabled: !id && autoNotify && subscribers > 0,
    ...promoNotifyText({ name: initial.name, description: initial.description, type: initial.type, value: initialValue }),
  }));
  // Texto da notificação acompanha nome/desconto até a pessoa editar à mão.
  const touched = useRef({ title: false, body: false });

  const f = useEntityForm(initial, (v) => savePromotionAction(id, toInput(v, notify)), {
    onSaved: (data, _values, message) => {
      const push = data?.push;
      if (push && push.failed > 0)
        toast.warning(message ?? "Promoção salva.", { description: `${push.failed} ${push.failed === 1 ? "envio falhou" : "envios falharam"} (aparelhos que saíram ou bloquearam os avisos).` });
      else toast.success(message ?? "Promoção salva.");
      if (!id) router.push("/admin/promocoes");
      else {
        setNotify((n) => ({ ...n, enabled: false }));
        router.refresh();
      }
    },
  });
  const { values: v, set, errors: e, setErrors } = f;
  const value = v.type === "PERCENT" ? (v.percent ?? 0) : (v.fixedCents ?? 0);

  const suggestion = promoNotifyText({ name: v.name, description: v.description, type: v.type, value });
  useEffect(() => {
    setNotify((n) => {
      const title = touched.current.title ? n.title : suggestion.title;
      const body = touched.current.body ? n.body : suggestion.body;
      return title === n.title && body === n.body ? n : { ...n, title, body };
    });
  }, [suggestion.title, suggestion.body]);

  const editNotify = (key: "title" | "body", text: string) => {
    touched.current[key] = true;
    setNotify((n) => ({ ...n, [key]: text }));
    setErrors((errs) => {
      const { [`notify.${key}`]: _removed, ...rest } = errs;
      return rest;
    });
  };

  const scope: ScopeValue = { scope: v.scope, categoryIds: v.categoryIds, brandIds: v.brandIds, productIds: v.productIds };
  const now = Date.now();
  const startsLater = v.startsAt && new Date(v.startsAt).getTime() > now;

  return (
    <form onSubmit={f.submit} noValidate>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="min-w-0 space-y-5">
          <Section title="Promoção">
            <SettingsField name="name" htmlFor="p-name" label="Nome" required error={e.name} hint="Para você se organizar. Aparece na notificação.">
              <Input id="p-name" value={v.name} maxLength={120} placeholder="Ex.: Semana da Geladeira" onChange={(x) => set("name", x.target.value)} aria-invalid={!!e.name} />
            </SettingsField>
            <SettingsField name="description" htmlFor="p-desc" label={<LabelWithCount value={v.description} max={500}>Descrição</LabelWithCount>} error={e.description} hint="Opcional. Usada como texto da notificação.">
              <Textarea id="p-desc" rows={2} value={v.description} maxLength={500} placeholder="Ex.: Geladeiras e freezers com até 20% OFF e entrega em 24 h." onChange={(x) => set("description", x.target.value)} />
            </SettingsField>
          </Section>

          <Section title="Desconto">
            <ChoiceCards
              name="type"
              value={v.type}
              onChange={(t) => set("type", t)}
              options={[
                { value: "PERCENT", label: "Porcentagem", hint: "Ex.: 15% em cada produto.", icon: <Percent aria-hidden /> },
                { value: "FIXED", label: "Valor fixo em R$", hint: "Ex.: R$ 50,00 a menos em cada produto.", icon: <Wallet aria-hidden /> },
              ]}
            />
            <SettingsField name="value" htmlFor="p-value" label={v.type === "PERCENT" ? "Desconto (%)" : "Desconto (R$)"} required error={e.value} className="sm:max-w-xs" hint={v.type === "PERCENT" ? "De 1% a 90%." : "Descontado do preço de cada unidade."}>
              {v.type === "PERCENT" ? (
                <NumberInput id="p-value" value={v.percent} onChange={(n) => set("percent", n)} integer allowEmpty min={1} max={90} suffix="%" placeholder="15" aria-invalid={!!e.value} />
              ) : (
                <MoneyInput id="p-value" value={v.fixedCents} onChange={(c) => set("fixedCents", c)} allowEmpty aria-invalid={!!e.value} />
              )}
            </SettingsField>
          </Section>

          <Section title="Vale para" description="Produtos rascunho ou arquivados nunca aparecem na loja.">
            <ScopeFields
              value={scope}
              categories={categories}
              brands={brands}
              errors={e}
              onChange={(p) => {
                for (const [k, val] of Object.entries(p)) set(k as keyof ScopeValue, val as never);
              }}
            />
          </Section>

          <Section title="Na vitrine">
            <SettingsField name="badge" htmlFor="p-badge" label={<LabelWithCount value={v.badge} max={24}>Selo no produto</LabelWithCount>} error={e.badge} hint="Aparece sobre a foto, junto do percentual. Ex.: Black Friday, Dia das Mães." className="sm:max-w-sm">
              <Input id="p-badge" value={v.badge} maxLength={30} placeholder="Ex.: Black Friday" onChange={(x) => set("badge", x.target.value)} aria-invalid={!!e.badge} />
            </SettingsField>
            <Switch
              checked={v.flash}
              onChange={(c) => set("flash", c)}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="size-4 text-primary" aria-hidden /> Oferta relâmpago
                </span>
              }
              description="Mostra contagem regressiva na página inicial e nos produtos. Precisa de data de fim."
            />
            <SettingsField name="priority" htmlFor="p-priority" label="Prioridade" error={e.priority} className="sm:max-w-xs" hint="Desempate quando duas promoções dão o mesmo preço: vale a de maior número.">
              <NumberInput id="p-priority" value={v.priority} onChange={(n) => set("priority", n)} integer allowEmpty min={0} max={100} placeholder="0" aria-invalid={!!e.priority} />
            </SettingsField>
          </Section>

          <Section title="Período" description="Horário de Brasília. Sem datas, vale até você desativar.">
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField name="startsAt" htmlFor="p-start" label="Início" error={e.startsAt}>
                <DateTimeField id="p-start" value={v.startsAt} onChange={(d) => set("startsAt", d)} quick="start" invalid={!!e.startsAt} />
              </SettingsField>
              <SettingsField name="endsAt" htmlFor="p-end" label="Fim" required={v.flash} error={e.endsAt}>
                <DateTimeField id="p-end" value={v.endsAt} onChange={(d) => set("endsAt", d)} quick="end" invalid={!!e.endsAt} />
              </SettingsField>
            </div>
            <Switch checked={v.active} onChange={(c) => set("active", c)} label="Promoção ativa" description="Desligue para pausar sem perder a configuração." />
          </Section>

          <Section
            title={
              <span className="inline-flex items-center gap-2">
                <BellRing className="size-4 text-subtle" aria-hidden /> Avisar os clientes do app
              </span>
            }
            description={subscribers > 0 ? `${pluralize(subscribers, "pessoa inscrita", "pessoas inscritas")} nas notificações.` : undefined}
          >
            {subscribers === 0 ? (
              <Callout title="Ninguém inscrito ainda">
                As notificações chegam para quem instala o app ou permite os avisos no site. <Link href="/admin/notificacoes" className="font-medium text-foreground underline-offset-4 hover:underline">Saiba mais</Link>
              </Callout>
            ) : (
              <>
                <Switch
                  checked={notify.enabled}
                  onChange={(c) => setNotify((n) => ({ ...n, enabled: c }))}
                  label="Enviar notificação para os clientes do app ao salvar"
                  description="Ao tocar, o cliente abre a página de ofertas."
                />
                {notify.enabled && (
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
                    <div className="space-y-4">
                      <SettingsField name="notify.title" htmlFor="p-ntitle" label={<LabelWithCount value={notify.title} max={PUSH_TITLE_MAX} required>Título</LabelWithCount>} error={e["notify.title"]}>
                        <Input
                          id="p-ntitle"
                          value={notify.title}
                          onChange={(x) => editNotify("title", x.target.value)}
                          aria-invalid={!!e["notify.title"]}
                        />
                      </SettingsField>
                      <SettingsField name="notify.body" htmlFor="p-nbody" label={<LabelWithCount value={notify.body} max={PUSH_BODY_MAX} required>Mensagem</LabelWithCount>} error={e["notify.body"]}>
                        <Textarea
                          id="p-nbody"
                          rows={3}
                          value={notify.body}
                          onChange={(x) => editNotify("body", x.target.value)}
                          aria-invalid={!!e["notify.body"]}
                        />
                      </SettingsField>
                      {(touched.current.title || touched.current.body) && (
                        <button
                          type="button"
                          className="h-10 text-[13px] font-medium text-primary hover:underline sm:h-auto"
                          onClick={() => {
                            touched.current = { title: false, body: false };
                            setNotify((n) => ({ ...n, title: suggestion.title, body: suggestion.body }));
                          }}
                        >
                          Usar o texto sugerido
                        </button>
                      )}
                      {(!v.active || startsLater) && (
                        <Callout tone="warning">
                          {!v.active ? "A promoção está desativada, mas o aviso sai assim que você salvar." : "A promoção ainda não começou, mas o aviso sai assim que você salvar."}
                        </Callout>
                      )}
                    </div>
                    <PushPreviewCompact title={notify.title} body={notify.body} />
                  </div>
                )}
              </>
            )}
          </Section>
        </div>

        <aside className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5 xl:sticky xl:top-20" aria-label="Impacto da promoção">
          <PromotionImpact type={v.type} value={value} scope={scope} excludeId={id} badge={v.badge} flash={v.flash} endsAt={v.endsAt} />
        </aside>
      </div>

      <FormFooter
        dirty={f.dirty}
        pending={f.pending}
        onReset={f.reset}
        isNew={!id}
        submitLabel={notify.enabled && subscribers > 0 ? (id ? "Salvar e notificar" : "Criar e notificar") : id ? "Salvar promoção" : "Criar promoção"}
        cancel={
          <Link href="/admin/promocoes" className={buttonVariants({ variant: "ghost" })}>
            Voltar
          </Link>
        }
      />
    </form>
  );
}
