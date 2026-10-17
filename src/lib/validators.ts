import { z } from "zod";
import { onlyDigits } from "./utils";

// Validações compartilhadas entre formulários (cliente) e APIs (servidor).

export const phoneSchema = z
  .string()
  .transform(onlyDigits)
  .transform((d) => (d.length === 13 && d.startsWith("55") ? d.slice(2) : d))
  .refine((d) => d.length === 10 || d.length === 11, "Informe o WhatsApp com DDD.");

export const cepSchema = z
  .string()
  .transform(onlyDigits)
  .refine((d) => d.length === 8, "CEP deve ter 8 números.");

/**
 * Endereço de um serviço de push (FCM, Mozilla, Apple, Windows…): só https em domínio público.
 * O servidor faz POST nesse endereço a cada campanha, então nada de IP, localhost ou nome da rede interna.
 */
export function isPushEndpoint(value: string) {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase();
    return (
      u.protocol === "https:" &&
      u.port === "" &&
      !u.username &&
      !u.password &&
      host.includes(".") &&
      !/^[\d.]+$/.test(host) && // IPv4 (o URL já normaliza 0x7f.1, 2130706433…)
      !host.startsWith("[") && // IPv6
      !/(^|\.)(localhost|local|internal|lan|home|localdomain)\.?$/.test(host)
    );
  } catch {
    return false;
  }
}

export const cartItemSchema = z.object({
  productId: z.string().min(1).max(40),
  variantId: z.string().max(40).nullish(),
  quantity: z.number().int().min(1).max(99),
});

export const addressSchema = z.object({
  cep: cepSchema,
  street: z.string().trim().min(2, "Informe a rua.").max(160),
  number: z.string().trim().min(1, "Informe o número.").max(20),
  complement: z.string().trim().max(120).optional().default(""),
  neighborhood: z.string().trim().min(2, "Informe o bairro.").max(120),
  city: z.string().trim().min(2, "Informe a cidade.").max(120),
  state: z.string().trim().length(2, "UF com 2 letras.").transform((s) => s.toUpperCase()),
  reference: z.string().trim().max(160).optional().default(""),
});

export const paymentMethodSchema = z.enum(["ONLINE_STRIPE", "PIX_MANUAL", "PIX_ON_DELIVERY", "CARD_ON_DELIVERY", "CASH_ON_DELIVERY"]);

export const checkoutSchema = z
  .object({
    customer: z.object({
      name: z.string().trim().min(3, "Informe seu nome completo.").max(120),
      phone: phoneSchema,
      email: z.string().trim().email("E-mail inválido.").max(160).optional().or(z.literal("")),
      doc: z.string().trim().max(20).optional().default(""),
    }),
    deliveryType: z.enum(["DELIVERY", "PICKUP"]),
    address: addressSchema.optional(),
    items: z.array(cartItemSchema).min(1, "Seu carrinho está vazio.").max(100),
    couponCode: z.string().trim().max(40).optional().default(""),
    paymentMethod: paymentMethodSchema,
    changeForCents: z.number().int().min(0).max(10_000_000).nullish(),
    notes: z.string().trim().max(600).optional().default(""),
  })
  .refine((v) => v.deliveryType === "PICKUP" || !!v.address, { message: "Informe o endereço de entrega.", path: ["address"] });

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;
