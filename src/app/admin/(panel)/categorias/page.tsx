import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { flattenCategoryTree } from "@/lib/admin/catalog";
import { PageHeader } from "@/components/admin/page-header";
import { CategoriesManager, type CategoryRow } from "@/components/admin/catalog/categories-manager";

export const metadata: Metadata = { title: "Categorias" };

export default async function CategoriesPage() {
  await requireAdmin();
  const rows = await db.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      image: true,
      icon: true,
      parentId: true,
      sortOrder: true,
      active: true,
      featured: true,
      _count: { select: { products: true, children: true } },
    },
  });
  const tree = flattenCategoryTree(rows);

  // Posição entre as irmãs, para habilitar subir/descer.
  const siblings = new Map<string, string[]>();
  for (const c of tree) {
    const key = c.depth === 0 ? "" : (c.parentId ?? "");
    siblings.set(key, [...(siblings.get(key) ?? []), c.id]);
  }
  const categories: CategoryRow[] = tree.map((c) => {
    const list = siblings.get(c.depth === 0 ? "" : (c.parentId ?? "")) ?? [];
    const i = list.indexOf(c.id);
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image: c.image,
      icon: c.icon,
      parentId: c.depth === 0 ? null : c.parentId,
      parentName: c.depth > 0 ? (c.path[c.path.length - 2] ?? null) : null,
      depth: c.depth,
      active: c.active,
      featured: c.featured,
      productCount: c._count.products,
      childCount: c._count.children,
      first: i === 0,
      last: i === list.length - 1,
    };
  });

  return (
    <>
      <PageHeader title="Categorias" description="Organize o catálogo em categorias e subcategorias. A ordem aqui é a mesma do menu da loja." />
      <CategoriesManager categories={categories} />
    </>
  );
}
