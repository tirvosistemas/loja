import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getBrandOptions, getCategoryOptions } from "@/lib/admin/catalog";
import { ProductForm } from "@/components/admin/products/product-form";
import { emptyProductValues } from "@/components/admin/products/form-values";
import { siteHost } from "@/components/admin/products/site-host";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NewProductPage() {
  await requireAdmin();
  const [categories, brands, settings] = await Promise.all([getCategoryOptions(), getBrandOptions(), getSettings()]);
  return <ProductForm productId={null} initial={emptyProductValues()} meta={null} categories={categories} brands={brands} storeName={settings.store.name} siteHost={siteHost()} />;
}
