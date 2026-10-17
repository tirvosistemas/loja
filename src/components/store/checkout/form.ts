import { zodFieldErrors } from "@/lib/action";
import type { PaymentMethodKey } from "@/lib/constants";
import { formatBRL } from "@/lib/format";
import { isValidCpf } from "@/lib/orders/cpf";
import { onlyDigits } from "@/lib/utils";
import { checkoutSchema, type CheckoutInput } from "@/lib/validators";

// Estado do formulário do checkout, ids dos campos e validação no navegador (a mesma
// regra do servidor, para mostrar os erros antes de enviar).

export type DeliveryType = "DELIVERY" | "PICKUP";

export type CheckoutForm = {
  name: string;
  phone: string;
  email: string;
  doc: string;
  deliveryType: DeliveryType;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  reference: string;
  paymentMethod: PaymentMethodKey | null;
  needChange: boolean;
  changeForCents: number | null;
  notes: string;
  accepted: boolean;
};

export type FieldErrors = Record<string, string>;

export const EMPTY_FORM: CheckoutForm = {
  name: "",
  phone: "",
  email: "",
  doc: "",
  deliveryType: "DELIVERY",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "PR",
  reference: "",
  paymentMethod: null,
  needChange: false,
  changeForCents: null,
  notes: "",
  accepted: false,
};

/** Chave do erro (igual à do servidor) → id do campo na página. */
export const FIELD_IDS: Record<string, string> = {
  "customer.name": "co-name",
  "customer.phone": "co-phone",
  "customer.email": "co-email",
  "customer.doc": "co-doc",
  deliveryType: "co-delivery",
  address: "co-cep",
  "address.cep": "co-cep",
  "address.street": "co-street",
  "address.number": "co-number",
  "address.complement": "co-complement",
  "address.neighborhood": "co-neighborhood",
  "address.city": "co-city",
  "address.state": "co-state",
  "address.reference": "co-reference",
  paymentMethod: "co-payment",
  changeForCents: "co-change",
  couponCode: "co-summary",
  notes: "co-notes",
  acceptedTerms: "co-terms",
};

const ORDER = Object.keys(FIELD_IDS);

/** Primeiro campo com erro, na ordem da página. */
export function firstErrorId(errors: FieldErrors) {
  const key = ORDER.find((k) => errors[k]) ?? Object.keys(errors).find((k) => FIELD_IDS[k]);
  return key ? FIELD_IDS[key] : null;
}

export type OrderPayload = CheckoutInput & { acceptedTerms: boolean; expectedTotalCents?: number };

export function buildPayload(
  f: CheckoutForm,
  items: { productId: string; variantId: string | null; quantity: number }[],
  couponCode: string,
  expectedTotalCents: number | undefined,
): OrderPayload {
  return {
    customer: { name: f.name.trim(), phone: f.phone, email: f.email.trim(), doc: onlyDigits(f.doc) },
    deliveryType: f.deliveryType,
    address:
      f.deliveryType === "DELIVERY"
        ? {
            cep: f.cep,
            street: f.street,
            number: f.number,
            complement: f.complement,
            neighborhood: f.neighborhood,
            city: f.city,
            state: f.state,
            reference: f.reference,
          }
        : undefined,
    items: items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity })),
    couponCode,
    paymentMethod: (f.paymentMethod ?? "") as PaymentMethodKey,
    changeForCents: f.paymentMethod === "CASH_ON_DELIVERY" && f.needChange ? f.changeForCents : null,
    notes: f.notes.trim(),
    acceptedTerms: f.accepted,
    expectedTotalCents,
  };
}

export function validateForm(f: CheckoutForm, payload: OrderPayload, totalCents: number | null): FieldErrors {
  const parsed = checkoutSchema.safeParse(payload);
  const errors: FieldErrors = parsed.success ? {} : zodFieldErrors(parsed.error);
  delete errors.items;
  if (errors.paymentMethod || !f.paymentMethod) errors.paymentMethod = "Escolha a forma de pagamento.";
  const doc = onlyDigits(f.doc);
  if (doc && !isValidCpf(doc)) errors["customer.doc"] = "CPF inválido. Confira os números ou deixe em branco.";
  if (f.paymentMethod === "CASH_ON_DELIVERY" && f.needChange) {
    if (!f.changeForCents) errors.changeForCents = "Informe para quanto precisa de troco.";
    else if (totalCents != null && f.changeForCents < totalCents)
      errors.changeForCents = `O troco precisa ser para um valor igual ou maior que ${formatBRL(totalCents)}.`;
  }
  if (!f.accepted) errors.acceptedTerms = "Para continuar, aceite os Termos de uso e a Política de privacidade.";
  return errors;
}
