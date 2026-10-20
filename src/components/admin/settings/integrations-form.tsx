"use client";

import { useState, useTransition } from "react";
import { BarChart3, CheckCircle2, CreditCard, ExternalLink, FolderInput, Map as MapIcon, PlugZap, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatKm } from "@/lib/format";
import {
  saveIntegrationsSettings,
  testMapsAction,
  testStripeAction,
  type IntegrationsInput,
  type MapsTestResult,
  type SecretPreviews,
} from "@/app/admin/(panel)/configuracoes/actions";
import { CopyButton } from "@/components/admin/orders/copy-button";
import { Callout, Eyebrow, SaveBar, Section, SettingsField, useSettingsForm } from "./form-kit";
import { SecretInput } from "./secret-input";

export type IntegrationsFormValues = IntegrationsInput;

const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded",
];

const PROVIDERS = [
  {
    value: "osm",
    name: "OpenStreetMap",
    tag: "Gratuito, sem chave",
    text: "Usa os servidores públicos do OpenStreetMap (Nominatim) e do OSRM. Bom para começar; pode ficar lento em horários de pico.",
    link: null,
  },
  {
    value: "google",
    name: "Google Maps",
    tag: "Geocoding API + Routes API",
    text: "O mais preciso para endereços brasileiros. Crie um projeto no Google Cloud, ative as APIs Geocoding e Routes e gere uma chave. Tem cota gratuita mensal; depois é cobrado.",
    link: { href: "https://console.cloud.google.com/google/maps-apis/credentials", label: "Criar chave no Google Cloud" },
  },
  {
    value: "openrouteservice",
    name: "OpenRouteService",
    tag: "Gratuito com chave · 2.000 cálculos/dia",
    text: "Baseado no OpenStreetMap, com limite diário maior e mais estável que o servidor público. Basta criar uma conta e copiar a chave.",
    link: { href: "https://openrouteservice.org/dev/#/signup", label: "Criar conta no OpenRouteService" },
  },
  {
    value: "mapbox",
    name: "Mapbox",
    tag: "Cota gratuita mensal",
    text: "Boa precisão e cota gratuita generosa. Crie uma conta e use o token de acesso público (começa com pk.).",
    link: { href: "https://account.mapbox.com/access-tokens/", label: "Criar token no Mapbox" },
  },
] as const;

function modeOf(key: string): "test" | "live" | null {
  if (/^(pk|sk|rk)_live_/.test(key)) return "live";
  if (/^(pk|sk|rk)_test_/.test(key)) return "test";
  return null;
}

function TestResult({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div role="status" className={cn("flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm", ok ? "border-success/30 bg-success-soft" : "border-danger/30 bg-danger-soft")}>
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />}
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

export function IntegrationsForm({ initial, previews: initialPreviews, webhookUrl }: { initial: IntegrationsFormValues; previews: SecretPreviews; webhookUrl: string }) {
  const [previews, setPreviews] = useState(initialPreviews);
  const f = useSettingsForm(initial, saveIntegrationsSettings, {
    onSaved: (data, values) => {
      if (data) setPreviews(data.previews);
      return {
        ...values,
        stripePublishableKey: data?.publishableKey ?? values.stripePublishableKey,
        stripeSecretKey: "",
        clearStripeSecretKey: false,
        stripeWebhookSecret: "",
        clearStripeWebhookSecret: false,
        mapsApiKey: "",
        clearMapsApiKey: false,
        googleDriveApiKey: "",
        clearGoogleDriveApiKey: false,
        anthropicApiKey: "",
        clearAnthropicApiKey: false,
        googleAnalyticsId: values.googleAnalyticsId.toUpperCase(),
      };
    },
  });
  const { values: v, set, errors: e } = f;

  const [stripeTest, setStripeTest] = useState<{ ok: boolean; text: string } | null>(null);
  const [mapsTest, setMapsTest] = useState<{ ok: boolean; data?: MapsTestResult; text: string } | null>(null);
  const [testingStripe, startStripe] = useTransition();
  const [testingMaps, startMaps] = useTransition();

  const pkMode = modeOf(v.stripePublishableKey);
  const skMode = modeOf(v.clearStripeSecretKey ? "" : v.stripeSecretKey || previews.stripeSecretKey);
  const mismatch = !!pkMode && !!skMode && pkMode !== skMode;
  const provider = PROVIDERS.find((p) => p.value === v.mapsProvider) ?? PROVIDERS[0];
  const needsKey = v.mapsProvider !== "osm";

  return (
    <form onSubmit={f.submit} noValidate className="space-y-5">
      <Section
        title={
          <span className="inline-flex items-center gap-2">
            <CreditCard className="size-4 text-subtle" aria-hidden /> Stripe
          </span>
        }
        description="Pagamento online com cartão, Pix e boleto. Os pedidos são confirmados automaticamente."
        action={pkMode ? <Badge tone={pkMode === "live" ? "success" : "info"}>{pkMode === "live" ? "Modo produção" : "Modo teste"}</Badge> : undefined}
      >
        <Callout title="Onde encontrar as chaves">
          No painel da Stripe, abra{" "}
          <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline-offset-4 hover:underline">
            Desenvolvedores → Chaves de API
          </a>
          . Use as chaves de teste para experimentar e as de produção para vender de verdade.
        </Callout>

        <SettingsField name="stripePublishableKey" label="Chave publicável" htmlFor="in-pk" error={e.stripePublishableKey} hint="Começa com pk_live_ ou pk_test_.">
          <Input
            id="in-pk"
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-sm"
            placeholder="pk_live_…"
            value={v.stripePublishableKey}
            onChange={(x) => set("stripePublishableKey", x.target.value.trim())}
            aria-invalid={!!e.stripePublishableKey}
          />
        </SettingsField>
        <SettingsField name="stripeSecretKey" label="Chave secreta" htmlFor="in-sk" error={e.stripeSecretKey} hint={!previews.stripeSecretKey ? "Começa com sk_live_ ou sk_test_ (ou rk_ para chave restrita)." : undefined}>
          <SecretInput
            id="in-sk"
            value={v.stripeSecretKey}
            onChange={(x) => set("stripeSecretKey", x)}
            preview={previews.stripeSecretKey}
            cleared={v.clearStripeSecretKey}
            onClearChange={(c) => f.patch({ clearStripeSecretKey: c, stripeSecretKey: "" })}
            placeholder="sk_live_…"
            invalid={!!e.stripeSecretKey}
          />
        </SettingsField>
        {mismatch && (
          <Callout tone="warning" title="As chaves são de modos diferentes">
            Use as duas de teste (pk_test_ + sk_test_) ou as duas de produção (pk_live_ + sk_live_).
          </Callout>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            loading={testingStripe}
            disabled={(!v.stripeSecretKey && !previews.stripeSecretKey) || v.clearStripeSecretKey}
            onClick={() =>
              startStripe(async () => {
                let r: Awaited<ReturnType<typeof testStripeAction>>;
                try {
                  r = await testStripeAction(v.stripeSecretKey || undefined);
                } catch {
                  setStripeTest({ ok: false, text: "Falha de conexão. Tente de novo." });
                  return;
                }
                setStripeTest(
                  r.ok && r.data
                    ? { ok: true, text: `Conectado (modo ${r.data.mode === "live" ? "produção" : "teste"})${r.data.account ? ` · ${r.data.account}` : ""}` }
                    : { ok: false, text: r.ok ? "Resposta inesperada da Stripe." : r.error },
                );
              })
            }
          >
            <PlugZap aria-hidden /> Testar conexão
          </Button>
          {v.stripeSecretKey && <span className="text-[13px] text-subtle">Testa a chave digitada (ainda não salva).</span>}
        </div>
        {stripeTest && <TestResult ok={stripeTest.ok}>{stripeTest.text}</TestResult>}

        <div className="space-y-4 rounded-xl border border-border p-4">
          <div>
            <Eyebrow>Webhook · avisos de pagamento</Eyebrow>
            <p className="mt-2 text-sm text-muted-foreground">
              Na Stripe, abra{" "}
              <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline-offset-4 hover:underline">
                Desenvolvedores → Webhooks
              </a>
              , clique em adicionar destino, cole o endereço abaixo e selecione os eventos listados.
            </p>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Endereço do webhook</p>
            <div className="flex gap-2">
              <code className="flex min-h-11 min-w-0 flex-1 items-center break-all rounded-xl border border-border bg-elevated/50 px-3.5 py-2 font-mono text-[13px]">{webhookUrl}</code>
              <CopyButton text={webhookUrl} iconOnly label="Copiar endereço do webhook" toastMessage="Endereço copiado." className="size-11" />
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Eventos</p>
              <CopyButton text={WEBHOOK_EVENTS.join("\n")} label="Copiar lista" variant="ghost" toastMessage="Eventos copiados." />
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {WEBHOOK_EVENTS.map((ev) => (
                <li key={ev} className="rounded-lg border border-border bg-elevated/50 px-2 py-1 font-mono text-xs">
                  {ev}
                </li>
              ))}
            </ul>
          </div>
          <SettingsField name="stripeWebhookSecret" label="Segredo do webhook" htmlFor="in-wh" error={e.stripeWebhookSecret} hint={!previews.stripeWebhookSecret ? "Aparece na página do webhook, em “Segredo de assinatura”. Começa com whsec_." : undefined}>
            <SecretInput
              id="in-wh"
              value={v.stripeWebhookSecret}
              onChange={(x) => set("stripeWebhookSecret", x)}
              preview={previews.stripeWebhookSecret}
              cleared={v.clearStripeWebhookSecret}
              onClearChange={(c) => f.patch({ clearStripeWebhookSecret: c, stripeWebhookSecret: "" })}
              placeholder="whsec_…"
              invalid={!!e.stripeWebhookSecret}
            />
          </SettingsField>
        </div>
      </Section>

      <Section
        title={
          <span className="inline-flex items-center gap-2">
            <MapIcon className="size-4 text-subtle" aria-hidden /> Mapas e cálculo de frete
          </span>
        }
        description="Encontra as coordenadas dos endereços e a distância de carro para o frete por km."
      >
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Provedor</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {PROVIDERS.map((p) => {
              const active = v.mapsProvider === p.value;
              return (
                <label
                  key={p.value}
                  className={cn(
                    "relative flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors",
                    active ? "border-primary bg-primary-soft" : "border-border hover:border-border-strong",
                  )}
                >
                  <input
                    type="radio"
                    name="mapsProvider"
                    value={p.value}
                    checked={active}
                    onChange={() => {
                      set("mapsProvider", p.value);
                      setMapsTest(null);
                    }}
                    className="mt-1 size-4 shrink-0 accent-[var(--primary)]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{p.name}</span>
                    <span className="mt-0.5 block text-[13px] text-subtle">{p.tag}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="rounded-xl border border-border bg-elevated/40 px-4 py-3 text-[13px] text-muted-foreground">
          <p>{provider.text}</p>
          {provider.link && (
            <a href={provider.link.href} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 font-medium text-foreground hover:text-primary">
              {provider.link.label} <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
        {needsKey && (
          <SettingsField name="mapsApiKey" label={`Chave de API · ${provider.name}`} htmlFor="in-maps" error={e.mapsApiKey}>
            <SecretInput
              id="in-maps"
              value={v.mapsApiKey}
              onChange={(x) => set("mapsApiKey", x)}
              preview={previews.mapsApiKey}
              cleared={v.clearMapsApiKey}
              onClearChange={(c) => f.patch({ clearMapsApiKey: c, mapsApiKey: "" })}
              invalid={!!e.mapsApiKey}
            />
          </SettingsField>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            loading={testingMaps}
            onClick={() =>
              startMaps(async () => {
                let r: Awaited<ReturnType<typeof testMapsAction>>;
                try {
                  r = await testMapsAction({ provider: v.mapsProvider, apiKey: v.mapsApiKey || undefined });
                } catch {
                  setMapsTest({ ok: false, text: "Falha de conexão. Tente de novo." });
                  return;
                }
                setMapsTest(r.ok ? { ok: true, data: r.data, text: r.message ?? "Funcionando." } : { ok: false, text: r.error });
                if (!r.ok) toast.error("O teste do mapa falhou.");
              })
            }
          >
            <PlugZap aria-hidden /> Testar
          </Button>
          <span className="text-[13px] text-subtle">Localiza o endereço da loja e calcula uma rota até o Centro de Curitiba.</span>
        </div>
        {mapsTest && (
          <TestResult ok={mapsTest.ok}>
            <p className="font-medium">{mapsTest.text}</p>
            {mapsTest.data && (
              <p className="tabular mt-1 text-[13px] text-muted-foreground">
                {mapsTest.data.addressLabel}: <span className="font-mono">{mapsTest.data.lat.toFixed(5)}, {mapsTest.data.lng.toFixed(5)}</span>
                <br />
                Até {mapsTest.data.sample}: {mapsTest.data.routeKm != null ? `${formatKm(mapsTest.data.routeKm)} de carro` : "rota indisponível"} · {formatKm(mapsTest.data.straightKm)} em linha reta
              </p>
            )}
          </TestResult>
        )}
      </Section>

      <Section
        title={
          <span className="inline-flex items-center gap-2">
            <FolderInput className="size-4 text-subtle" aria-hidden /> Importador de produtos
          </span>
        }
        description="Chaves usadas em Produtos → Importar. As duas são opcionais."
      >
        <SettingsField
          name="googleDriveApiKey"
          label="Chave do Google Drive"
          htmlFor="in-drive"
          error={e.googleDriveApiKey}
          hint={!previews.googleDriveApiKey ? "Para ler pastas do Drive compartilhadas como “Qualquer pessoa com o link”." : undefined}
        >
          <SecretInput
            id="in-drive"
            value={v.googleDriveApiKey}
            onChange={(x) => set("googleDriveApiKey", x)}
            preview={previews.googleDriveApiKey}
            cleared={v.clearGoogleDriveApiKey}
            onClearChange={(c) => f.patch({ clearGoogleDriveApiKey: c, googleDriveApiKey: "" })}
            placeholder="AIza…"
            invalid={!!e.googleDriveApiKey}
          />
        </SettingsField>
        <div className="rounded-xl border border-border bg-elevated/40 px-4 py-3 text-[13px] text-muted-foreground">
          <p>
            No Google Cloud, crie um projeto, ative a <strong className="font-medium text-foreground">Google Drive API</strong> e gere uma chave de API. Em
            “Restrições”, limite a chave só à Drive API (sem restrição de site ou IP). É gratuito.
          </p>
          <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 font-medium text-foreground hover:text-primary">
            Ativar a Drive API <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
        <SettingsField
          name="anthropicApiKey"
          label="Chave da Anthropic (Claude)"
          htmlFor="in-anthropic"
          error={e.anthropicApiKey}
          hint={!previews.anthropicApiKey ? "Liga o preenchimento com IA: lê as fotos da caixa e do manual e escreve ficha técnica, descrição e SEO." : undefined}
        >
          <SecretInput
            id="in-anthropic"
            value={v.anthropicApiKey}
            onChange={(x) => set("anthropicApiKey", x)}
            preview={previews.anthropicApiKey}
            cleared={v.clearAnthropicApiKey}
            onClearChange={(c) => f.patch({ clearAnthropicApiKey: c, anthropicApiKey: "" })}
            placeholder="sk-ant-…"
            invalid={!!e.anthropicApiKey}
          />
        </SettingsField>
        <div className="rounded-xl border border-border bg-elevated/40 px-4 py-3 text-[13px] text-muted-foreground">
          <p>Crie a chave no Console da Anthropic e coloque créditos. O uso é cobrado por produto lido, direto pela Anthropic.</p>
          <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 font-medium text-foreground hover:text-primary">
            Criar chave da Anthropic <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
      </Section>

      <Section
        title={
          <span className="inline-flex items-center gap-2">
            <BarChart3 className="size-4 text-subtle" aria-hidden /> Análise de visitas
          </span>
        }
        description="Os códigos só são carregados depois que o visitante aceita os cookies."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsField name="googleAnalyticsId" label="Google Analytics 4" htmlFor="in-ga" error={e.googleAnalyticsId} hint="ID da métrica, ex.: G-ABC123XYZ.">
            <Input id="in-ga" className="font-mono text-sm" placeholder="G-XXXXXXXXXX" value={v.googleAnalyticsId} onChange={(x) => set("googleAnalyticsId", x.target.value.trim())} aria-invalid={!!e.googleAnalyticsId} />
          </SettingsField>
          <SettingsField name="metaPixelId" label="Meta Pixel (Facebook/Instagram)" htmlFor="in-pixel" error={e.metaPixelId} hint="Só os números do ID do Pixel.">
            <Input id="in-pixel" inputMode="numeric" className="font-mono text-sm" placeholder="123456789012345" value={v.metaPixelId} onChange={(x) => set("metaPixelId", x.target.value.replace(/\D/g, ""))} aria-invalid={!!e.metaPixelId} />
          </SettingsField>
        </div>
      </Section>

      <SaveBar dirty={f.dirty} pending={f.pending} onReset={f.reset} />
    </form>
  );
}
