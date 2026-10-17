import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isPushEndpoint } from "@/lib/validators";

const subSchema = z.object({
  endpoint: z.string().max(768).refine(isPushEndpoint),
  keys: z.object({ p256dh: z.string().min(10).max(255), auth: z.string().min(4).max(255) }),
});

export async function POST(req: Request) {
  if (!rateLimit(`push:${clientIp(req.headers)}`, 20, 60_000).ok) return NextResponse.json({ error: "Muitas tentativas." }, { status: 429 });
  const parsed = subSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Inscrição inválida." }, { status: 400 });
  const { endpoint, keys } = parsed.data;
  const userAgent = req.headers.get("user-agent")?.slice(0, 400) ?? null;
  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    update: { p256dh: keys.p256dh, auth: keys.auth, userAgent, failures: 0 },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!rateLimit(`push-del:${clientIp(req.headers)}`, 20, 60_000).ok) return NextResponse.json({ error: "Muitas tentativas." }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint === "string" && body.endpoint) {
    await db.pushSubscription.deleteMany({ where: { endpoint: body.endpoint.slice(0, 768) } });
  }
  return NextResponse.json({ ok: true });
}
