import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { absImage } from "@/components/store/catalog/queries";

// Mapa do site gerado a cada acesso (produtos, categorias, marcas e páginas mudam pelo painel).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const url = (path: string) => `${base}${path}`;

  const [categories, brands, products, pages] = await Promise.all([
    db.category.findMany({ where: { active: true }, select: { slug: true, updatedAt: true }, orderBy: { sortOrder: "asc" } }),
    db.brand.findMany({ where: { active: true, products: { some: { status: "ACTIVE" } } }, select: { slug: true, updatedAt: true } }),
    db.product.findMany({
      where: { status: "ACTIVE" },
      select: { slug: true, updatedAt: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } },
      orderBy: { updatedAt: "desc" },
      take: 45000,
    }),
    db.page.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
  ]).catch((e) => {
    console.error("[sitemap] falha ao consultar o banco:", (e as Error).message);
    return [[], [], [], []] as const;
  });

  const latest = products[0]?.updatedAt ?? new Date();

  return [
    { url: url("/"), lastModified: latest, changeFrequency: "daily", priority: 1 },
    { url: url("/ofertas"), lastModified: latest, changeFrequency: "daily", priority: 0.9 },
    { url: url("/lancamentos"), lastModified: latest, changeFrequency: "weekly", priority: 0.7 },
    ...categories.map((c) => ({ url: url(`/categoria/${c.slug}`), lastModified: c.updatedAt, changeFrequency: "daily" as const, priority: 0.8 })),
    ...brands.map((b) => ({ url: url(`/marca/${b.slug}`), lastModified: b.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...products.map((p) => ({
      url: url(`/produto/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      ...(p.images[0] ? { images: [absImage(p.images[0].url)] } : {}),
    })),
    ...pages.map((p) => ({ url: url(`/pagina/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
