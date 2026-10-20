import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getBrandOptions, getCategoryOptions } from "@/lib/admin/catalog";
import { getProductTools } from "@/lib/admin/product-tools";
import { ProductForm } from "@/components/admin/products/product-form";
import { productToValues } from "@/components/admin/products/form-values";
import { siteHost } from "@/components/admin/products/site-host";

type Params = { params: Promise<{ id: string }> };

const validId = (id: string | undefined) => !!id && /^[\w-]{1,40}$/.test(id);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const product = validId(id) ? await db.product.findUnique({ where: { id }, select: { name: true } }).catch(() => null) : null;
  return { title: product ? product.name : "Produto" };
}

export default async function EditProductPage({ params }: Params) {
  await requireAdmin();
  const { id } = await params;
  if (!validId(id)) notFound();
  const [product, categories, brands, settings, tools] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: "asc" }, select: { url: true, sourceUrl: true, alt: true, width: true, height: true } },
        variants: { orderBy: { sortOrder: "asc" } },
      },
    }),
    getCategoryOptions(),
    getBrandOptions(),
    getSettings(),
    getProductTools(),
  ]);
  if (!product) notFound();

  return (
    <ProductForm
      // Remonta com os dados do banco depois de salvar (URL normalizada, ids das variações novas…).
      key={product.updatedAt.toISOString()}
      productId={product.id}
      initial={productToValues(product)}
      meta={{
        slug: product.slug,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
        soldCount: product.soldCount,
        viewCount: product.viewCount,
        ratingAvg: product.ratingAvg,
        ratingCount: product.ratingCount,
      }}
      categories={categories}
      brands={brands}
      storeName={settings.store.name}
      siteHost={siteHost()}
      tools={tools}
    />
  );
}
