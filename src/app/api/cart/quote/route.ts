import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettings } from "@/lib/settings";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { cartItemSchema, paymentMethodSchema, phoneSchema } from "@/lib/validators";
import { quoteCart, toQuoteResponse } from "@/lib/orders/quote";

// Cotação do carrinho: reprecifica os itens, aplica o cupom, calcula o frete e os totais.
const bodySchema = z.object({
  items: z.array(cartItemSchema).max(100),
  couponCode: z.string().trim().max(40).nullish(),
  phone: z.string().max(30).nullish(),
  address: z
    .object({
      cep: z.string().max(9),
      number: z.string().max(20).optional(),
      street: z.string().max(160).optional(),
      neighborhood: z.string().max(120).optional(),
      city: z.string().max(120).optional(),
      state: z.string().max(2).optional(),
    })
    .nullish(),
  deliveryType: z.enum(["DELIVERY", "PICKUP"]).optional(),
  paymentMethod: paymentMethodSchema.nullish(),
});

export async function POST(req: Request) {
  const limit = rateLimit(`cart-quote:${clientIp(req.headers)}`, 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Muitas atualizações seguidas. Aguarde alguns segundos." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados do carrinho inválidos." }, { status: 400 });

  const phone = parsed.data.phone ? phoneSchema.safeParse(parsed.data.phone) : null;
  const input = {
    items: parsed.data.items,
    couponCode: parsed.data.couponCode ?? null,
    phone: phone?.success ? phone.data : null,
    address: parsed.data.address ?? null,
    deliveryType: parsed.data.deliveryType,
    paymentMethod: parsed.data.paymentMethod ?? null,
  };

  try {
    const settings = await getSettings();
    const quote = await quoteCart(input, settings);
    return NextResponse.json(toQuoteResponse(quote, settings), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[carrinho] falha na cotação:", e);
    return NextResponse.json({ error: "Não foi possível atualizar o carrinho agora." }, { status: 500 });
  }
}
