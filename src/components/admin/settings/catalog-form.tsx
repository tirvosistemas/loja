"use client";

import { useState, useTransition } from "react";
import { Calculator, CheckCircle2, ExternalLink, FolderInput, ImageIcon, PlugZap, Rss, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/ui/tabs";
import { ImageUpload } from "@/components/admin/image-uploader";
import { CopyButton } from "@/components/admin/orders/copy-button";
import { formatBRL } from "@/lib/format";
import { isUploadKey } from "@/lib/images";
import { priceBreakdown, suggestPrice } from "@/lib/price-calc";
import { cn } from "@/lib/utils";
import {
  previewPhotoStandard,
  saveCatalogSettings,
  testCosmosAction,
  type CatalogPreviews,
  type CatalogSettingsInput,
} from "@/app/admin/(panel)/configuracoes/tools-actions";
import { Callout, Eyebrow, NumberInput, SaveBar, Section, SettingsField, useSettingsForm } from "./form-kit";
import { SecretInput } from "./secret-input";

export type CatalogFormValues = Required<CatalogSettingsInput>;

const POSITIONS = [
  { value: "bottom-right", label: "Canto inferior direito" },
  { value: "bottom-left", label: "Canto inferior esquerdo" },
  { value: "top-right", label: "Canto superior direito" },
  { value: "top-left", label: "Canto superior esquerdo" },
  { value: "center", label: "Centro" },
] as const;

const BACKGROUNDS = [
  { value: "#ffffff", label: "Branco" },
  { value: "#f4f4f5", label: "Cinza claro" },
  { value: "#111111", label: "Preto" },
];

function Result({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div role="status" className={cn("flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm", ok ? "border-success/30 bg-success-soft" : "border-danger/30 bg-danger-soft")}>
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />}
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

export function CatalogForm({
  initial,
  previews: initialPreviews,
  brandLogos,
  feedUrls,
}: {
  initial: CatalogFormValues;
  previews: CatalogPreviews;
  brandLogos: readonly { value: string; label: string }[];
  feedUrls: { google: string; meta: string; csv: string };
}) {
  const [previews, setPreviews] = useState(initialPreviews);
  const f = useSettingsForm(initial, saveCatalogSettings, {
    onSaved: (data, values) => {
      if (data) setPreviews(data.previews);
      return { ...values, googleDriveApiKey: "", clearGoogleDriveApiKey: false, cosmosToken: "", clearCosmosToken: false };
    },
  });
  const { values: v, set, errors: e } = f;
  const [cosmos, setCosmos] = useState<{ ok: boolean; text: string } | null>(null);
  const [testingCosmos, startCosmos] = useTransition();
  const [preview, setPreview] = useState<{ before: string; after: string } | null>(null);
  const [previewing, startPreview] = useTransition();
  const [sampleCost, setSampleCost] = useState<number | null>(5000);

  const cfg = v;
  const suggested = sampleCost ? suggestPrice(sampleCost, cfg) : null;
  const card = suggested && sampleCost ? priceBreakdown(suggested, sampleCost, cfg, "card") : null;
  const pix = suggested && sampleCost ? priceBreakdown(suggested, sampleCost, cfg, "pix") : null;
  const customLogo = isUploadKey(v.watermarkImage);

  const runPreview = () =>
    startPreview(async () => {
      try {
        const r = await previewPhotoStandard({
          photoSquare: v.photoSquare,
          photoBackground: v.photoBackground,
          photoPaddingPercent: v.photoPaddingPercent,
          watermarkEnabled: v.watermarkEnabled,
          watermarkImage: v.watermarkImage,
          watermarkPosition: v.watermarkPosition,
          watermarkOpacity: v.watermarkOpacity,
          watermarkSizePercent: v.watermarkSizePercent,
        });
        if (r.ok && r.data) setPreview(r.data);
      } catch {
        setPreview(null);
      }
    });

  return (
    <form onSubmit={f.submit} noValidate className="space-y-5">
      <Section
        title={
          <span className="inline-flex items-center gap-2">
            <Calculator className="size-4 text-subtle" aria-hidden /> Calculadora de preço
          </span>
        }
        description="Taxas e custos usados para sugerir o preço de venda no cadastro e na edição em massa."
      >
        <div className="grid gap-5 sm:grid-cols-3">
          <SettingsField name="feeCardPercent" label="Taxa do cartão" htmlFor="c-card" error={e.feeCardPercent} hint="Maquininha ou pagamento online.">
            <NumberInput id="c-card" value={v.feeCardPercent} onChange={(n) => set("feeCardPercent", n ?? 0)} min={0} max={30} step={0.01} suffix="%" />
          </SettingsField>
          <SettingsField name="feePixPercent" label="Taxa do Pix" htmlFor="c-pix" error={e.feePixPercent} hint="0 se o Pix cai direto na conta.">
            <NumberInput id="c-pix" value={v.feePixPercent} onChange={(n) => set("feePixPercent", n ?? 0)} min={0} max={30} step={0.01} suffix="%" />
          </SettingsField>
          <SettingsField name="taxPercent" label="Imposto sobre a venda" htmlFor="c-tax" error={e.taxPercent} hint="Simples Nacional: confira com o contador.">
            <NumberInput id="c-tax" value={v.taxPercent} onChange={(n) => set("taxPercent", n ?? 0)} min={0} max={40} step={0.01} suffix="%" />
          </SettingsField>
          <SettingsField name="packagingCents" label="Embalagem por unidade" htmlFor="c-pack" error={e.packagingCents}>
            <MoneyInput id="c-pack" value={v.packagingCents} onChange={(c) => set("packagingCents", c ?? 0)} />
          </SettingsField>
          <SettingsField name="otherCostCents" label="Outros custos por unidade" htmlFor="c-other" error={e.otherCostCents} hint="Etiqueta, brinde, nota…">
            <MoneyInput id="c-other" value={v.otherCostCents} onChange={(c) => set("otherCostCents", c ?? 0)} />
          </SettingsField>
          <SettingsField name="targetMarginPercent" label="Margem de lucro desejada" htmlFor="c-margin" error={e.targetMarginPercent} hint="Lucro limpo sobre o preço de venda.">
            <NumberInput id="c-margin" value={v.targetMarginPercent} onChange={(n) => set("targetMarginPercent", n ?? 0)} min={0} max={80} step={0.5} suffix="%" />
          </SettingsField>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Final do preço</p>
          <Segmented
            value={v.priceEnding}
            onChange={(x) => set("priceEnding", x)}
            options={[
              { value: "90", label: ",90" },
              { value: "99", label: ",99" },
              { value: "00", label: ",00" },
              { value: "none", label: "Exato" },
            ]}
          />
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-4">
          <Eyebrow>Exemplo</Eyebrow>
          <div className="mt-3 flex flex-wrap items-end gap-4">
            <label className="w-40 text-sm">
              <span className="mb-1.5 block font-medium">Custo do produto</span>
              <MoneyInput value={sampleCost} onChange={setSampleCost} allowEmpty />
            </label>
            {suggested && card && pix ? (
              <div className="min-w-0 text-sm">
                <p>
                  Preço sugerido <span className="tabular text-lg font-semibold text-primary">{formatBRL(suggested)}</span>
                </p>
                <p className="tabular text-[13px] text-muted-foreground">
                  Lucro no cartão {formatBRL(card.profitCents)} ({card.marginPercent.toLocaleString("pt-BR")}%) · no Pix {formatBRL(pix.profitCents)} ({pix.marginPercent.toLocaleString("pt-BR")}%)
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{sampleCost ? "Taxas e margem somam demais: não há preço possível." : "Informe um custo."}</p>
            )}
          </div>
        </div>
      </Section>

      <Section
        title={
          <span className="inline-flex items-center gap-2">
            <ImageIcon className="size-4 text-subtle" aria-hidden /> Padrão das fotos
          </span>
        }
        description="Aplicado quando você manda padronizar (lista de produtos, cadastro ou importador). A foto original fica guardada: dá para refazer com outro padrão ou desfazer."
      >
        <Switch checked={v.photoSquare} onChange={(on) => set("photoSquare", on)} label="Deixar quadradas, com respiro em volta" description="Todas no mesmo formato na vitrine, sem cortar o produto." />
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium">Cor de fundo</p>
            <div className="flex flex-wrap items-center gap-2">
              {BACKGROUNDS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  aria-pressed={v.photoBackground === b.value}
                  onClick={() => set("photoBackground", b.value)}
                  className={cn("inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm", v.photoBackground === b.value ? "border-primary bg-primary-soft" : "border-border hover:border-border-strong")}
                >
                  <span className="size-4 rounded-full border border-border" style={{ background: b.value }} aria-hidden />
                  {b.label}
                </button>
              ))}
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm hover:border-border-strong">
                <input type="color" value={v.photoBackground} onChange={(x) => set("photoBackground", x.target.value)} className="size-5 cursor-pointer rounded border-0 bg-transparent p-0" />
                Outra
              </label>
            </div>
            <p className="mt-1.5 text-[13px] text-subtle">Também preenche o fundo de fotos com transparência (PNG recortado).</p>
          </div>
          {v.photoSquare && (
            <SettingsField name="photoPaddingPercent" label="Respiro nas bordas" htmlFor="c-pad" error={e.photoPaddingPercent}>
              <NumberInput id="c-pad" value={v.photoPaddingPercent} onChange={(n) => set("photoPaddingPercent", n ?? 0)} min={0} max={30} suffix="%" />
            </SettingsField>
          )}
        </div>

        <div className="rounded-xl border border-border">
          <Switch className="p-4" checked={v.watermarkEnabled} onChange={(on) => set("watermarkEnabled", on)} label="Marca d'água" description="Seu logo discreto em cima das fotos, para dificultar cópia." />
          {v.watermarkEnabled && (
            <div className="space-y-5 border-t border-border p-4" data-field="watermarkImage">
              <div>
                <p className="mb-2 text-sm font-medium">Logo</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {brandLogos.map((l) => (
                    <button
                      key={l.value}
                      type="button"
                      aria-pressed={v.watermarkImage === l.value}
                      onClick={() => set("watermarkImage", l.value)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border p-3 text-center text-xs transition-colors",
                        v.watermarkImage === l.value ? "border-primary bg-primary-soft" : "border-border hover:border-border-strong",
                      )}
                    >
                      <span className={cn("grid h-12 w-full place-items-center rounded-lg", l.value.includes("escuro") ? "bg-neutral-900" : "bg-white")}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={l.value} alt="" className="max-h-9 max-w-[85%] object-contain" />
                      </span>
                      {l.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 max-w-xs">
                  <p className="mb-1.5 text-[13px] text-muted-foreground">Ou envie outra imagem (PNG com fundo transparente fica melhor):</p>
                  <ImageUpload
                    value={customLogo ? v.watermarkImage : null}
                    onChange={(url) => set("watermarkImage", url ?? brandLogos[0].value)}
                    folder="brands"
                    aspect="aspect-[3/1]"
                    label="Enviar logo"
                    hint="PNG ou WebP até 8 MB"
                  />
                </div>
                {e.watermarkImage && <p className="mt-1.5 text-[13px] text-danger">{e.watermarkImage}</p>}
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <SettingsField name="watermarkPosition" label="Posição" htmlFor="c-wpos">
                  <Select id="c-wpos" value={v.watermarkPosition} onChange={(x) => set("watermarkPosition", x.target.value as CatalogFormValues["watermarkPosition"])}>
                    {POSITIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </SettingsField>
                <SettingsField name="watermarkSizePercent" label="Tamanho" htmlFor="c-wsize" hint="Em relação à largura da foto.">
                  <NumberInput id="c-wsize" value={v.watermarkSizePercent} onChange={(n) => set("watermarkSizePercent", n ?? 20)} min={5} max={60} suffix="%" />
                </SettingsField>
                <SettingsField name="watermarkOpacity" label="Opacidade" htmlFor="c-wop" hint="Mais baixo = mais discreto.">
                  <NumberInput id="c-wop" value={v.watermarkOpacity} onChange={(n) => set("watermarkOpacity", n ?? 35)} min={5} max={100} suffix="%" />
                </SettingsField>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Button type="button" variant="secondary" loading={previewing} onClick={runPreview}>
            <ImageIcon aria-hidden /> Ver prévia
          </Button>
          {preview && (
            <div className="grid max-w-xl grid-cols-2 gap-3">
              {[
                { src: preview.before, label: "Antes" },
                { src: preview.after, label: "Depois" },
              ].map((p) => (
                <figure key={p.label} className="space-y-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt={`Foto ${p.label.toLowerCase()} de padronizar`} className="aspect-square w-full rounded-xl border border-border bg-elevated object-contain" />
                  <figcaption className="text-center text-[13px] text-muted-foreground">{p.label}</figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section
        title={
          <span className="inline-flex items-center gap-2">
            <FolderInput className="size-4 text-subtle" aria-hidden /> Importador e código de barras
          </span>
        }
        description="Chaves opcionais usadas em Produtos → Importar e no botão “Buscar” do código de barras."
      >
        <SettingsField
          name="googleDriveApiKey"
          label="Chave do Google Drive"
          htmlFor="c-drive"
          error={e.googleDriveApiKey}
          hint={!previews.googleDriveApiKey ? "Para ler pastas do Drive compartilhadas como “Qualquer pessoa com o link”." : undefined}
        >
          <SecretInput
            id="c-drive"
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
            No Google Cloud, crie um projeto, ative a <strong className="font-medium text-foreground">Google Drive API</strong> e gere uma chave de API. Em “Restrições”, limite a chave só à
            Drive API (sem restrição de site ou IP). É gratuito.
          </p>
          <a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 font-medium text-foreground hover:text-primary">
            Ativar a Drive API <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>

        <SettingsField
          name="cosmosToken"
          label="Token do Cosmos (código de barras)"
          htmlFor="c-cosmos"
          error={e.cosmosToken}
          hint={!previews.cosmosToken ? "Opcional e pago. Sem token, a busca usa bases gratuitas: Open Food Facts (alimentos, bebidas, cosméticos e pet, sem limite) e UPCitemdb (internacional, 100 por dia)." : undefined}
        >
          <SecretInput
            id="c-cosmos"
            value={v.cosmosToken}
            onChange={(x) => set("cosmosToken", x)}
            preview={previews.cosmosToken}
            cleared={v.clearCosmosToken}
            onClearChange={(c) => f.patch({ clearCosmosToken: c, cosmosToken: "" })}
            invalid={!!e.cosmosToken}
          />
        </SettingsField>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            loading={testingCosmos}
            disabled={(!v.cosmosToken && !previews.cosmosToken) || v.clearCosmosToken}
            onClick={() =>
              startCosmos(async () => {
                try {
                  const r = await testCosmosAction(v.cosmosToken || undefined);
                  setCosmos(r.ok ? { ok: true, text: `${r.message} Produto de teste: ${r.data?.name}` } : { ok: false, text: r.error });
                } catch {
                  setCosmos({ ok: false, text: "Falha de conexão. Tente de novo." });
                }
              })
            }
          >
            <PlugZap aria-hidden /> Testar
          </Button>
          <a href="https://cosmos.bluesoft.com.br/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-medium text-foreground hover:text-primary">
            Site do Cosmos (plano pago) <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
        {cosmos && <Result ok={cosmos.ok}>{cosmos.text}</Result>}
      </Section>

      <Section
        title={
          <span className="inline-flex items-center gap-2">
            <Rss className="size-4 text-subtle" aria-hidden /> Catálogo para Google e Instagram
          </span>
        }
        description="Arquivo com seus produtos ativos, atualizado sozinho, para anúncios no Google Shopping e para a loja do Instagram e Facebook."
      >
        <Switch checked={v.feedEnabled} onChange={(on) => set("feedEnabled", on)} label="Publicar o catálogo" description="Desligado, os links abaixo param de funcionar." />
        {v.feedEnabled && (
          <div className="space-y-3">
            {[
              { label: "Google Merchant Center (XML)", url: feedUrls.google },
              { label: "Instagram e Facebook (Meta)", url: feedUrls.meta },
              { label: "Planilha para conferir (CSV)", url: feedUrls.csv },
            ].map((x) => (
              <div key={x.url}>
                <p className="mb-1.5 text-sm font-medium">{x.label}</p>
                <div className="flex gap-2">
                  <code className="flex min-h-11 min-w-0 flex-1 items-center break-all rounded-xl border border-border bg-elevated/50 px-3.5 py-2 font-mono text-[13px]">{x.url}</code>
                  <CopyButton text={x.url} iconOnly label="Copiar link" toastMessage="Link copiado." className="size-11" />
                </div>
              </div>
            ))}
            <Callout title="Como usar">
              <strong className="font-medium text-foreground">Google:</strong> no Merchant Center, Produtos → Fontes de dados → Adicionar → “Arquivo de um URL”, cole o link XML e escolha
              atualização diária. <strong className="font-medium text-foreground">Instagram/Facebook:</strong> no Gerenciador de Comércio, Catálogo → Fontes de dados → Feed de dados → URL, cole
              o link da Meta. Só aparecem produtos ativos, com foto e preço.
            </Callout>
          </div>
        )}
      </Section>

      <SaveBar dirty={f.dirty} pending={f.pending} onReset={f.reset} />
    </form>
  );
}
