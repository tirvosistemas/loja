import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageForm } from "@/components/admin/catalog/page-form";
import { siteHost } from "@/components/admin/products/site-host";

type Params = { params: Promise<{ id: string }> };

const validId = (id: string | undefined) => !!id && /^[\w-]{1,40}$/.test(id);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const page = validId(id) ? await db.page.findUnique({ where: { id }, select: { title: true } }).catch(() => null) : null;
  return { title: page ? page.title : "Página" };
}

export default async function EditPagePage({ params }: Params) {
  await requireAdmin();
  const { id } = await params;
  if (!validId(id)) notFound();
  const page = await db.page.findUnique({ where: { id } });
  if (!page) notFound();
  return (
    <PageForm
      key={page.updatedAt.toISOString()}
      pageId={page.id}
      siteHost={siteHost()}
      initial={{
        title: page.title,
        slug: page.slug,
        slugAuto: false,
        content: page.content,
        published: page.published,
        showInFooter: page.showInFooter,
        sortOrder: page.sortOrder,
      }}
      meta={{ slug: page.slug, createdAt: page.createdAt.toISOString(), updatedAt: page.updatedAt.toISOString() }}
    />
  );
}
