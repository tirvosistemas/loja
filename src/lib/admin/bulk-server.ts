import { db } from "@/lib/db";
import type { BulkRow } from "./bulk";

// Linhas da edição em massa e da planilha exportada, direto do banco.

export const MAX_BULK_PRODUCTS = 3000;

export async function loadBulkRows(): Promise<{ rows: BulkRow[]; truncated: boolean }> {
  const products = await db.product.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: MAX_BULK_PRODUCTS + 1,
    select: {
      id: true,
      name: true,
      sku: true,
      priceCents: true,
      compareAtCents: true,
      costCents: true,
      stock: true,
      categoryId: true,
      brandId: true,
      status: true,
      weightGrams: true,
      widthCm: true,
      heightCm: true,
      depthCm: true,
      freeShipping: true,
      ean: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      variants: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, sku: true, priceCents: true, compareAtCents: true, stock: true } },
    },
  });
  const rows: BulkRow[] = [];
  for (const p of products.slice(0, MAX_BULK_PRODUCTS)) {
    const base: BulkRow = {
      key: `p:${p.id}`,
      productId: p.id,
      variantId: null,
      name: p.name,
      sku: p.sku ?? "",
      priceCents: p.priceCents,
      compareAtCents: p.compareAtCents,
      costCents: p.costCents,
      stock: p.stock,
      categoryId: p.categoryId ?? "",
      brandId: p.brandId ?? "",
      status: p.status,
      weightGrams: p.weightGrams,
      widthCm: p.widthCm,
      heightCm: p.heightCm,
      depthCm: p.depthCm,
      freeShipping: p.freeShipping,
      ean: p.ean ?? "",
      hasVariants: p.variants.length > 0,
      image: p.images[0]?.url ?? null,
    };
    rows.push(base);
    for (const v of p.variants) {
      rows.push({ ...base, key: `v:${v.id}`, variantId: v.id, name: v.name, sku: v.sku ?? "", priceCents: v.priceCents, compareAtCents: v.compareAtCents, costCents: null, stock: v.stock, image: null });
    }
  }
  return { rows, truncated: products.length > MAX_BULK_PRODUCTS };
}
