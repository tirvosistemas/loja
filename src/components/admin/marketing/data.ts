import { Prisma, type DiscountScope } from "@prisma/client";
import { db } from "@/lib/db";

// Consultas do módulo de marketing (só no servidor).

export type CategoryOption = { id: string; name: string; slug: string; parentId: string | null; label: string; depth: number; active: boolean };
export type BrandOption = { id: string; name: string; slug: string; active: boolean };
export type PageOption = { slug: string; title: string; published: boolean };
export type PickerOptions = { categories: CategoryOption[]; brands: BrandOption[]; pages: PageOption[] };

/** Categorias (em árvore, com o caminho "Suportes de Celular › Suporte para Moto"), marcas e páginas para os seletores. */
export async function getPickerOptions(): Promise<PickerOptions> {
  const [cats, brands, pages] = await Promise.all([
    db.category.findMany({ select: { id: true, name: true, slug: true, parentId: true, active: true, sortOrder: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.brand.findMany({ select: { id: true, name: true, slug: true, active: true }, orderBy: { name: "asc" } }),
    db.page.findMany({ select: { slug: true, title: true, published: true }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }] }),
  ]);

  // Monta a árvore em ordem: pai seguido dos filhos (evita ciclos com o conjunto "seen").
  const byParent = new Map<string | null, typeof cats>();
  const ids = new Set(cats.map((c) => c.id));
  for (const c of cats) {
    const key = c.parentId && ids.has(c.parentId) ? c.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), c]);
  }
  const categories: CategoryOption[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, path: string[], depth: number) => {
    for (const c of byParent.get(parent) ?? []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      const label = [...path, c.name].join(" › ");
      categories.push({ id: c.id, name: c.name, slug: c.slug, parentId: c.parentId, label, depth, active: c.active });
      walk(c.id, [...path, c.name], depth + 1);
    }
  };
  walk(null, [], 0);
  for (const c of cats) if (!seen.has(c.id)) categories.push({ id: c.id, name: c.name, slug: c.slug, parentId: c.parentId, label: c.name, depth: 0, active: c.active });

  return { categories, brands, pages };
}

type ScopeInput = { scope: DiscountScope; categoryIds: string[]; brandIds: string[]; productIds: string[] };

/** Listas do escopo para gravar: só a do escopo escolhido; as outras ficam vazias (NULL). */
export function scopeData(v: ScopeInput) {
  return {
    scope: v.scope,
    categoryIds: v.scope === "CATEGORY" ? v.categoryIds : Prisma.DbNull,
    brandIds: v.scope === "BRAND" ? v.brandIds : Prisma.DbNull,
    productIds: v.scope === "PRODUCTS" ? v.productIds : Prisma.DbNull,
  };
}

/** Filtro de produtos ativos alcançados por um escopo (mesma regra de scopeMatches em lib/pricing). */
export function scopeWhere(v: ScopeInput): Prisma.ProductWhereInput {
  const base: Prisma.ProductWhereInput = { status: "ACTIVE" };
  switch (v.scope) {
    case "ALL":
      return base;
    case "CATEGORY":
      return { ...base, categoryId: { in: v.categoryIds } };
    case "BRAND":
      return { ...base, brandId: { in: v.brandIds } };
    case "PRODUCTS":
      return { ...base, id: { in: v.productIds } };
  }
}

export async function countScopeProducts(v: ScopeInput) {
  if (v.scope !== "ALL" && !(v.scope === "CATEGORY" ? v.categoryIds : v.scope === "BRAND" ? v.brandIds : v.productIds).length) return 0;
  return db.product.count({ where: scopeWhere(v) });
}

/** Imagens enviadas que não são usadas por nenhum outro banner (para apagar os arquivos com segurança). */
export async function unusedBannerImages(keys: (string | null | undefined)[], exceptBannerId?: string) {
  const list = Array.from(new Set(keys.filter((k): k is string => !!k && k.startsWith("/uploads/"))));
  if (!list.length) return [];
  const used = await db.banner.findMany({
    where: { id: exceptBannerId ? { not: exceptBannerId } : undefined, OR: [{ imageDesktop: { in: list } }, { imageMobile: { in: list } }] },
    select: { imageDesktop: true, imageMobile: true },
  });
  const inUse = new Set(used.flatMap((b) => [b.imageDesktop, b.imageMobile]));
  return list.filter((k) => !inUse.has(k));
}

/** Destinos possíveis para links (só o que está visível na loja). */
export function linkOptions(o: PickerOptions) {
  return {
    categories: o.categories.filter((c) => c.active).map((c) => ({ slug: c.slug, label: c.label })),
    brands: o.brands.filter((b) => b.active).map((b) => ({ slug: b.slug, label: b.name })),
    pages: o.pages.filter((p) => p.published).map((p) => ({ slug: p.slug, label: p.title })),
  };
}
