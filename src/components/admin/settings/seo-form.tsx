"use client";

import { Moon, Sun } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/ui/tabs";
import { ImageUpload } from "@/components/admin/image-uploader";
import { imageUrl, isUploadKey } from "@/lib/images";
import { saveSeoSettings, type SeoInput } from "@/app/admin/(panel)/configuracoes/actions";
import { NumberInput, SaveBar, Section, SettingsField, useSettingsForm } from "./form-kit";

export type SeoFormValues = SeoInput;

function Counter({ value, ideal }: { value: string; ideal: number }) {
  const n = value.length;
  return (
    <span className={n > ideal ? "text-warning" : "text-subtle"}>
      {n}/{ideal}
    </span>
  );
}

export function SeoForm({ initial, siteUrl }: { initial: SeoFormValues; siteUrl: string }) {
  // A imagem enviada é guardada como URL do tamanho grande (1600 px).
  const f = useSettingsForm(initial, (vals: SeoFormValues) => saveSeoSettings({ ...vals, ogImage: vals.ogImage && isUploadKey(vals.ogImage) ? imageUrl(vals.ogImage, "lg") : vals.ogImage }), {
    onSaved: (_d, vals) => ({ ...vals, ogImage: vals.ogImage && isUploadKey(vals.ogImage) ? imageUrl(vals.ogImage, "lg") : vals.ogImage }),
  });
  const { values: v, set, errors: e } = f;
  const host = siteUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");

  return (
    <form onSubmit={f.submit} noValidate className="space-y-5">
      <Section title="Google e redes sociais" description="Como a loja aparece nas buscas e quando alguém compartilha o link.">
        <SettingsField
          name="title"
          label={
            <span className="flex w-full items-center justify-between gap-2">
              Título do site <Counter value={v.title} ideal={60} />
            </span>
          }
          htmlFor="seo-title"
          required
          error={e.title}
        >
          <Input id="seo-title" value={v.title} maxLength={90} onChange={(x) => set("title", x.target.value)} aria-invalid={!!e.title} />
        </SettingsField>
        <SettingsField
          name="description"
          label={
            <span className="flex w-full items-center justify-between gap-2">
              Descrição <Counter value={v.description} ideal={160} />
            </span>
          }
          htmlFor="seo-desc"
          required
          error={e.description}
          hint="O Google mostra cerca de 160 caracteres."
        >
          <Textarea id="seo-desc" rows={3} maxLength={320} value={v.description} onChange={(x) => set("description", x.target.value)} aria-invalid={!!e.description} />
        </SettingsField>
        <SettingsField name="keywords" label="Palavras-chave" htmlFor="seo-kw" error={e.keywords} hint="Separadas por vírgula.">
          <Input id="seo-kw" value={v.keywords} maxLength={500} onChange={(x) => set("keywords", x.target.value)} aria-invalid={!!e.keywords} />
        </SettingsField>

        <div className="rounded-xl border border-border bg-elevated/40 p-4" aria-label="Prévia no Google">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">Prévia na busca</p>
          <p className="mt-2 truncate text-[13px] text-muted-foreground">{host}</p>
          <p className="mt-0.5 line-clamp-1 text-lg text-info">{v.title || "Título do site"}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{v.description || "Descrição da loja."}</p>
        </div>

        <SettingsField name="ogImage" label="Imagem de compartilhamento" error={e.ogImage} hint="1200 × 630 px. Aparece no WhatsApp, Facebook e outras redes.">
          <ImageUpload value={v.ogImage || null} onChange={(url) => set("ogImage", url ?? "")} folder="misc" aspect="aspect-[1200/630]" className="max-w-md" />
        </SettingsField>
      </Section>

      <Section title="Aparência da loja">
        <div>
          <p className="mb-1.5 text-sm font-medium">Tema padrão</p>
          <Segmented
            value={v.defaultTheme}
            onChange={(t) => set("defaultTheme", t)}
            options={[
              {
                value: "dark",
                label: (
                  <>
                    <Moon className="size-4" aria-hidden /> Escuro
                  </>
                ),
              },
              {
                value: "light",
                label: (
                  <>
                    <Sun className="size-4" aria-hidden /> Claro
                  </>
                ),
              },
            ]}
          />
          <p className="mt-1.5 text-[13px] text-subtle">O visitante ainda pode trocar pelo botão no topo do site.</p>
        </div>
        <SettingsField name="heroAutoplayMs" label="Tempo de cada banner do carrossel" htmlFor="seo-hero" error={e.heroAutoplayMs} hint="Use 0 para o carrossel não passar sozinho." className="sm:max-w-xs">
          <NumberInput
            id="seo-hero"
            value={v.heroAutoplayMs / 1000}
            min={0}
            max={30}
            step={0.5}
            suffix="seg"
            onChange={(n) => set("heroAutoplayMs", Math.round((n ?? 0) * 1000))}
            aria-invalid={!!e.heroAutoplayMs}
          />
        </SettingsField>
        <Switch checked={v.showBrands} onChange={(c) => set("showBrands", c)} label="Mostrar faixa de marcas" description="Logos das marcas na página inicial." />
        <Switch checked={v.showNewsletter} onChange={(c) => set("showNewsletter", c)} label="Mostrar cadastro da newsletter" description="Caixa para o visitante deixar o e-mail." />
        <Switch checked={v.showAppSection} onChange={(c) => set("showAppSection", c)} label="Mostrar seção do app" description="Convida a instalar o app e ativar as notificações." />
      </Section>

      <SaveBar dirty={f.dirty} pending={f.pending} onReset={f.reset} />
    </form>
  );
}
