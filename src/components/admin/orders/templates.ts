import { ON_DELIVERY_METHODS, PAYMENT_METHOD_SHORT, type PaymentMethodKey } from "@/lib/constants";
import { formatBRL } from "@/lib/format";

// Mensagens prontas para falar com o cliente pelo WhatsApp a partir do pedido.

export type CustomerTemplateKey = "confirmacao" | "pix" | "saiu" | "retirada" | "entregue";
export type CustomerTemplate = { key: CustomerTemplateKey; label: string; text: string };

export type TemplateOrder = {
  code: string;
  customerName: string;
  status: string;
  deliveryType: "DELIVERY" | "PICKUP";
  paymentMethod: PaymentMethodKey;
  paymentStatus: string;
  totalCents: number;
  changeForCents: number | null;
};

export type TemplateContext = {
  storeName: string;
  trackUrl: string;
  pickupAddress?: string | null;
  businessHours?: string | null;
  pickupInstructions?: string | null;
  pixKey?: string | null;
  pixHolder?: string | null;
};

export function firstName(full: string) {
  const first = full.trim().split(/\s+/)[0] ?? "";
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : "";
}

function lines(...parts: (string | false | null | undefined)[]) {
  return parts
    .filter((p): p is string => typeof p === "string")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function customerTemplates(o: TemplateOrder, ctx: TemplateContext): CustomerTemplate[] {
  const name = firstName(o.customerName);
  const hi = name ? `Olá, ${name}!` : "Olá!";
  const code = `#${o.code}`;
  const total = formatBRL(o.totalCents);
  const payOnDelivery = ON_DELIVERY_METHODS.includes(o.paymentMethod) && o.paymentStatus !== "PAID";
  const changeLine =
    o.paymentMethod === "CASH_ON_DELIVERY" && o.changeForCents && o.changeForCents > o.totalCents
      ? `Levaremos troco para ${formatBRL(o.changeForCents)}.`
      : null;
  const isPickup = o.deliveryType === "PICKUP";

  const list: CustomerTemplate[] = [
    {
      key: "confirmacao",
      label: "Confirmação do pedido",
      text: lines(
        `${hi} Aqui é da ${ctx.storeName}.`,
        "",
        `Seu pedido ${code} está confirmado. ✅`,
        `Total: ${total} · ${PAYMENT_METHOD_SHORT[o.paymentMethod]}`,
        "",
        isPickup ? "Vamos separar tudo e avisamos assim que estiver pronto para retirada." : "Vamos separar tudo e avisamos assim que sair para entrega.",
        "",
        `Acompanhe o pedido: ${ctx.trackUrl}`,
      ),
    },
  ];

  if (o.paymentMethod === "PIX_MANUAL" && o.paymentStatus !== "PAID" && ctx.pixKey) {
    list.push({
      key: "pix",
      label: "Lembrete do Pix",
      text: lines(
        `${hi} Aqui é da ${ctx.storeName}.`,
        "",
        `Para confirmar o pedido ${code}, faça o Pix de ${total} para a chave:`,
        ctx.pixKey,
        ctx.pixHolder ? `Titular: ${ctx.pixHolder}` : null,
        "",
        "Depois é só enviar o comprovante por aqui. Obrigado!",
      ),
    });
  }

  if (!isPickup) {
    list.push({
      key: "saiu",
      label: "Saiu para entrega",
      text: lines(
        `${hi} Seu pedido ${code} saiu para entrega com o nosso motoboy. 🛵`,
        "",
        payOnDelivery ? `Valor a pagar na entrega: ${total} (${PAYMENT_METHOD_SHORT[o.paymentMethod]}).` : null,
        changeLine,
        "Qualquer dúvida, é só responder esta mensagem.",
      ),
    });
  } else {
    list.push({
      key: "retirada",
      label: "Pronto para retirada",
      text: lines(
        `${hi} Seu pedido ${code} está pronto para retirada na ${ctx.storeName}. 🏬`,
        "",
        ctx.pickupAddress ? `Endereço: ${ctx.pickupAddress}` : null,
        ctx.businessHours ? `Horário: ${ctx.businessHours}` : null,
        ctx.pickupInstructions || "Leve o número do pedido.",
        payOnDelivery ? `Pagamento na retirada: ${total} (${PAYMENT_METHOD_SHORT[o.paymentMethod]}).` : null,
      ),
    });
  }

  list.push({
    key: "entregue",
    label: isPickup ? "Retirado / obrigado" : "Entregue / obrigado",
    text: lines(
      `${hi} ${isPickup ? `Seu pedido ${code} foi retirado.` : `Seu pedido ${code} foi entregue.`} Obrigado por comprar na ${ctx.storeName}! 🧡`,
      "",
      "Se precisar de qualquer coisa, é só chamar por aqui.",
    ),
  });

  return list;
}

/** Mensagem sugerida conforme o status atual do pedido. */
export function defaultTemplateKey(o: TemplateOrder): CustomerTemplateKey {
  if (o.status === "DELIVERED") return "entregue";
  if (o.status === "OUT_FOR_DELIVERY") return "saiu";
  if (o.status === "READY_FOR_PICKUP") return "retirada";
  if (o.paymentMethod === "PIX_MANUAL" && o.paymentStatus !== "PAID") return "pix";
  return "confirmacao";
}

/** Qual mensagem combina com cada mudança de status (para o atalho “Avisar cliente”). */
export const TEMPLATE_FOR_STATUS: Partial<Record<string, CustomerTemplateKey>> = {
  CONFIRMED: "confirmacao",
  OUT_FOR_DELIVERY: "saiu",
  READY_FOR_PICKUP: "retirada",
  DELIVERED: "entregue",
};
