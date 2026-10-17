import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { zodFieldErrors } from "@/lib/action";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getReviewsPage } from "@/components/store/product/reviews-data";

// GET  /api/reviews?productId=&page=  → avaliações aprovadas (10 por página) + resumo
// POST /api/reviews                    → nova avaliação (fica pendente até a moderação)

const getSchema = z.object({
  productId: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/, "Produto inválido."),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

// Remove caracteres de controle (mantém quebras de linha no comentário).
const clean = (s: string) => s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim();

const postSchema = z.object({
  productId: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/, "Produto inválido."),
  name: z.string().transform(clean).pipe(z.string().min(2, "Informe seu nome.").max(60, "Use no máximo 60 caracteres.")),
  city: z.string().optional().default("").transform(clean).pipe(z.string().max(60, "Use no máximo 60 caracteres.")),
  rating: z.number({ error: "Escolha uma nota de 1 a 5 estrelas." }).int().min(1, "Escolha uma nota de 1 a 5 estrelas.").max(5, "Escolha uma nota de 1 a 5 estrelas."),
  title: z.string().optional().default("").transform(clean).pipe(z.string().max(80, "Use no máximo 80 caracteres.")),
  comment: z
    .string()
    .transform(clean)
    .pipe(z.string().min(10, "Conte um pouco mais (mínimo de 10 caracteres).").max(1500, "Use no máximo 1.500 caracteres.")),
  website: z.string().optional().default(""), // isca para robôs: deve vir vazio
});

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const parsed = getSchema.safeParse({ productId: sp.get("productId") ?? "", page: sp.get("page") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  const data = await getReviewsPage(parsed.data.productId, parsed.data.page);
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Confira os campos destacados.", fieldErrors: zodFieldErrors(parsed.error) }, { status: 400 });
  }
  const input = parsed.data;

  // Robô preencheu a isca: responde como sucesso, sem salvar.
  if (input.website.trim()) {
    return NextResponse.json({ ok: true, message: "Obrigado! Sua avaliação será publicada após moderação." }, { status: 201 });
  }

  const limit = rateLimit(`review:${clientIp(req.headers)}`, 5, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Você enviou muitas avaliações seguidas. Tente de novo mais tarde." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const product = await db.product.findFirst({ where: { id: input.productId, status: "ACTIVE" }, select: { id: true } });
  if (!product) return NextResponse.json({ ok: false, error: "Produto não encontrado." }, { status: 404 });

  await db.review.create({
    data: {
      productId: product.id,
      name: input.name,
      city: input.city || null,
      rating: input.rating,
      title: input.title || null,
      comment: input.comment,
      approved: false,
    },
  });

  return NextResponse.json({ ok: true, message: "Obrigado! Sua avaliação será publicada após moderação." }, { status: 201 });
}
