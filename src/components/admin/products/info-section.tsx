"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/ui/tabs";
import { CharCount } from "@/components/admin/catalog/fields";
import { MarkdownEditor } from "@/components/admin/catalog/markdown-editor";
import { slugify } from "@/lib/utils";
import type { BrandOption, CategoryOption } from "@/lib/admin/catalog";
import { BrandQuickCreate } from "./brand-quick-create";
import { TagsInput } from "./tags-input";
import { FormField, FormSection, type FormApi } from "./form-kit";
import type { ProductStatusKey } from "./form-values";

const STATUS_HINT: Record<ProductStatusKey, string> = {
  ACTIVE: "Visível na loja e disponível para compra.",
  DRAFT: "Fica salvo no painel, mas não aparece na loja.",
  ARCHIVED: "Fora da loja e escondido da lista principal. Use para itens que saíram de linha.",
};

export function InfoSection({
  form,
  active,
  categories,
  brands,
  onBrandCreated,
  autoFocusName,
}: {
  form: FormApi;
  active: boolean;
  categories: CategoryOption[];
  brands: BrandOption[];
  onBrandCreated: (b: { id: string; name: string }) => void;
  autoFocusName?: boolean;
}) {
  const { values: v, set, patch, errors: e } = form;
  const [brandDialog, setBrandDialog] = useState(false);

  return (
    <FormSection id="informacoes" title="Informações" description="Nome, descrição e onde o produto aparece na loja." active={active}>
      <FormField name="name" label="Nome do produto" htmlFor="p-name" required error={e.name} aside={<CharCount value={v.name} max={160} />}>
        <Input
          id="p-name"
          value={v.name}
          maxLength={160}
          autoFocus={autoFocusName}
          placeholder="ex.: Headset Gamer RGB 7.1 com Microfone"
          aria-invalid={!!e.name}
          onChange={(ev) => {
            const name = ev.target.value;
            patch(v.slugAuto ? { name, slug: slugify(name) } : { name });
            form.clearErrors("name");
          }}
        />
      </FormField>

      <FormField
        name="shortDescription"
        label="Descrição curta"
        htmlFor="p-short"
        error={e.shortDescription}
        hint="Aparece ao lado do preço, na página do produto. Destaque o principal em uma ou duas frases."
        aside={<CharCount value={v.shortDescription} max={500} />}
      >
        <Textarea
          id="p-short"
          rows={3}
          maxLength={500}
          value={v.shortDescription}
          aria-invalid={!!e.shortDescription}
          placeholder="ex.: Som surround 7.1, microfone removível e luzes RGB. Funciona no PC, PS5, Xbox e celular."
          onChange={(ev) => set("shortDescription", ev.target.value)}
        />
      </FormField>

      <FormField name="description" label="Descrição completa" htmlFor="p-description" error={e.description}>
        <MarkdownEditor
          id="p-description"
          value={v.description}
          onChange={(text) => set("description", text)}
          rows={12}
          maxLength={20000}
          invalid={!!e.description}
          placeholder={"## Destaques\n- Som surround 7.1 para ouvir os passos no jogo\n- Almofadas macias para horas de partida\n\nConte para quem é o produto e o que ele resolve."}
          emptyPreview="Escreva a descrição para ver como ela fica na loja."
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField name="categoryId" label="Categoria" htmlFor="p-category" error={e.categoryId} hint={categories.length ? undefined : "Nenhuma categoria cadastrada ainda. Crie em Catálogo › Categorias."}>
          <Select id="p-category" value={v.categoryId} aria-invalid={!!e.categoryId} onChange={(ev) => set("categoryId", ev.target.value)}>
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
                {c.active ? "" : " (oculta)"}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField name="brandId" label="Marca" htmlFor="p-brand" error={e.brandId}>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Select id="p-brand" value={v.brandId} aria-invalid={!!e.brandId} onChange={(ev) => set("brandId", ev.target.value)}>
                <option value="">Sem marca</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.active ? "" : " (oculta)"}
                  </option>
                ))}
              </Select>
            </div>
            <button
              type="button"
              onClick={() => setBrandDialog(true)}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-elevated px-3 text-sm font-medium text-foreground transition-colors hover:border-border-strong hover:bg-muted"
            >
              <Plus className="size-4" aria-hidden /> Nova
              <span className="sr-only"> marca</span>
            </button>
          </div>
        </FormField>
      </div>

      <FormField name="status" label="Status" hint={STATUS_HINT[v.status]} error={e.status}>
        <Segmented<ProductStatusKey>
          value={v.status}
          onChange={(s) => set("status", s)}
          className="flex w-full sm:inline-flex sm:w-auto"
          options={[
            { value: "ACTIVE", label: "Ativo" },
            { value: "DRAFT", label: "Rascunho" },
            { value: "ARCHIVED", label: "Arquivado" },
          ]}
        />
      </FormField>

      <div className="divide-y divide-border rounded-xl border border-border">
        <Switch
          className="p-4"
          checked={v.featured}
          onChange={(on) => set("featured", on)}
          label="Destaque na página inicial"
          description="Entra na vitrine de destaques da home."
        />
        <Switch className="p-4" checked={v.isNew} onChange={(on) => set("isNew", on)} label="Lançamento" description="Ganha o selo “Novo” e aparece em Lançamentos." />
        <Switch
          className="p-4"
          checked={v.freeShipping}
          onChange={(on) => set("freeShipping", on)}
          label="Frete grátis"
          description="A entrega sai grátis quando o carrinho só tem produtos com frete grátis (dentro da área de entrega)."
        />
      </div>

      <FormField name="tags" label="Tags" htmlFor="p-tags" error={e.tags} hint="Palavras que ajudam a busca da loja a encontrar o produto. Separe por vírgula ou Enter.">
        <TagsInput id="p-tags" value={v.tags} onChange={(tags) => set("tags", tags)} invalid={!!e.tags} placeholder="ex.: gamer, rgb, sem fio" />
      </FormField>

      <BrandQuickCreate
        open={brandDialog}
        onClose={() => setBrandDialog(false)}
        onCreated={(b) => {
          onBrandCreated(b);
          set("brandId", b.id);
        }}
      />
    </FormSection>
  );
}
