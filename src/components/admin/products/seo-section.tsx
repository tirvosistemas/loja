"use client";

import { Input, Textarea } from "@/components/ui/input";
import { LogoMark } from "@/components/brand/logo";
import { CharCount, SlugInput } from "@/components/admin/catalog/fields";
import { slugify } from "@/lib/utils";
import { Eyebrow, FormField, FormSection, type FormApi } from "./form-kit";

/** Texto corrido a partir do Markdown (para a prévia da descrição). */
function plain(md: string) {
  return md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cut(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function SeoSection({ form, active, storeName, siteHost, isNew }: { form: FormApi; active: boolean; storeName: string; siteHost: string; isNew: boolean }) {
  const { values: v, set, patch, errors: e, clearErrors } = form;
  const title = `${v.metaTitle.trim() || v.name.trim() || "Nome do produto"} · ${storeName}`;
  const description =
    v.metaDescription.trim() || v.shortDescription.trim() || plain(v.description) || `${v.name.trim() || "Produto"} com entrega por motoboy em Curitiba e região metropolitana.`;
  const slug = v.slug || slugify(v.name) || "nome-do-produto";

  return (
    <FormSection id="seo" title="SEO" description="Como o produto aparece no Google e quando o link é compartilhado." active={active}>
      <FormField
        name="slug"
        label="URL do produto"
        htmlFor="p-slug"
        error={e.slug}
        hint={v.slugAuto ? "Gerada a partir do nome. Edite se quiser uma URL mais curta." : "Mudar a URL de um produto já divulgado quebra os links antigos."}
      >
        <SlugInput
          id="p-slug"
          prefix="/produto/"
          value={v.slug}
          maxLength={120}
          invalid={!!e.slug}
          placeholder="geladeira-frost-free-375l"
          onChange={(s) => {
            patch({ slug: s, slugAuto: false });
            clearErrors("slug");
          }}
          onGenerate={() => {
            patch({ slug: slugify(v.name), slugAuto: isNew });
            clearErrors("slug");
          }}
        />
      </FormField>

      <FormField
        name="metaTitle"
        label="Título para o Google"
        htmlFor="p-meta-title"
        error={e.metaTitle}
        hint="Se ficar vazio, usamos o nome do produto. Ideal: até 60 caracteres."
        aside={<CharCount value={v.metaTitle} max={60} />}
      >
        <Input id="p-meta-title" value={v.metaTitle} maxLength={120} placeholder={v.name || "Nome do produto"} aria-invalid={!!e.metaTitle} onChange={(ev) => set("metaTitle", ev.target.value)} />
      </FormField>

      <FormField
        name="metaDescription"
        label="Descrição para o Google"
        htmlFor="p-meta-desc"
        error={e.metaDescription}
        hint="Se ficar vazia, usamos a descrição curta. Ideal: até 160 caracteres."
        aside={<CharCount value={v.metaDescription} max={160} />}
      >
        <Textarea
          id="p-meta-desc"
          rows={3}
          value={v.metaDescription}
          maxLength={320}
          placeholder={v.shortDescription || "Resumo do produto em uma ou duas frases."}
          aria-invalid={!!e.metaDescription}
          onChange={(ev) => set("metaDescription", ev.target.value)}
        />
      </FormField>

      <div className="rounded-xl border border-border bg-background/40 p-4">
        <Eyebrow>Prévia no Google</Eyebrow>
        <div className="mt-3 max-w-[600px]" aria-label="Prévia do resultado de busca">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-elevated text-foreground">
              <LogoMark className="size-4" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] text-foreground">{storeName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {siteHost} › produto › {slug}
              </p>
            </div>
          </div>
          <p className="mt-2 line-clamp-1 text-lg leading-snug text-info">{cut(title, 70)}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{cut(description, 165)}</p>
        </div>
      </div>
    </FormSection>
  );
}
