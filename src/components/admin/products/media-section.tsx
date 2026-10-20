"use client";

import { useTransition } from "react";
import { Lightbulb, Undo2, Video, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pluralize } from "@/lib/format";
import { standardizeImagesAction } from "@/app/admin/(panel)/produtos/tools-actions";
import { ImageGallery } from "@/components/admin/image-uploader";
import { MAX_PRODUCT_IMAGES } from "@/lib/admin/product-schema";
import { FormField, FormSection, type FormApi } from "./form-kit";

const TIPS = [
  "Fundo branco ou bem claro, com o produto inteiro e centralizado.",
  "Fotos grandes: 1600 px ou mais no lado maior (JPG, PNG ou WebP até 8 MB).",
  `Até ${MAX_PRODUCT_IMAGES} fotos. A primeira é a capa; arraste para mudar a ordem.`,
  "Mostre detalhes: painel, prateleiras, gavetas, etiqueta de energia.",
];

/** Padroniza as fotos do formulário pelo padrão das Configurações (ou volta às originais). */
function StandardizeBar({ form, enabled }: { form: FormApi; enabled: boolean }) {
  const [pending, start] = useTransition();
  const v = form.values;
  const standardized = v.images.filter((im) => im.sourceUrl).length;
  if (!v.images.length) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-4 py-3">
      <p className="min-w-0 text-[13px] text-muted-foreground">
        {standardized
          ? `${pluralize(standardized, "foto padronizada", "fotos padronizadas")} (a original fica guardada).`
          : enabled
            ? "Deixe todas iguais: fundo, formato quadrado e marca d'água das Configurações."
            : "Ligue o padrão das fotos em Configurações → Ferramentas do catálogo."}
      </p>
      <div className="flex gap-2">
        {standardized > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => form.set("images", v.images.map((im) => (im.sourceUrl ? { ...im, url: im.sourceUrl, sourceUrl: null, width: null, height: null } : im)))}
          >
            <Undo2 aria-hidden /> Voltar às originais
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          loading={pending}
          disabled={!enabled}
          onClick={() =>
            start(async () => {
              try {
                const r = await standardizeImagesAction(v.images.map((im) => ({ url: im.url, sourceUrl: im.sourceUrl ?? null })));
                if (!r.ok || !r.data) {
                  toast.error(r.ok ? "Não foi possível padronizar." : r.error);
                  return;
                }
                const next = r.data.images;
                form.set("images", form.values.images.map((im, i) => (next[i] ? { ...im, ...next[i] } : im)));
                toast.success(`${pluralize(r.data.changed, "foto padronizada", "fotos padronizadas")}. Salve o produto para gravar.`);
              } catch {
                toast.error("Falha de conexão. Tente de novo.");
              }
            })
          }
        >
          <Wand2 aria-hidden /> {standardized ? "Padronizar de novo" : "Padronizar fotos"}
        </Button>
      </div>
    </div>
  );
}

export function MediaSection({ form, active, photoStandard }: { form: FormApi; active: boolean; photoStandard: boolean }) {
  const { values: v, set, errors: e } = form;
  const imageError = e.images ?? Object.entries(e).find(([k]) => k.startsWith("images."))?.[1];
  return (
    <FormSection
      id="fotos"
      title="Fotos"
      description="Envie várias de uma vez: clique em adicionar ou arraste os arquivos para o quadro."
      active={active}
      action={
        <span className="tabular rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
          {v.images.length}/{MAX_PRODUCT_IMAGES}
        </span>
      }
    >
      <FormField name="images" error={imageError}>
        <ImageGallery
          value={v.images}
          folder="products"
          max={MAX_PRODUCT_IMAGES}
          onChange={(images) => {
            set("images", images);
            form.clearErrors("images");
          }}
        />
      </FormField>

      <StandardizeBar form={form} enabled={photoStandard} />

      <div className="rounded-xl border border-border bg-background/40 p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Lightbulb className="size-4 text-primary" aria-hidden /> Dicas para fotos que vendem
        </p>
        <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
          {TIPS.map((t) => (
            <li key={t} className="flex gap-2">
              <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-subtle" />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[13px] text-subtle">Escreva uma descrição em cada foto (ex.: “Headset de lado, mostrando o microfone”): ajuda no Google e na acessibilidade.</p>
      </div>

      <FormField name="videoUrl" label="Vídeo do produto" htmlFor="p-video" error={e.videoUrl} hint="Opcional. Cole o link do YouTube ou do fabricante.">
        <Input
          id="p-video"
          type="url"
          inputMode="url"
          value={v.videoUrl}
          maxLength={300}
          placeholder="https://www.youtube.com/watch?v=…"
          leading={<Video />}
          aria-invalid={!!e.videoUrl}
          onChange={(ev) => set("videoUrl", ev.target.value)}
        />
      </FormField>
    </FormSection>
  );
}
