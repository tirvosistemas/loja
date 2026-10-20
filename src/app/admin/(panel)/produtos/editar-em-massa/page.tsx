import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getBrandOptions, getCategoryOptions } from "@/lib/admin/catalog";
import { loadBulkRows } from "@/lib/admin/bulk-server";
import { getProductTools } from "@/lib/admin/product-tools";
import { PageHeader } from "@/components/admin/page-header";
import { BulkEditor } from "@/components/admin/products/bulk-editor";

export const metadata: Metadata = { title: "Edição em massa" };

export default async function BulkEditPage() {
  await requireAdmin();
  const [{ rows, truncated }, categories, brands, tools] = await Promise.all([loadBulkRows(), getCategoryOptions(), getBrandOptions(), getProductTools()]);
  return (
    <>
      <PageHeader
        title="Edição em massa"
        description="Mude preço, estoque, categoria, medidas e status de vários produtos de uma vez, aqui ou por planilha. Nada é gravado até você clicar em Salvar."
        back={{ href: "/admin/produtos", label: "Produtos" }}
      />
      <BulkEditor
        initial={rows}
        lookup={{ categories: categories.map((c) => ({ id: c.id, label: c.label })), brands: brands.map((b) => ({ id: b.id, name: b.name })) }}
        price={tools.price}
        truncated={truncated}
      />
    </>
  );
}
