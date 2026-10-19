"use client";

import { Lightbulb, Video } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ImageGallery } from "@/components/admin/image-uploader";
import { MAX_PRODUCT_IMAGES } from "@/lib/admin/product-schema";
import { FormField, FormSection, type FormApi } from "./form-kit";

const TIPS = [
  "Fundo branco ou bem claro, com o produto inteiro e centralizado.",
  "Fotos grandes: 1600 px ou mais no lado maior (JPG, PNG ou WebP até 8 MB).",
  `Até ${MAX_PRODUCT_IMAGES} fotos. A primeira é a capa; arraste para mudar a ordem.`,
  "Mostre detalhes: painel, prateleiras, gavetas, etiqueta de energia.",
];

export function MediaSection({ form, active }: { form: FormApi; active: boolean }) {
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
