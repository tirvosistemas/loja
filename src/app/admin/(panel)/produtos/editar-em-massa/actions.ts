"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, isUniqueError, type ActionResult } from "@/lib/action";
import { pluralize } from "@/lib/format";
import { MAX_PRICE_CENTS } from "@/lib/admin/product-schema";
import { MAX_BULK_PRODUCTS } from "@/lib/admin/bulk-server";

// Edição em massa: grava só os campos alterados, produto por produto (tudo ou nada em cada
// um). Um produto com erro (SKU repetido, preço "de" menor que o preço…) não impede os outros.

const money = z.number().int().min(0).max(MAX_PRICE_CENTS);
const sku = z
  .string()
  .trim()
  .max(64, "SKU com mais de 64 caracteres.")
  .regex(/^[\w\-./ ]*$/, "SKU: use letras, números, hífen, ponto ou barra.")
  .transform((v) => v || null);
const optMeasure = (max: number) => z.number().min(0).max(max).nullable();

const fieldsSchema = z
  .object({
    name: z.string().trim().min(1, "Nome vazio.").max(160, "Nome com mais de 160 caracteres."),
    sku,
    priceCents: money.min(1, "Preço precisa ser maior que zero.").nullable(),
    compareAtCents: money.nullable(),
    costCents: money.nullable(),
    stock: z.number().int().min(0).max(1_000_000),
    categoryId: z.string().max(40),
    brandId: z.string().max(40),
    status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]),
    weightGrams: z.number().int().min(0).max(10_000_000).nullable(),
    widthCm: optMeasure(1000),
    heightCm: optMeasure(1000),
    depthCm: optMeasure(1000),
    freeShipping: z.boolean(),
    ean: z
      .string()
      .regex(/^\d*$/)
      .refine((v) => !v || (v.length >= 8 && v.length <= 14), "O EAN tem de 8 a 14 números.")
      .transform((v) => v || null),
  })
  .partial();

const changeSchema = z.object({
  key: z.string().max(60),
  productId: z.string().max(40),
  variantId: z.string().max(40).nullable(),
  fields: fieldsSchema,
  expectedStock: z.number().int(), // estoque que a página mostrava
});

export type BulkChange = z.input<typeof changeSchema>;
export type BulkSaveResult = { saved: number; errors: { key: string; message: string }[] };

class RowError extends Error {
  constructor(
    public key: string,
    message: string,
  ) {
    super(message);
  }
}

const STOCK_CHANGED = "O estoque mudou desde que a página abriu (venda nova?). Recarregue e tente de novo.";

export async function saveBulkEdit(changes: BulkChange[]): Promise<ActionResult<BulkSaveResult>> {
  await requireAdmin();
  const list = z.array(z.unknown()).max(MAX_BULK_PRODUCTS * 6).safeParse(changes);
  if (!list.success) return fail("Alterações demais de uma vez.");
  const errors: BulkSaveResult["errors"] = [];
  const valid: z.output<typeof changeSchema>[] = [];
  const invalidProducts = new Set<unknown>();
  for (const raw of list.data) {
    const c = changeSchema.safeParse(raw);
    if (c.success) valid.push(c.data);
    else {
      const key = (raw as { key?: string })?.key ?? "?";
      errors.push({ key, message: c.error.issues[0]?.message ?? "Valor inválido." });
      invalidProducts.add((raw as { productId?: unknown })?.productId);
    }
  }

  // Linha com erro trava o produto inteiro: a tela trata cada produto como tudo ou nada.
  const byProduct = new Map<string, z.output<typeof changeSchema>[]>();
  for (const c of valid) {
    if (invalidProducts.has(c.productId)) errors.push({ key: c.key, message: "Corrija a linha com erro deste produto; nada dele foi salvo." });
    else byProduct.set(c.productId, [...(byProduct.get(c.productId) ?? []), c]);
  }

  const [categories, brands] = await Promise.all([db.category.findMany({ select: { id: true } }), db.brand.findMany({ select: { id: true } })]);
  const catIds = new Set(categories.map((c) => c.id));
  const brandIds = new Set(brands.map((b) => b.id));

  let saved = 0;
  for (const [productId, items] of byProduct) {
    const productChange = items.find((c) => !c.variantId);
    try {
      await db.$transaction(async (tx) => {
        const p = await tx.product.findUnique({ where: { id: productId }, include: { variants: true } });
        if (!p) throw new RowError(items[0].key, "Produto não encontrado (pode ter sido excluído).");

        // Produto
        const f = productChange?.fields ?? {};
        const data: Prisma.ProductUncheckedUpdateInput = {};
        if (f.name !== undefined) {
          if (f.name.length < 2) throw new RowError(productChange!.key, "Nome do produto muito curto.");
          data.name = f.name;
        }
        if (f.sku !== undefined) data.sku = f.sku;
        if (f.priceCents !== undefined) {
          if (f.priceCents == null) throw new RowError(productChange!.key, "Informe o preço do produto.");
          data.priceCents = f.priceCents;
        }
        if (f.compareAtCents !== undefined) data.compareAtCents = f.compareAtCents || null;
        if (f.costCents !== undefined) data.costCents = f.costCents;
        // Estoque só grava se ainda for o que a página mostrou; senão uma venda feita no meio tempo se perderia.
        if (f.stock !== undefined && !p.variants.length) {
          const r = await tx.product.updateMany({ where: { id: productId, stock: productChange!.expectedStock }, data: { stock: f.stock } });
          if (!r.count) throw new RowError(productChange!.key, STOCK_CHANGED);
        }
        if (f.categoryId !== undefined) {
          if (f.categoryId && !catIds.has(f.categoryId)) throw new RowError(productChange!.key, "Categoria não encontrada.");
          data.categoryId = f.categoryId || null;
        }
        if (f.brandId !== undefined) {
          if (f.brandId && !brandIds.has(f.brandId)) throw new RowError(productChange!.key, "Marca não encontrada.");
          data.brandId = f.brandId || null;
        }
        if (f.status !== undefined) data.status = f.status;
        if (f.weightGrams !== undefined) data.weightGrams = f.weightGrams;
        if (f.widthCm !== undefined) data.widthCm = f.widthCm;
        if (f.heightCm !== undefined) data.heightCm = f.heightCm;
        if (f.depthCm !== undefined) data.depthCm = f.depthCm;
        if (f.freeShipping !== undefined) data.freeShipping = f.freeShipping;
        if (f.ean !== undefined) data.ean = f.ean;

        const price = (data.priceCents as number | undefined) ?? p.priceCents;
        const compare = data.compareAtCents !== undefined ? (data.compareAtCents as number | null) : p.compareAtCents;
        if (compare != null && compare <= price) throw new RowError(productChange?.key ?? `p:${productId}`, "O preço “de” precisa ser maior que o preço.");

        // Variações
        let variantsChanged = false;
        for (const c of items.filter((x) => x.variantId)) {
          const v = p.variants.find((x) => x.id === c.variantId);
          if (!v) throw new RowError(c.key, "Variação não encontrada.");
          const vf = c.fields;
          const vd: Prisma.ProductVariantUpdateManyMutationInput = {};
          if (vf.name !== undefined) {
            if (vf.name.length > 80) throw new RowError(c.key, "Nome da variação com mais de 80 caracteres.");
            if (p.variants.some((o) => o.id !== v.id && o.name.toLowerCase() === vf.name!.toLowerCase())) throw new RowError(c.key, "Já existe uma variação com esse nome.");
            vd.name = vf.name;
          }
          if (vf.sku !== undefined) {
            if (vf.sku && (await tx.product.findFirst({ where: { sku: vf.sku }, select: { id: true } }))) throw new RowError(c.key, "SKU já usado em um produto.");
            vd.sku = vf.sku;
          }
          if (vf.priceCents !== undefined) vd.priceCents = vf.priceCents;
          if (vf.compareAtCents !== undefined) vd.compareAtCents = vf.compareAtCents || null;
          if (vf.stock !== undefined) {
            vd.stock = vf.stock;
            variantsChanged = true;
          }
          const vPrice = (vd.priceCents !== undefined ? (vd.priceCents as number | null) : v.priceCents) ?? price;
          const vCompare = vd.compareAtCents !== undefined ? (vd.compareAtCents as number | null) : v.compareAtCents;
          if (vCompare != null && vCompare <= vPrice) throw new RowError(c.key, "O preço “de” da variação precisa ser maior que o preço.");
          if (Object.keys(vd).length) {
            let count: number;
            try {
              ({ count } = await tx.productVariant.updateMany({ where: { id: v.id, ...(vd.stock !== undefined && { stock: c.expectedStock }) }, data: vd }));
            } catch (e) {
              if (isUniqueError(e)) throw new RowError(c.key, "SKU já usado em outro produto.");
              throw e;
            }
            if (!count) throw new RowError(c.key, vd.stock !== undefined ? STOCK_CHANGED : "Variação não encontrada.");
          }
        }
        if (variantsChanged) {
          const fresh = await tx.productVariant.findMany({ where: { productId, active: true }, select: { stock: true } });
          data.stock = fresh.reduce((n, x) => n + x.stock, 0);
        }
        if (data.sku) {
          const clash = await tx.productVariant.findFirst({ where: { sku: data.sku as string, productId: { not: productId } }, select: { id: true } });
          if (clash) throw new RowError(productChange!.key, "SKU já usado em outro produto.");
        }
        if (Object.keys(data).length) {
          try {
            await tx.product.update({ where: { id: productId }, data });
          } catch (e) {
            if (isUniqueError(e, "sku")) throw new RowError(productChange?.key ?? `p:${productId}`, "SKU já usado em outro produto.");
            throw e;
          }
        }
      });
      saved++;
    } catch (e) {
      if (e instanceof RowError) errors.push({ key: e.key, message: e.message });
      else {
        console.error("[edição em massa] falha:", e);
        errors.push({ key: productChange?.key ?? items[0].key, message: "Não foi possível salvar este produto." });
      }
    }
  }

  revalidatePath("/admin/produtos", "layout");
  revalidatePath("/", "layout");
  const message = saved ? `${pluralize(saved, "produto atualizado", "produtos atualizados")}.` : "Nada foi salvo.";
  return { ok: true, data: { saved, errors }, message: errors.length ? `${message} ${pluralize(errors.length, "linha com erro", "linhas com erro")}.` : message };
}
