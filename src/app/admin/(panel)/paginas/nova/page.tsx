import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageForm } from "@/components/admin/catalog/page-form";
import { siteHost } from "@/components/admin/products/site-host";

export const metadata: Metadata = { title: "Nova página" };

export default async function NewPagePage() {
  await requireAdmin();
  const last = await db.page.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  return (
    <PageForm
      pageId={null}
      siteHost={siteHost()}
      initial={{ title: "", slug: "", slugAuto: true, content: "", published: true, showInFooter: true, sortOrder: Math.min(999, (last?.sortOrder ?? -1) + 1) }}
      meta={null}
    />
  );
}
