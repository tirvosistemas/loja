import { Bike, CreditCard, ShieldCheck } from "lucide-react";
import type { PaymentMethodKey } from "@/lib/constants";

// Garantias rápidas embaixo da caixa de compra (texto conforme as formas de pagamento ativas).

function joinOr(parts: string[]) {
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} ou ${parts[parts.length - 1]}` : parts[0] ?? "";
}

export function TrustRow({ warrantyMonths, methods, etaText }: { warrantyMonths: number | null; methods: PaymentMethodKey[]; etaText: string }) {
  const warranty = warrantyMonths
    ? warrantyMonths % 12 === 0
      ? `${warrantyMonths / 12} ${warrantyMonths === 12 ? "ano" : "anos"} de garantia`
      : `${warrantyMonths} ${warrantyMonths === 1 ? "mês" : "meses"} de garantia`
    : "Garantia do fabricante";

  const onDelivery = [
    methods.includes("CASH_ON_DELIVERY") && "dinheiro",
    methods.includes("CARD_ON_DELIVERY") && "maquininha",
    methods.includes("PIX_ON_DELIVERY") && "Pix",
  ].filter(Boolean) as string[];

  const pay = [
    onDelivery.length > 0 && "na entrega",
    (methods.includes("PIX_MANUAL") || methods.includes("PIX_ON_DELIVERY")) && "no Pix",
    (methods.includes("ONLINE_STRIPE") || methods.includes("CARD_ON_DELIVERY")) && "no cartão",
  ].filter(Boolean) as string[];

  const items = [
    { icon: ShieldCheck, title: warranty, text: "Assistência direto com o fabricante" },
    { icon: Bike, title: "Entrega em Curitiba e RMC", text: etaText || "Motoboy até a sua porta" },
    {
      icon: CreditCard,
      title: pay.length ? `Pague ${joinOr(pay)}` : "Pagamento facilitado",
      text: onDelivery.length
        ? `${joinOr(onDelivery).replace(/^./, (c) => c.toUpperCase())} na hora de receber`
        : "Pedido confirmado pelo WhatsApp",
    },
  ];

  return (
    <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
      {items.map((it) => (
        <li key={it.title} className="flex items-start gap-3 rounded-xl border border-border px-4 py-3">
          <it.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium leading-snug">{it.title}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-subtle">{it.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
