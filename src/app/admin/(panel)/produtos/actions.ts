"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, fromZod, isUniqueError, type ActionResult } from "@/lib/action";
import { pluralize } from "@/lib/format";
import { productSchema, PRODUCT_STATUSES, type ProductData, type ProductInput } from "@/lib/admin/product-schema";
import { uniqueSlug } from "@/lib/admin/catalog";
import { deleteUnusedUploads } from "@/lib/admin/uploads";

// Produtos do painel: cadastro, edição (fotos e variações), duplicar, status e ações em massa.

const idSchema = z.string().trim().min(1).max(40);

class RuleError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

function refresh(id?: string) {
  revalidatePath("/admin/produtos");
  if (id) revalidatePath(`/admin/produtos/${id}`);
}

function handleError(e: unknown, where: string): ActionResult<never> {
  if (e instanceof RuleError) return fail(e.message, e.fieldErrors);
  if (isUniqueError(e, "slug")) return fail("Já existe um produto com essa URL.", { slug: "Essa URL já está em uso. Escolha outra." });
  if (isUniqueError(e, "ProductVariant_sku") || isUniqueError(e, "ProductVariant")) return fail("Há uma variação com SKU já usado em outro produto.");
  if (isUniqueError(e, "sku")) return fail("Esse SKU já está em uso.", { sku: "Esse SKU já está em uso em outro produto." });
  console.error(`[produtos] falha ao ${where}:`, e);
  return fail("Não foi possível salvar agora. Tente de novo em instantes.");
}

/** Campos da tabela Product a partir dos dados validados. */
function productFields(v: ProductData) {
  const variantStock = v.variants.filter((x) => x.active).reduce((n, x) => n + x.stock, 0);
  return {
    name: v.name,
    slug: v.slug,
    sku: v.sku,
    shortDescription: v.shortDescription,
    description: v.description,
    status: v.status,
    priceCents: v.priceCents,
    compareAtCents: v.compareAtCents,
    costCents: v.costCents,
    // Com variações, o estoque do produto é a soma delas (só informativo).
    stock: v.variants.length ? variantStock : v.stock,
    trackStock: v.trackStock,
    allowBackorder: v.trackStock ? v.allowBackorder : false,
    lowStockAlert: v.lowStockAlert,
    featured: v.featured,
    isNew: v.isNew,
    freeShipping: v.freeShipping,
    voltage: v.voltage,
    variantLabel: v.variants.length ? v.variantLabel : null,
    warrantyMonths: v.warrantyMonths,
    weightGrams: v.weightGrams,
    widthCm: v.widthCm,
    heightCm: v.heightCm,
    depthCm: v.depthCm,
    color: v.color,
    model: v.model,
    ean: v.ean,
    specs: v.specs.length ? (v.specs as Prisma.InputJsonValue) : Prisma.DbNull,
    tags: v.tags,
    videoUrl: v.videoUrl,
    metaTitle: v.metaTitle,
    metaDescription: v.metaDescription,
    categoryId: v.categoryId,
    brandId: v.brandId,
  } satisfies Prisma.ProductUncheckedUpdateInput;
}

/**
 * Confere categoria, marca, URL e SKUs antes de gravar, para devolver o erro no campo certo.
 * Retorna a URL final (no cadastro com URL automática, ganha sufixo se já existir).
 */
async function checkConflicts(v: ProductData, productId: string | null, slugAuto: boolean): Promise<string> {
  const errors: Record<string, string> = {};
  const variantSkus = v.variants.map((x) => x.sku).filter((s): s is string => !!s);
  const allSkus = [...variantSkus, ...(v.sku ? [v.sku] : [])];
  const notThis = productId ? { not: productId } : undefined;

  const [category, brand, slugOwner, productSkus, variantSkuRows] = await Promise.all([
    v.categoryId ? db.category.findUnique({ where: { id: v.categoryId }, select: { id: true } }) : null,
    v.brandId ? db.brand.findUnique({ where: { id: v.brandId }, select: { id: true } }) : null,
    db.product.findFirst({ where: { slug: v.slug, id: notThis }, select: { id: true } }),
    allSkus.length ? db.product.findMany({ where: { sku: { in: allSkus }, id: notThis }, select: { sku: true } }) : [],
    allSkus.length ? db.productVariant.findMany({ where: { sku: { in: allSkus }, productId: notThis }, select: { sku: true } }) : [],
  ]);

  if (v.categoryId && !category) errors.categoryId = "Categoria não encontrada. Escolha outra.";
  if (v.brandId && !brand) errors.brandId = "Marca não encontrada. Escolha outra.";

  let slug = v.slug;
  if (slugOwner) {
    if (slugAuto) slug = await uniqueSlug(v.slug, async (s) => !!(await db.product.findFirst({ where: { slug: s, id: notThis }, select: { id: true } })));
    else errors.slug = "Essa URL já está em uso por outro produto.";
  }

  const taken = new Set([...productSkus, ...variantSkuRows].map((r) => (r.sku ?? "").toLowerCase()));
  if (v.sku && taken.has(v.sku.toLowerCase())) errors.sku = "Esse SKU já está em uso em outro produto.";
  v.variants.forEach((x, i) => {
    if (x.sku && taken.has(x.sku.toLowerCase())) errors[`variants.${i}.sku`] = "SKU já usado em outro produto.";
  });

  if (Object.keys(errors).length) throw new RuleError("Confira os campos destacados.", errors);
  return slug;
}

export async function createProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  try {
    const slug = await checkConflicts(v, null, !!input.slugAuto);
    const product = await db.product.create({
      data: {
        ...productFields(v),
        specs: v.specs.length ? (v.specs as Prisma.InputJsonValue) : Prisma.DbNull,
        slug,
        images: { create: v.images.map((im, i) => ({ url: im.url, alt: im.alt, width: im.width ?? null, height: im.height ?? null, sortOrder: i })) },
        variants: {
          create: v.variants.map((x, i) => ({
            name: x.name,
            sku: x.sku,
            priceCents: x.priceCents,
            compareAtCents: x.compareAtCents,
            stock: x.stock,
            active: x.active,
            sortOrder: i,
          })),
        },
      },
      select: { id: true },
    });
    refresh(product.id);
    return { ok: true, data: { id: product.id }, message: "Produto cadastrado." };
  } catch (e) {
    return handleError(e, "criar");
  }
}

export async function updateProduct(id: string, input: ProductInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Produto inválido.");
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  try {
    const slug = await checkConflicts(v, id, false);
    const removedImages = await db.$transaction(
      async (tx) => {
        const existing = await tx.product.findUnique({
          where: { id },
          select: { images: { select: { url: true, width: true, height: true } }, variants: { select: { id: true, sku: true } } },
        });
        if (!existing) throw new RuleError("Produto não encontrado. Ele pode ter sido excluído.");

        await tx.product.update({ where: { id }, data: { ...productFields(v), slug } });

        // Fotos: recria na ordem nova, mantendo as dimensões das que já existiam.
        const dims = new Map(existing.images.map((im) => [im.url, im]));
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (v.images.length) {
          await tx.productImage.createMany({
            data: v.images.map((im, i) => ({
              productId: id,
              url: im.url,
              alt: im.alt,
              width: dims.get(im.url)?.width ?? im.width ?? null,
              height: dims.get(im.url)?.height ?? im.height ?? null,
              sortOrder: i,
            })),
          });
        }

        // Variações: atualiza as que continuam, cria as novas e remove as que saíram.
        // (Os pedidos guardam o id da variação como texto, então excluir é seguro.)
        const current = new Map(existing.variants.map((x) => [x.id, x.sku]));
        const kept = v.variants.filter((x) => x.id && current.has(x.id));
        await tx.productVariant.deleteMany({ where: { productId: id, id: { notIn: kept.map((x) => x.id as string) } } });
        // Libera os SKUs que vão mudar, para permitir trocar SKUs entre variações.
        const changing = kept.filter((x) => (current.get(x.id as string) ?? null) !== x.sku).map((x) => x.id as string);
        if (changing.length) await tx.productVariant.updateMany({ where: { id: { in: changing } }, data: { sku: null } });
        for (const [i, x] of v.variants.entries()) {
          const data = { name: x.name, sku: x.sku, priceCents: x.priceCents, compareAtCents: x.compareAtCents, stock: x.stock, active: x.active, sortOrder: i };
          if (x.id && current.has(x.id)) await tx.productVariant.update({ where: { id: x.id }, data });
          else await tx.productVariant.create({ data: { ...data, productId: id } });
        }

        const nextUrls = new Set(v.images.map((im) => im.url));
        return existing.images.map((im) => im.url).filter((u) => !nextUrls.has(u));
      },
      { timeout: 20_000 },
    );
    await deleteUnusedUploads(removedImages);
    refresh(id);
    return { ok: true, data: { id }, message: "Produto salvo." };
  } catch (e) {
    return handleError(e, "atualizar");
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Produto inválido.");
  try {
    const product = await db.product.findUnique({ where: { id }, select: { images: { select: { url: true } } } });
    if (!product) return fail("Produto não encontrado. Ele pode já ter sido excluído.");
    // Avaliações, fotos e variações saem junto; os pedidos guardam nome, SKU e preço.
    await db.product.delete({ where: { id } });
    await deleteUnusedUploads(product.images.map((im) => im.url));
    refresh();
    return { ok: true, message: "Produto excluído." };
  } catch (e) {
    return handleError(e, "excluir");
  }
}

export async function duplicateProduct(id: string): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  if (!idSchema.safeParse(id).success) return fail("Produto inválido.");
  try {
    const p = await db.product.findUnique({
      where: { id },
      include: { images: { orderBy: { sortOrder: "asc" } }, variants: { orderBy: { sortOrder: "asc" } } },
    });
    if (!p) return fail("Produto não encontrado.");
    const slug = await uniqueSlug(`${p.slug}-copia`, async (s) => !!(await db.product.findUnique({ where: { slug: s }, select: { id: true } })));
    const copy = await db.product.create({
      data: {
        name: `${p.name.slice(0, 152).trimEnd()} (cópia)`, // cabe no limite de 160 do cadastro
        slug,
        sku: null, // SKU é único: o dono define o da cópia
        status: "DRAFT",
        shortDescription: p.shortDescription,
        description: p.description,
        priceCents: p.priceCents,
        compareAtCents: p.compareAtCents,
        costCents: p.costCents,
        stock: p.stock,
        trackStock: p.trackStock,
        allowBackorder: p.allowBackorder,
        lowStockAlert: p.lowStockAlert,
        featured: p.featured,
        isNew: p.isNew,
        freeShipping: p.freeShipping,
        voltage: p.voltage,
        variantLabel: p.variantLabel,
        warrantyMonths: p.warrantyMonths,
        weightGrams: p.weightGrams,
        widthCm: p.widthCm,
        heightCm: p.heightCm,
        depthCm: p.depthCm,
        color: p.color,
        model: p.model,
        ean: p.ean,
        specs: p.specs === null ? Prisma.DbNull : (p.specs as Prisma.InputJsonValue),
        tags: p.tags,
        videoUrl: p.videoUrl,
        metaTitle: p.metaTitle,
        metaDescription: p.metaDescription,
        categoryId: p.categoryId,
        brandId: p.brandId,
        // As fotos apontam para os mesmos arquivos (não duplica no disco).
        images: { create: p.images.map((im, i) => ({ url: im.url, alt: im.alt, width: im.width, height: im.height, sortOrder: i })) },
        variants: {
          create: p.variants.map((x, i) => ({
            name: x.name,
            sku: null,
            priceCents: x.priceCents,
            compareAtCents: x.compareAtCents,
            stock: x.stock,
            active: x.active,
            sortOrder: i,
          })),
        },
      },
      select: { id: true },
    });
    refresh();
    return { ok: true, data: { id: copy.id }, message: "Cópia criada como rascunho." };
  } catch (e) {
    return handleError(e, "duplicar");
  }
}

const statusSchema = z.enum(PRODUCT_STATUSES);
const STATUS_MESSAGE = { ACTIVE: "Produto ativo na loja.", DRAFT: "Produto salvo como rascunho.", ARCHIVED: "Produto arquivado." } as const;

export async function setProductStatus(id: string, status: (typeof PRODUCT_STATUSES)[number]): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: idSchema, status: statusSchema }).safeParse({ id, status });
  if (!parsed.success) return fail("Dados inválidos.");
  try {
    const r = await db.product.updateMany({ where: { id: parsed.data.id }, data: { status: parsed.data.status } });
    if (!r.count) return fail("Produto não encontrado.");
    refresh(parsed.data.id);
    return { ok: true, message: STATUS_MESSAGE[parsed.data.status] };
  } catch (e) {
    return handleError(e, "mudar o status");
  }
}

export async function toggleFeatured(id: string, featured: boolean): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: idSchema, featured: z.boolean() }).safeParse({ id, featured });
  if (!parsed.success) return fail("Dados inválidos.");
  try {
    const r = await db.product.updateMany({ where: { id: parsed.data.id }, data: { featured: parsed.data.featured } });
    if (!r.count) return fail("Produto não encontrado.");
    refresh(parsed.data.id);
    return { ok: true, message: parsed.data.featured ? "Produto em destaque na página inicial." : "Produto fora dos destaques." };
  } catch (e) {
    return handleError(e, "mudar o destaque");
  }
}

export type BulkProductAction = "activate" | "draft" | "archive" | "feature" | "unfeature" | "delete";

const bulkSchema = z.object({
  ids: z.array(idSchema).min(1, "Selecione pelo menos um produto.").max(500, "Selecione até 500 produtos por vez."),
  action: z.enum(["activate", "draft", "archive", "feature", "unfeature", "delete"]),
});

export async function bulkProducts(ids: string[], action: BulkProductAction): Promise<ActionResult<{ count: number }>> {
  await requireAdmin();
  const parsed = bulkSchema.safeParse({ ids, action });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Seleção inválida.");
  const where = { id: { in: [...new Set(parsed.data.ids)] } };
  try {
    let count = 0;
    switch (parsed.data.action) {
      case "activate":
        count = (await db.product.updateMany({ where, data: { status: "ACTIVE" } })).count;
        break;
      case "draft":
        count = (await db.product.updateMany({ where, data: { status: "DRAFT" } })).count;
        break;
      case "archive":
        count = (await db.product.updateMany({ where, data: { status: "ARCHIVED" } })).count;
        break;
      case "feature":
        count = (await db.product.updateMany({ where, data: { featured: true } })).count;
        break;
      case "unfeature":
        count = (await db.product.updateMany({ where, data: { featured: false } })).count;
        break;
      case "delete": {
        const images = await db.productImage.findMany({ where: { productId: where.id }, select: { url: true } });
        count = (await db.product.deleteMany({ where })).count;
        await deleteUnusedUploads(images.map((im) => im.url));
        break;
      }
    }
    refresh();
    const n = pluralize(count, "produto", "produtos");
    const verb = {
      activate: count === 1 ? "ativado" : "ativados",
      draft: count === 1 ? "movido para rascunho" : "movidos para rascunho",
      archive: count === 1 ? "arquivado" : "arquivados",
      feature: count === 1 ? "marcado como destaque" : "marcados como destaque",
      unfeature: count === 1 ? "fora dos destaques" : "fora dos destaques",
      delete: count === 1 ? "excluído" : "excluídos",
    }[parsed.data.action];
    return { ok: true, data: { count }, message: `${n} ${verb}.` };
  } catch (e) {
    return handleError(e, "aplicar a ação em massa");
  }
}
