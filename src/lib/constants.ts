// Rótulos em português usados na loja, no painel e na mensagem do WhatsApp.

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

export const PAYMENT_METHOD_LABEL = {
  ONLINE_STRIPE: "Pagamento online (cartão, Pix ou boleto)",
  PIX_MANUAL: "Pix agora (chave da loja)",
  PIX_ON_DELIVERY: "Pix na entrega",
  CARD_ON_DELIVERY: "Cartão na entrega (maquininha)",
  CASH_ON_DELIVERY: "Dinheiro na entrega",
} as const;

export const PAYMENT_METHOD_SHORT = {
  ONLINE_STRIPE: "Online (Stripe)",
  PIX_MANUAL: "Pix",
  PIX_ON_DELIVERY: "Pix na entrega",
  CARD_ON_DELIVERY: "Cartão na entrega",
  CASH_ON_DELIVERY: "Dinheiro na entrega",
} as const;

export type PaymentMethodKey = keyof typeof PAYMENT_METHOD_LABEL;

/** Métodos que recebem o desconto do Pix. */
export const PIX_METHODS: PaymentMethodKey[] = ["PIX_MANUAL", "PIX_ON_DELIVERY"];
export const ON_DELIVERY_METHODS: PaymentMethodKey[] = ["PIX_ON_DELIVERY", "CARD_ON_DELIVERY", "CASH_ON_DELIVERY"];

export const PAYMENT_STATUS_LABEL: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Aguardando pagamento", tone: "warning" },
  PAID: { label: "Pago", tone: "success" },
  FAILED: { label: "Falhou", tone: "danger" },
  EXPIRED: { label: "Expirado", tone: "neutral" },
  REFUNDED: { label: "Reembolsado", tone: "info" },
};

export const ORDER_STATUS_LABEL: Record<string, { label: string; tone: Tone }> = {
  NEW: { label: "Novo", tone: "accent" },
  CONFIRMED: { label: "Confirmado", tone: "info" },
  PREPARING: { label: "Em separação", tone: "info" },
  OUT_FOR_DELIVERY: { label: "Saiu para entrega", tone: "warning" },
  READY_FOR_PICKUP: { label: "Pronto para retirada", tone: "warning" },
  DELIVERED: { label: "Entregue", tone: "success" },
  CANCELED: { label: "Cancelado", tone: "danger" },
};

/** Ordem do fluxo, para a linha do tempo do pedido. */
export const ORDER_FLOW_DELIVERY = ["NEW", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
export const ORDER_FLOW_PICKUP = ["NEW", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "DELIVERED"] as const;

export const VOLTAGE_LABEL: Record<string, string> = {
  V110: "110V",
  V220: "220V",
  BIVOLT: "Bivolt",
  NA: "Não se aplica",
};

export const DELIVERY_TYPE_LABEL = { DELIVERY: "Entrega por motoboy", PICKUP: "Retirar na loja" } as const;

export const SORT_OPTIONS = [
  { value: "relevance", label: "Mais relevantes" },
  { value: "best-sellers", label: "Mais vendidos" },
  { value: "price-asc", label: "Menor preço" },
  { value: "price-desc", label: "Maior preço" },
  { value: "newest", label: "Lançamentos" },
  { value: "discount", label: "Maior desconto" },
] as const;

export type SortValue = (typeof SORT_OPTIONS)[number]["value"];
