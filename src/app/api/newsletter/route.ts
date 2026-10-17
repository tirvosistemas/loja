import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isUniqueError } from "@/lib/action";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Inscrição na newsletter da página inicial.

const bodySchema = z.object({
  email: z
    .string({ error: "Digite seu e-mail." })
    .trim()
    .toLowerCase()
    .min(1, "Digite seu e-mail.")
    .max(191, "E-mail muito longo.")
    .pipe(z.email("Digite um e-mail válido, como nome@email.com.")),
  website: z.string().max(200).optional(), // armadilha para robôs: pessoas não preenchem
});

export async function POST(req: Request) {
  const rl = rateLimit(`newsletter:${clientIp(req.headers)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas. Tente de novo em um minuto." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues.find((i) => i.path[0] === "email")?.message ?? "Digite um e-mail válido.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
  const { email, website } = parsed.data;
  const done = { ok: true, message: "Inscrição confirmada! Você vai receber nossas ofertas por e-mail." };
  if (website) return NextResponse.json(done);

  try {
    const existing = await db.newsletterSubscriber.findUnique({ where: { email }, select: { id: true } });
    if (existing) return NextResponse.json({ ok: true, message: "Este e-mail já está na nossa lista. Obrigado!" });
    await db.newsletterSubscriber.create({ data: { email } });
    return NextResponse.json(done, { status: 201 });
  } catch (e) {
    if (isUniqueError(e)) return NextResponse.json({ ok: true, message: "Este e-mail já está na nossa lista. Obrigado!" });
    console.error("[api/newsletter]", e);
    return NextResponse.json({ ok: false, error: "Não conseguimos concluir agora. Tente novamente em instantes." }, { status: 500 });
  }
}
