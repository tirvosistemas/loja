"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, type ActionResult } from "@/lib/action";
import { isUploadKey } from "@/lib/images";
import { saveImage } from "@/lib/uploads";
import { aiErrorMessage, getAiConfig } from "@/lib/ai/client";
import { aiFillProduct, type ProductAiFill } from "@/lib/ai/product";
import { BarcodeError, lookupBarcode, type BarcodeResult } from "@/lib/barcode";
import { fetchImage } from "@/lib/importer/fetch-image";
import { categoryLabels, findBrand, findCategory, loadCatalog, type Catalog } from "@/lib/importer/server";
import { readPhoto } from "@/lib/photos";
import { pluralize } from "@/lib/format";
import { photoStandard, standardizeImage, standardizeProducts, type StdImage } from "@/lib/admin/standardize";

// Ferramentas do cadastro de produto: preencher com IA e buscar pelo código de barras.

// id null = marca ainda não cadastrada: o formulário só sugere, quem cria é o dono.
type BrandRef = { id: string | null; name: string } | null;

/** Marca já cadastrada (sem diferenciar maiúsculas e acentos) ou só o nome sugerido. Não cria nada. */
function brandRef(raw: string | null, catalog: Catalog): BrandRef {
  const name = raw?.trim().slice(0, 80);
  if (!name) return null;
  const found = findBrand(name, catalog);
  return found ? { id: found.id, name: found.name } : { id: null, name };
}

const knownSchema = z.object({
  name: z.string().max(200),
  brand: z.string().max(80),
  model: z.string().max(80),
  color: z.string().max(60),
  category: z.string().max(200),
  voltage: z.string().max(10),
  warrantyMonths: z.number().int().min(0).max(240).nullable(),
  ean: z.string().max(14),
  shortDescription: z.string().max(500),
  description: z.string().max(20000),
  specs: z.array(z.object({ label: z.string().max(60), value: z.string().max(300) })).max(60),
});

export type AiFillResult = { fill: ProductAiFill; categoryId: string | null; brand: BrandRef; warnings: string[]; model: string };

export async function aiFillAction(input: { known: z.input<typeof knownSchema>; images: string[]; rewrite: boolean }): Promise<ActionResult<AiFillResult>> {
  await requireAdmin();
  const known = knownSchema.safeParse(input?.known);
  const images = z.array(z.string().max(300).refine(isUploadKey)).max(12).safeParse(input?.images ?? []);
  if (!known.success || !images.success) return fail("Dados inválidos.");
  const config = await getAiConfig();
  if (!config) return fail("Escolha uma IA e cadastre a chave em Configurações → Inteligência artificial.");
  const k = known.data;
  if (!images.data.length && k.name.trim().length < 3) return fail("Envie fotos ou escreva o nome do produto para a IA ter por onde começar.");
  try {
    const buffers = (await Promise.all(images.data.slice(0, 6).map(readPhoto))).filter((b) => b != null);
    const catalog = await loadCatalog();
    const r = await aiFillProduct({
      config,
      images: buffers,
      categories: categoryLabels(catalog),
      rewrite: !!input.rewrite,
      known: {
        name: k.name || null,
        brand: k.brand || null,
        model: k.model || null,
        color: k.color || null,
        category: k.category || null,
        voltage: k.voltage || null,
        warrantyMonths: k.warrantyMonths,
        ean: k.ean || null,
        shortDescription: k.shortDescription || null,
        description: k.description || null,
        specs: k.specs,
      },
    });
    const warnings: string[] = [];
    if (r.imagesIgnored) warnings.push("O modelo escolhido não lê fotos: só o texto foi usado.");
    const category = findCategory(r.data.category, catalog);
    const brand = k.brand ? null : brandRef(r.data.brand, catalog);
    return { ok: true, data: { fill: r.data, categoryId: category?.id ?? null, brand, warnings, model: r.model } };
  } catch (e) {
    console.error("[produto] IA:", e);
    return fail(aiErrorMessage(e));
  }
}

export type BarcodeLookupResult = {
  result: BarcodeResult;
  brand: BrandRef;
  existing: { id: string; name: string } | null; // outro produto da loja com o mesmo código
  images: { url: string; width: number; height: number }[];
  warnings: string[];
};

/** `currentId`: o produto em edição, que não conta como repetido. */
export async function barcodeLookupAction(ean: string, maxImages: number, currentId?: string | null): Promise<ActionResult<BarcodeLookupResult>> {
  await requireAdmin();
  const code = String(ean ?? "").replace(/\D/g, "").slice(0, 14);
  const limit = Math.max(0, Math.min(6, Math.trunc(Number(maxImages) || 0)));
  const selfId = typeof currentId === "string" && currentId ? currentId.slice(0, 40) : null;
  try {
    const result = await lookupBarcode(code);
    const eans = [...new Set([code, result?.ean ?? ""])].filter(Boolean);
    const existing = await db.product.findFirst({ where: { ean: { in: eans }, ...(selfId ? { id: { not: selfId } } : {}) }, select: { id: true, name: true } });
    if (!result) {
      return fail(
        existing
          ? `Código não encontrado nas bases, mas já está cadastrado na loja: ${existing.name}.`
          : "Código não encontrado nas bases. Preencha à mão ou use a IA com fotos da caixa.",
      );
    }
    const warnings: string[] = [];
    const brand = result.brand ? brandRef(result.brand, await loadCatalog()) : null;
    const images: BarcodeLookupResult["images"] = [];
    for (const url of result.images.slice(0, limit)) {
      try {
        const saved = await saveImage(await fetchImage(url, { maxBytes: 10 * 1024 * 1024 }), "products", { maxBytes: 10 * 1024 * 1024 });
        images.push({ url: saved.key, width: saved.width, height: saved.height });
      } catch {
        warnings.push("Uma foto da base não pôde ser baixada.");
      }
    }
    return { ok: true, data: { result, brand, existing, images, warnings } };
  } catch (e) {
    if (e instanceof BarcodeError) return fail(e.message);
    console.error("[produto] código de barras:", e);
    return fail("Não foi possível buscar agora. Tente de novo.");
  }
}

// ───────── Padrão das fotos

const imageRefs = z.array(z.object({ url: z.string().max(500), sourceUrl: z.string().max(500).nullish() })).max(12);

/** Padroniza as fotos do formulário (antes de salvar). Fotos por link ficam como estão. */
export async function standardizeImagesAction(images: { url: string; sourceUrl?: string | null }[]): Promise<ActionResult<{ images: StdImage[]; changed: number }>> {
  await requireAdmin();
  const parsed = imageRefs.safeParse(images);
  if (!parsed.success) return fail("Fotos inválidas.");
  try {
    const std = await photoStandard();
    let changed = 0;
    const out: StdImage[] = [];
    for (const im of parsed.data) {
      const next = isUploadKey(im.url) ? await standardizeImage(im, std) : null;
      if (next) changed++;
      out.push(next ?? { url: im.url, sourceUrl: im.sourceUrl ?? null, width: null, height: null });
    }
    return { ok: true, data: { images: out, changed } };
  } catch (e) {
    console.error("[produto] padronizar fotos:", e);
    return fail("Não foi possível padronizar as fotos agora.");
  }
}

/** Lista de produtos: padroniza (ou desfaz) as fotos dos selecionados. */
export async function standardizeProductsAction(ids: string[], undo: boolean): Promise<ActionResult<{ photos: number }>> {
  await requireAdmin();
  const parsed = z.array(z.string().max(40)).min(1, "Selecione pelo menos um produto.").max(200, "Até 200 produtos por vez.").safeParse(ids);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Seleção inválida.");
  try {
    const r = await standardizeProducts([...new Set(parsed.data)], !!undo);
    revalidatePath("/admin/produtos", "layout");
    revalidatePath("/", "layout");
    if (!r.photos) return { ok: true, data: { photos: 0 }, message: undo ? "Nenhuma foto padronizada para desfazer." : "Nenhuma foto para padronizar." };
    const msg = undo
      ? `${pluralize(r.photos, "foto voltou", "fotos voltaram")} ao original.`
      : `${pluralize(r.photos, "foto padronizada", "fotos padronizadas")} em ${pluralize(r.products, "produto", "produtos")}.`;
    return { ok: true, data: { photos: r.photos }, message: r.failed ? `${msg} ${pluralize(r.failed, "falhou", "falharam")}.` : msg };
  } catch (e) {
    console.error("[produtos] padronizar fotos:", e);
    return fail("Não foi possível padronizar agora.");
  }
}
