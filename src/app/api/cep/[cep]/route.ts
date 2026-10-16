import { NextResponse } from "next/server";
import { lookupCep } from "@/lib/cep";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export async function GET(req: Request, { params }: { params: Promise<{ cep: string }> }) {
  if (!rateLimit(`cep:${clientIp(req.headers)}`, 40, 60_000).ok) return NextResponse.json({ error: "Muitas consultas. Aguarde um pouco." }, { status: 429 });
  const { cep } = await params;
  const info = await lookupCep(cep);
  if (!info) return NextResponse.json({ error: "CEP não encontrado." }, { status: 404 });
  return NextResponse.json(info, { headers: { "Cache-Control": "public, max-age=86400" } });
}
