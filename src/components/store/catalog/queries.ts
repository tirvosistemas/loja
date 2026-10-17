import { cache } from "react";
import { db } from "@/lib/db";
import { imageUrl } from "@/lib/images";
import { absoluteUrl } from "@/lib/utils";

// Consultas leves das páginas de listagem (compartilhadas entre metadados e página).

export const getCategoryMeta = cache(async (slug: string) =>
  db.category.findFirst({
    where: { slug, active: true },
    select: { id: true, name: true, slug: true, description: true, image: true, icon: true, parent: { select: { name: true, slug: true } } },
  }),
);

export const getBrandMeta = cache(async (slug: string) =>
  db.brand.findFirst({
    where: { slug, active: true },
    select: { id: true, name: true, slug: true, logo: true },
  }),
);

/** Facetas da marca (voltagens e faixa de preço só dos produtos dela). */
export async function getBrandFacets(brandId: string) {
  const [volts, price] = await Promise.all([
    db.product.groupBy({ by: ["voltage"], where: { status: "ACTIVE", brandId }, _count: { _all: true } }),
    db.product.aggregate({ where: { status: "ACTIVE", brandId }, _min: { priceCents: true }, _max: { priceCents: true } }),
  ]);
  return { volts, price: { minCents: price._min.priceCents ?? 0, maxCents: price._max.priceCents ?? 0 } };
}

/** Resumo de texto para meta description (sem markdown, até ~160 caracteres). */
export function plainExcerpt(text: string | null | undefined, max = 160) {
  const plain = (text ?? "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*]|\d+[.)])\s+/gm, "")
    .replace(/\*\*?|`/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

/** URL absoluta da imagem grande (para Open Graph, JSON-LD e sitemap). */
export function absImage(src: string) {
  const u = imageUrl(src, "lg");
  return /^https?:\/\//i.test(u) ? u : absoluteUrl(u);
}
