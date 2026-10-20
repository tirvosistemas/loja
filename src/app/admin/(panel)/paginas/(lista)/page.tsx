import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { PagesTable, type PageRow } from "@/components/admin/catalog/pages-table";
import { LegalGenerator } from "@/components/admin/catalog/legal-generator";
import { getSettings } from "@/lib/settings";
import { LEGAL_PAGES, legalMissing } from "@/lib/legal-pages";

export const metadata: Metadata = { title: "Páginas" };

export default async function PagesPage() {
  await requireAdmin();
  const rows = await db.page.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { id: true, title: true, slug: true, published: true, showInFooter: true, sortOrder: true, updatedAt: true },
  });
  const pages: PageRow[] = rows.map((p) => ({ ...p, updatedAt: p.updatedAt.toISOString() }));
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        title="Páginas"
        description="Textos institucionais da loja: quem somos, entregas, trocas, privacidade e perguntas frequentes."
        actions={
          <>
            <LegalGenerator pages={LEGAL_PAGES} existing={rows.map((r) => r.slug)} missing={legalMissing(settings)} />
            <Link href="/admin/paginas/nova" className={buttonVariants()}>
              <Plus aria-hidden /> Nova página
            </Link>
          </>
        }
      />
      {pages.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="Nenhuma página criada"
          description="Crie páginas como Sobre nós, Trocas e devoluções e Política de privacidade. Elas aparecem no rodapé da loja."
          action={
            <Link href="/admin/paginas/nova" className={buttonVariants({ size: "sm" })}>
              <Plus aria-hidden /> Criar página
            </Link>
          }
        />
      ) : (
        <PagesTable pages={pages} />
      )}
    </>
  );
}
