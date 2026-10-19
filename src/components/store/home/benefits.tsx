import { Bike, Calculator, ShieldCheck, Wallet } from "lucide-react";
import type { PublicSettings } from "@/lib/settings";
import { freeShippingSentence } from "@/lib/shipping/free";

/** Faixa com os 4 diferenciais da loja (textos complementares vêm das configurações). */
export function Benefits({ settings }: { settings: PublicSettings }) {
  const { shipping, payment } = settings;
  const methods = payment.methods;
  const onDelivery = methods.some((m) => m === "CASH_ON_DELIVERY" || m === "CARD_ON_DELIVERY" || m === "PIX_ON_DELIVERY");
  const pixDiscount = payment.pixDiscountPercent > 0 && (methods.includes("PIX_MANUAL") || methods.includes("PIX_ON_DELIVERY"));

  const items = [
    {
      icon: Bike,
      title: "Entrega por motoboy em Curitiba e RMC",
      text: shipping.etaText || "Entrega rápida direto na sua casa.",
    },
    {
      icon: Calculator,
      title: "Frete calculado na hora pelo CEP",
      text: shipping.freeShipping ? freeShippingSentence(shipping.freeShipping) : "Preço por distância, sem surpresa no final.",
    },
    {
      icon: Wallet,
      title: "Pague online, no Pix ou na entrega",
      text: [
        pixDiscount ? `${payment.pixDiscountPercent.toLocaleString("pt-BR")}% de desconto no Pix` : null,
        onDelivery ? "dinheiro, cartão ou Pix quando o produto chegar" : null,
      ]
        .filter(Boolean)
        .join(" · ")
        .replace(/^./, (c) => c.toUpperCase()) || "Escolha a forma que for melhor para você.",
    },
    {
      icon: ShieldCheck,
      title: "Garantia de fábrica e compra segura",
      text: "Produtos novos, com garantia do fabricante e dados protegidos.",
    },
  ];

  return (
    <section aria-label="Por que comprar na Tirvo" className="container-page">
      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border min-[420px]:grid-cols-2 lg:grid-cols-4">
        {items.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-start gap-3.5 bg-card p-4 sm:p-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-snug">{title}</p>
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
