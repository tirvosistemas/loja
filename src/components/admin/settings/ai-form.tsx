"use client";

import { useId, useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, KeyRound, PlugZap, Sparkles, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AI_PROVIDERS, aiProvider } from "@/lib/ai/providers";
import type { AiProviderId } from "@/lib/settings";
import { saveAiSettings, testAiAction, type AiKeyPreviews, type AiTestResult } from "@/app/admin/(panel)/configuracoes/tools-actions";
import { Callout, SaveBar, Section, SettingsField, useSettingsForm } from "./form-kit";
import { SecretInput } from "./secret-input";

export type AiFormValues = {
  provider: AiProviderId;
  keys: Partial<Record<AiProviderId, string>>;
  clear: Partial<Record<AiProviderId, boolean>>;
  models: Partial<Record<AiProviderId, string>>;
  customBaseUrl: string;
};

export function AiForm({ initial, previews: initialPreviews }: { initial: AiFormValues; previews: AiKeyPreviews }) {
  const [previews, setPreviews] = useState(initialPreviews);
  const f = useSettingsForm(initial, saveAiSettings, {
    onSaved: (data, values) => {
      if (data) setPreviews(data.previews);
      return { ...values, keys: {}, clear: {} };
    },
  });
  const { values: v, set, errors: e } = f;
  const p = aiProvider(v.provider);
  const [test, setTest] = useState<{ ok: boolean; text: string; data?: AiTestResult } | null>(null);
  const [testing, startTest] = useTransition();
  const listId = useId();

  const hasKey = (id: AiProviderId) => !v.clear[id] && (!!v.keys[id] || !!previews[id]);
  const setMap = <K extends "keys" | "clear" | "models">(field: K, id: AiProviderId, value: AiFormValues[K][AiProviderId]) => set(field, { ...v[field], [id]: value } as AiFormValues[K]);

  return (
    <form onSubmit={f.submit} noValidate className="space-y-5">
      <Section
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-subtle" aria-hidden /> Provedor de IA
          </span>
        }
        description="Usado no importador e no botão “Preencher com IA” do cadastro. Cada provedor guarda a própria chave: dá para trocar sem perder as outras."
      >
        <fieldset>
          <legend className="sr-only">Provedor</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {AI_PROVIDERS.map((x) => {
              const active = v.provider === x.id;
              return (
                <label
                  key={x.id}
                  className={cn("relative flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors", active ? "border-primary bg-primary-soft" : "border-border hover:border-border-strong")}
                >
                  <input
                    type="radio"
                    name="aiProvider"
                    value={x.id}
                    checked={active}
                    onChange={() => {
                      set("provider", x.id);
                      setTest(null);
                    }}
                    className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium">{x.name}</span>
                      {hasKey(x.id) && (
                        <Badge tone="success" size="sm">
                          <KeyRound className="size-3" aria-hidden /> chave salva
                        </Badge>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-subtle">{x.tag}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="rounded-xl border border-border bg-elevated/40 px-4 py-3 text-[13px] text-muted-foreground">
          <p>{p.text}</p>
          {p.keyUrl && (
            <a href={p.keyUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 font-medium text-foreground hover:text-primary">
              Criar chave do {p.name} <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </div>

        {v.provider === "custom" && (
          <SettingsField name="customBaseUrl" label="Endereço da API" htmlFor="ai-base" error={e.customBaseUrl} hint="O endereço que termina em /v1 (o mesmo que você usaria no SDK da OpenAI).">
            <Input
              id="ai-base"
              value={v.customBaseUrl}
              onChange={(x) => set("customBaseUrl", x.target.value.trim())}
              placeholder="https://api.groq.com/openai/v1"
              className="font-mono text-sm"
              aria-invalid={!!e.customBaseUrl}
            />
          </SettingsField>
        )}

        <SettingsField name={`keys.${v.provider}`} label={`Chave de API · ${p.name}`} htmlFor="ai-key" error={e[`keys.${v.provider}`]} hint={!previews[v.provider] ? p.keyHint : undefined}>
          <SecretInput
            id="ai-key"
            value={v.keys[v.provider] ?? ""}
            onChange={(x) => setMap("keys", v.provider, x)}
            preview={previews[v.provider]}
            cleared={!!v.clear[v.provider]}
            onClearChange={(c) => f.patch({ clear: { ...v.clear, [v.provider]: c }, keys: { ...v.keys, [v.provider]: "" } })}
            invalid={!!e[`keys.${v.provider}`]}
          />
        </SettingsField>

        <SettingsField
          name={`models.${v.provider}`}
          label="Modelo"
          htmlFor="ai-model"
          error={e[`models.${v.provider}`]}
          hint={v.provider === "custom" ? "Obrigatório. Ex.: llama-3.3-70b-versatile." : "Deixe em branco para escolher sozinho o mais novo e barato da sua chave. Teste para ver a lista."}
        >
          <Input
            id="ai-model"
            list={listId}
            value={v.models[v.provider] ?? ""}
            onChange={(x) => setMap("models", v.provider, x.target.value.trim())}
            placeholder={v.provider === "custom" ? "nome-do-modelo" : `Automático${test?.data?.auto ? ` (${test.data.model})` : ""}`}
            className="font-mono text-sm"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={!!e[`models.${v.provider}`]}
          />
          <datalist id={listId}>{test?.data?.models.map((m) => <option key={m} value={m} />)}</datalist>
        </SettingsField>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            loading={testing}
            disabled={!hasKey(v.provider)}
            onClick={() =>
              startTest(async () => {
                let r: Awaited<ReturnType<typeof testAiAction>>;
                try {
                  r = await testAiAction({ provider: v.provider, apiKey: v.keys[v.provider] || undefined, model: v.models[v.provider] || undefined, baseUrl: v.customBaseUrl || undefined });
                } catch {
                  setTest({ ok: false, text: "Falha de conexão. Tente de novo." });
                  return;
                }
                setTest(r.ok ? { ok: true, text: r.message ?? "Funcionando.", data: r.data } : { ok: false, text: r.error });
              })
            }
          >
            <PlugZap aria-hidden /> Testar
          </Button>
          <span className="text-[13px] text-subtle">Faz uma pergunta curtinha à IA (custo praticamente zero).</span>
        </div>
        {test && (
          <div role="status" className={cn("flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm", test.ok ? "border-success/30 bg-success-soft" : "border-danger/30 bg-danger-soft")}>
            {test.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />}
            <div className="min-w-0 break-words">
              <p className="font-medium">{test.text}</p>
              {test.data && (
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  Modelo: <span className="font-mono">{test.data.model}</span>
                  {test.data.auto && " (escolhido automaticamente)"}
                  {test.data.models.length > 0 && ` · ${test.data.models.length} modelos disponíveis na sua chave`}
                </p>
              )}
            </div>
          </div>
        )}

        {!hasKey(v.provider) && (
          <Callout tone="warning" title="Sem chave, a IA fica desligada">
            O importador e o cadastro funcionam normalmente, só sem o preenchimento automático.
          </Callout>
        )}
      </Section>

      <Callout title="O que a IA faz e o que não faz">
        Lê fotos do produto, da caixa e do manual e escreve nome, descrição, ficha técnica, medidas impressas, código de barras, tags e SEO. Nunca mexe em preço nem em estoque, e não
        apaga o que você já escreveu. Revise antes de publicar.
      </Callout>

      <SaveBar dirty={f.dirty} pending={f.pending} onReset={f.reset} />
    </form>
  );
}
