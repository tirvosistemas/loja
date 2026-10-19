import { NextResponse } from "next/server";
import { z } from "zod";
import { quoteShipping } from "@/lib/shipping/quote";
import { priceCart } from "@/lib/cart";
import { cartItemSchema } from "@/lib/validators";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Cotação de frete por motoboy. Pode receber os itens do carrinho para considerar o pedido
// mínimo do frete grátis e o adicional por item.
const bodySchema = z.object({
  cep: z.string().min(8).max(9),
  number: z.string().max(20).optional(),
  street: z.string().max(160).optional(),
  neighborhood: z.string().max(120).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(2).optional(),
  items: z.array(cartItemSchema).max(100).optional(),
  freeShippingCoupon: z.boolean().optional(),
});

export async function POST(req: Request) {
  if (!rateLimit(`ship:${clientIp(req.headers)}`, 30, 60_000).ok)
    return NextResponse.json({ error: "Muitas consultas. Aguarde um pouco." }, { status: 429 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { items, ...addr } = parsed.data;
  const cart = items?.length ? await priceCart(items) : null;
  const quote = await quoteShipping({
    ...addr,
    subtotalCents: cart?.subtotalCents,
    itemCount: cart?.itemCount,
    allItemsFreeShipping: cart?.allFreeShipping,
    freeShippingCoupon: parsed.data.freeShippingCoupon,
  });
  return NextResponse.json(quote);
}
