"use client";

import type { QuoteShipping } from "@/lib/orders/quote";
import { onlyDigits } from "@/lib/utils";
import { useCart } from "@/stores/cart";

/**
 * Guarda o frete calculado e o endereço no carrinho (o checkout e a página do produto
 * reaproveitam). Só grava quando algo mudou.
 */
export function rememberShipping(s: QuoteShipping, number: string) {
  if (!s.ok || !s.available) return;
  const cart = useCart.getState();
  const cep = onlyDigits(s.address.cep);
  const prev = cart.shipping;
  if (!prev || prev.cep !== cep || prev.number !== number || prev.feeCents !== s.feeCents || prev.free !== s.free || prev.distanceKm !== s.distanceKm) {
    cart.setShipping({
      cep,
      number,
      feeCents: s.feeCents,
      free: s.free,
      distanceKm: s.distanceKm,
      etaText: s.etaText,
      quotedAt: Date.now(),
    });
  }
  const a = cart.address;
  const same = !!a && onlyDigits(a.cep) === cep;
  if (!same || a.number !== number) {
    cart.setAddress({
      cep,
      street: s.address.street || (same ? a!.street : ""),
      number,
      complement: same ? a!.complement : "",
      neighborhood: s.address.neighborhood || (same ? a!.neighborhood : ""),
      city: s.address.city || (same ? a!.city : ""),
      state: s.address.state || (same ? a!.state : "PR"),
      reference: same ? a!.reference : "",
    });
  }
}

/**
 * No celular a barra fixa do carrinho ocupa o canto onde fica o botão flutuante do
 * WhatsApp; aqui ele some até a largura em que a barra deixa de existir.
 */
export function HideWhatsAppFloatOnMobile() {
  return (
    <style>{`@media (max-width: 1023.98px){a[aria-label="Falar com a Tirvo no WhatsApp"]{display:none!important}}`}</style>
  );
}
