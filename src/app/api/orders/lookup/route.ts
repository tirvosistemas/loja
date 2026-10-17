import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { phoneSchema } from "@/lib/validators";

// Busca de pedido por código + WhatsApp (página "Acompanhar pedido"). A resposta é a
// mesma para código inexistente e telefone errado, e leva sempre o mesmo tempo mínimo.

const bodySchema = z.object({
  code: z
    .string()
    .max(32)
    .transform((c) => c.replace(/[^a-z0-9]/gi, "").toUpperCase())
    .refine((c) => c.length >= 4 && c.length <= 16, "Informe o código do pedido."),
  phone: phoneSchema,
});

const MIN_MS = 450;
const NOT_FOUND = "Pedido não encontrado. Confira o código e o WhatsApp usado na compra.";

const digest = (s: string) => createHash("sha256").update(s).digest();

async function settle<T>(started: number, value: T): Promise<T> {
  const wait = MIN_MS - (Date.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return value;
}

export async function POST(req: Request) {
  const started = Date.now();
  if (!rateLimit(`lookup:${clientIp(req.headers)}`, 10, 60_000).ok) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um minuto e tente de novo." }, { status: 429 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const k = String(i.path[0] ?? "");
      if (k && !fieldErrors[k]) fieldErrors[k] = k === "code" ? "Informe o código do pedido." : k === "phone" ? "Informe o WhatsApp com DDD." : i.message;
    }
    return settle(started, NextResponse.json({ error: "Confira os campos.", fieldErrors }, { status: 422 }));
  }

  const { code, phone } = parsed.data;
  const order = await db.order.findUnique({ where: { code }, select: { code: true, customerPhone: true } }).catch(() => null);
  // Compara sempre (mesmo sem pedido) para não revelar se o código existe.
  const stored = order?.customerPhone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "") ?? "x";
  const match = timingSafeEqual(digest(stored), digest(phone)) && !!order;

  if (!match) return settle(started, NextResponse.json({ error: NOT_FOUND }, { status: 404 }));
  return settle(started, NextResponse.json({ code: order!.code }, { headers: { "Cache-Control": "no-store" } }));
}
