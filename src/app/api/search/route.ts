import { NextResponse } from "next/server";
import { z } from "zod";
import { searchSuggestions } from "@/lib/catalog";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Sugestões da busca do topo (produtos e categorias enquanto a pessoa digita).

const querySchema = z.object({
  q: z
    .string()
    .default("")
    .transform((s) => s.replace(/\s+/g, " ").trim().slice(0, 80)),
});

export async function GET(req: Request) {
  const rl = rateLimit(`search:${clientIp(req.headers)}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas buscas seguidas. Aguarde alguns segundos e tente de novo." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const parsed = querySchema.safeParse({ q: new URL(req.url).searchParams.get("q") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "Busca inválida." }, { status: 400 });
  const { q } = parsed.data;
  if (q.length < 2) return NextResponse.json({ q, products: [], categories: [] });

  try {
    const result = await searchSuggestions(q);
    return NextResponse.json({ q, ...result }, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch (e) {
    console.error("[api/search]", e);
    return NextResponse.json({ error: "Não foi possível buscar agora. Tente de novo em instantes." }, { status: 500 });
  }
}
