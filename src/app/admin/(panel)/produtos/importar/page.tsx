import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/page-header";
import { ProductImporter } from "@/components/admin/products/importer";

export const metadata: Metadata = { title: "Importar produtos" };

export default async function ImportProductsPage() {
  await requireAdmin();
  const { integrations } = await getSettings();
  return (
    <>
      <PageHeader
        title="Importar produtos"
        description="Cadastre muitos produtos de uma vez a partir de pastas, .zip, Google Drive ou planilha. As fotos são otimizadas como no cadastro normal."
        back={{ href: "/admin/produtos", label: "Produtos" }}
      />
      <ProductImporter driveReady={!!integrations.googleDriveApiKey} aiReady={!!integrations.anthropicApiKey} />
    </>
  );
}
