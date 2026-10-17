import { NextResponse } from "next/server";
import { z } from "zod";
import { getProductsByIds, listProducts } from "@/lib/catalog";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { parseListing, toProductFilters } from "@/components/store/catalog/params";

// GET /api/products?ids=a,b,c          → cards dos produtos (favoritos, vistos recentemente)
// GET /api/products?count=1&<filtros>  → total da listagem (botão "Ver N produtos" dos filtros)

const idsSchema = z
  .string()
  .max(60 * 42)
  .transform((s) => [...new Set(s.split(",").map((x) => x.trim()).filter(Boolean))])
  .pipe(z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/)).max(60));

const countBaseSchema = z.object({
  categoria: z.string().regex(/^[a-z0-9-]{1,120}$/).optional(),
  novo: z.literal("1").optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = url.searchParams;

  if (sp.get("count") === "1") {
    if (!rateLimit(`pcount:${clientIp(req.headers)}`, 90, 60_000).ok)
      return NextResponse.json({ error: "Muitas consultas. Aguarde um pouco." }, { status: 429 });
    const base = countBaseSchema.safeParse({ categoria: sp.get("categoria") ?? undefined, novo: sp.get("novo") ?? undefined });
    if (!base.success) return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
    const state = parseListing(sp);
    const result = await listProducts({
      ...toProductFilters(state, { category: base.data.categoria, isNew: !!base.data.novo }, "relevance", 1),
      page: 1,
    });
    if (base.data.categoria && !result.category) return NextResponse.json({ total: 0 });
    return NextResponse.json({ total: result.total }, { headers: { "Cache-Control": "no-store" } });
  }

  const raw = sp.get("ids");
  if (raw == null) return NextResponse.json({ error: "Informe os produtos em ?ids=." }, { status: 400 });
  const parsed = idsSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Lista de produtos inválida (máximo de 60)." }, { status: 400 });
  if (!rateLimit(`pids:${clientIp(req.headers)}`, 120, 60_000).ok)
    return NextResponse.json({ error: "Muitas consultas. Aguarde um pouco." }, { status: 429 });

  const items = await getProductsByIds(parsed.data);
  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
