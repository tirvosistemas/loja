import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { BrandsManager, type BrandRow } from "@/components/admin/catalog/brands-manager";

export const metadata: Metadata = { title: "Marcas" };

export default async function BrandsPage() {
  await requireAdmin();
  const rows = await db.brand.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, logo: true, active: true, _count: { select: { products: true } } },
  });
  const brands: BrandRow[] = rows.map(({ _count, ...b }) => ({ ...b, productCount: _count.products }));
  return (
    <>
      <PageHeader title="Marcas" description="Fabricantes dos produtos. Aparecem no filtro da loja e na faixa de marcas da página inicial." />
      <BrandsManager brands={brands} />
    </>
  );
}
