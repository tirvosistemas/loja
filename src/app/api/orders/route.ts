import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createOrder } from "@/lib/orders/create-order";

// Criação do pedido pelo checkout. Preços e totais são sempre recalculados no servidor.
export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const minute = rateLimit(`orders:m:${ip}`, 5, 60_000);
  const hour = rateLimit(`orders:h:${ip}`, 30, 60 * 60_000);
  if (!minute.ok || !hour.ok) {
    const wait = Math.max(minute.ok ? 0 : minute.retryAfterMs, hour.ok ? 0 : hour.retryAfterMs);
    return NextResponse.json(
      { error: "Muitos pedidos seguidos deste aparelho. Aguarde um pouco e tente de novo." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(wait / 1000)) } },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Dados do pedido inválidos." }, { status: 400 });

  const result = await createOrder(body, { ip, userAgent: req.headers.get("user-agent") });
  if (!result.ok) {
    const { status, error, fieldErrors, issues } = result;
    return NextResponse.json({ error, fieldErrors, issues }, { status });
  }
  return NextResponse.json(
    { code: result.code, whatsappUrl: result.whatsappUrl, stripeUrl: result.stripeUrl },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
