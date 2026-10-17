import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getApiSession } from "@/lib/auth";
import { db } from "@/lib/db";

// Busca de produtos para os seletores do painel (promoções, cupons, links de banners).
//   ?q=texto        → até 20 produtos (nome, SKU, modelo, marca)
//   ?ids=a,b,c      → os produtos desses ids (para mostrar os já escolhidos)
//   ?slugs=x,y      → idem, pela URL amigável

const listParam = z
  .string()
  .max(8000)
  .transform((s) => Array.from(new Set(s.split(",").map((x) => x.trim()).filter(Boolean))).slice(0, 200));

const querySchema = z.object({
  q: z.string().trim().max(120).default(""),
  ids: listParam.optional(),
  slugs: listParam.optional(),
});

const select = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  status: true,
  priceCents: true,
  stock: true,
  brand: { select: { name: true } },
  category: { select: { name: true } },
  images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 },
} satisfies Prisma.ProductSelect;

type Row = Prisma.ProductGetPayload<{ select: typeof select }>;

function toItem(p: Row) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    status: p.status,
    image: p.images[0]?.url ?? null,
    priceCents: p.priceCents,
    stock: p.stock,
    brand: p.brand?.name ?? null,
    category: p.category?.name ?? null,
  };
}

export async function GET(req: Request) {
  const session = await getApiSession();
  if (!session) return NextResponse.json({ error: "Faça login no painel." }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const parsed = querySchema.safeParse({
    q: sp.get("q") ?? undefined,
    ids: sp.get("ids") ?? undefined,
    slugs: sp.get("slugs") ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  const { q, ids, slugs } = parsed.data;

  try {
    let rows: Row[];
    if (ids?.length || slugs?.length) {
      rows = await db.product.findMany({
        where: ids?.length ? { id: { in: ids } } : { slug: { in: slugs } },
        select,
        take: 200,
      });
      // Mantém a ordem pedida.
      const order = ids?.length ? ids : slugs!;
      const key = (r: Row) => (ids?.length ? r.id : r.slug);
      rows.sort((a, b) => order.indexOf(key(a)) - order.indexOf(key(b)));
    } else {
      const where: Prisma.ProductWhereInput = { status: { not: "ARCHIVED" } };
      if (q) {
        const terms = q.split(/\s+/).filter(Boolean).slice(0, 5);
        where.AND = terms.map((t) => ({
          OR: [
            { name: { contains: t } },
            { sku: { contains: t } },
            { model: { contains: t } },
            { brand: { name: { contains: t } } },
            { variants: { some: { sku: { contains: t } } } },
          ],
        }));
      }
      // status "desc" põe ACTIVE antes de DRAFT (ordem do enum).
      rows = await db.product.findMany({
        where,
        select,
        orderBy: q ? [{ status: "desc" }, { soldCount: "desc" }, { name: "asc" }] : [{ updatedAt: "desc" }],
        take: 20,
      });
    }
    return NextResponse.json({ items: rows.map(toItem) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[busca de produtos] falha:", e);
    return NextResponse.json({ error: "Não foi possível buscar os produtos agora." }, { status: 500 });
  }
}
