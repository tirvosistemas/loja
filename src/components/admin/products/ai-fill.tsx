"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { PenLine, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { pluralize } from "@/lib/format";
import { slugify } from "@/lib/utils";
import type { BrandOption, CategoryOption } from "@/lib/admin/catalog";
import { aiFillAction, type AiFillResult } from "@/app/admin/(panel)/produtos/tools-actions";
import { rowKey, type ProductFormValues } from "./form-values";
import type { FormApi } from "./form-kit";

/** Junta a resposta da IA no formulário. Completar: só campos vazios. Reescrever: também os textos de venda. */
export function mergeAiFill(v: ProductFormValues, r: AiFillResult, rewrite: boolean): { patch: Partial<ProductFormValues>; count: number } {
  const f = r.fill;
  const patch: Partial<ProductFormValues> = {};
  const text = (key: "name" | "shortDescription" | "description" | "metaTitle" | "metaDescription" | "model" | "color", value: string | null, max: number, canRewrite: boolean) => {
    const val = value?.trim().slice(0, max);
    if (!val) return;
    if ((rewrite && canRewrite) || !v[key].trim()) if (val !== v[key]) patch[key] = val;
  };
  text("name", f.name, 160, true);
  text("shortDescription", f.shortDescription, 500, true);
  text("description", f.description, 20000, true);
  text("metaTitle", f.metaTitle, 120, true);
  text("metaDescription", f.metaDescription, 320, true);
  text("model", f.model, 80, false);
  text("color", f.color, 60, false);
  if (!v.brandId && r.brand?.id) patch.brandId = r.brand.id;
  if (!v.categoryId && r.categoryId) patch.categoryId = r.categoryId;
  if (!v.specs.length && f.specs.length) patch.specs = f.specs.filter((s) => s.label.trim() && s.value.trim()).slice(0, 60).map((s) => ({ key: rowKey(), label: s.label.trim().slice(0, 60), value: s.value.trim().slice(0, 300) }));
  if (!v.voltage && f.voltage) patch.voltage = f.voltage;
  const pos = (n: number | null, max: number) => (n != null && n > 0 && n <= max ? n : null);
  if (v.warrantyMonths == null && pos(f.warrantyMonths, 240)) patch.warrantyMonths = Math.round(f.warrantyMonths!);
  if (v.weightGrams == null && pos(f.weightGrams, 10_000_000)) patch.weightGrams = Math.round(f.weightGrams!);
  if (v.widthCm == null && pos(f.widthCm, 1000)) patch.widthCm = f.widthCm;
  if (v.heightCm == null && pos(f.heightCm, 1000)) patch.heightCm = f.heightCm;
  if (v.depthCm == null && pos(f.depthCm, 1000)) patch.depthCm = f.depthCm;
  const ean = f.ean?.replace(/\D/g, "") ?? "";
  if (!v.ean && ean.length >= 8 && ean.length <= 14) patch.ean = ean;
  const tags = f.tags.map((t) => t.trim().toLowerCase().slice(0, 40)).filter(Boolean).slice(0, 8);
  if (tags.length && (rewrite || !v.tags.length)) patch.tags = tags;
  const count = Object.keys(patch).length;
  // Produto novo: a URL acompanha o nome, como quando ele é digitado.
  if (patch.name && v.slugAuto) patch.slug = slugify(patch.name);
  return { patch, count };
}

export function AiFillButton({
  form,
  aiName,
  categories,
  brands,
  onBrandFound,
}: {
  form: FormApi;
  aiName: string | null;
  categories: CategoryOption[];
  brands: BrandOption[];
  onBrandFound: (b: { id: string | null; name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const v = form.values;
  const photos = v.images.length;

  const run = (rewrite: boolean) =>
    start(async () => {
      let r: Awaited<ReturnType<typeof aiFillAction>>;
      try {
        r = await aiFillAction({
          rewrite,
          images: v.images.map((im) => im.sourceUrl || im.url).slice(0, 6),
          known: {
            name: v.name,
            brand: brands.find((b) => b.id === v.brandId)?.name ?? "",
            model: v.model,
            color: v.color,
            category: categories.find((c) => c.id === v.categoryId)?.label ?? "",
            voltage: v.voltage,
            warrantyMonths: v.warrantyMonths,
            ean: v.ean,
            shortDescription: v.shortDescription,
            description: v.description,
            specs: v.specs.filter((s) => s.label || s.value).map((s) => ({ label: s.label, value: s.value })),
          },
        });
      } catch {
        toast.error("Falha de conexão. Tente de novo.");
        return;
      }
      if (!r.ok || !r.data) {
        toast.error(r.ok ? "A IA não respondeu." : r.error);
        return;
      }
      const { brand } = r.data;
      if (brand) onBrandFound(brand);
      const { patch, count } = mergeAiFill(form.values, r.data, rewrite);
      form.patch(patch);
      setOpen(false);
      r.data.warnings.forEach((w) => toast.warning(w));
      if (brand && !brand.id) toast.info(`A marca ${brand.name} ainda não está cadastrada. Crie com um clique no campo Marca.`);
      toast.success(count ? `A IA preencheu ${pluralize(count, "campo", "campos")}. Revise antes de salvar.` : "A IA não encontrou nada novo para preencher.");
    });

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Sparkles aria-hidden className="text-primary" /> Preencher com IA
      </Button>
      <Dialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Preencher com IA"
        description={
          aiName
            ? `Usa o ${aiName} com ${photos ? pluralize(Math.min(photos, 6), "foto", "fotos") : "o nome"} e o que já está escrito. Preço e estoque nunca mudam.`
            : "Nenhuma IA configurada ainda."
        }
        size="sm"
      >
        {aiName ? (
          <div className="space-y-2.5">
            {!photos && <p className="rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-[13px]">Sem fotos, a IA só tem o nome para trabalhar. Para ficha técnica e medidas, envie fotos da caixa e do manual.</p>}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(false)}
              className="flex w-full items-start gap-3 rounded-xl border border-border p-3.5 text-left transition-colors hover:border-primary disabled:opacity-60"
            >
              <Wand2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block text-sm font-medium">Completar o que falta</span>
                <span className="mt-0.5 block text-[13px] text-muted-foreground">Preenche só os campos vazios: descrição, ficha técnica, medidas, tags, SEO…</span>
              </span>
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(true)}
              className="flex w-full items-start gap-3 rounded-xl border border-border p-3.5 text-left transition-colors hover:border-primary disabled:opacity-60"
            >
              <PenLine className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="block text-sm font-medium">Reescrever os textos de venda</span>
                <span className="mt-0.5 block text-[13px] text-muted-foreground">Melhora nome, resumo, descrição, tags e SEO mantendo os dados técnicos. O resto só se estiver vazio.</span>
              </span>
            </button>
            {pending && (
              <p className="text-center text-[13px] text-muted-foreground" role="status">
                Lendo fotos e escrevendo… pode levar até um minuto.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Escolha uma IA (o Gemini tem plano grátis) e cole a chave nas Configurações.</p>
            <Link href="/admin/configuracoes?aba=ia" className="font-medium text-primary underline-offset-4 hover:underline">
              Abrir Configurações → Inteligência artificial
            </Link>
          </div>
        )}
      </Dialog>
    </>
  );
}
