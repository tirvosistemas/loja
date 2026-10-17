"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Banknote, CreditCard, Lock, QrCode, Smartphone } from "lucide-react";
import { PIX_METHODS, type PaymentMethodKey } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { MoneyInput } from "@/components/ui/money-input";
import { Switch } from "@/components/ui/switch";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CheckoutForm, DeliveryType, FieldErrors } from "./form";

type Option = { title: string; description: string; icon: ReactNode };

export function paymentOption(method: PaymentMethodKey, delivery: DeliveryType): Option {
  const when = delivery === "PICKUP" ? "na retirada" : "na entrega";
  switch (method) {
    case "ONLINE_STRIPE":
      return {
        title: "Pagar online agora",
        description: "Cartão de crédito, Pix ou boleto em ambiente seguro da Stripe.",
        icon: <Lock aria-hidden />,
      };
    case "PIX_MANUAL":
      return {
        title: "Pix agora",
        description: "Você recebe a chave Pix da loja e envia o comprovante no WhatsApp.",
        icon: <QrCode aria-hidden />,
      };
    case "PIX_ON_DELIVERY":
      return { title: `Pix ${when}`, description: `Pague com Pix ${when}, direto para a loja.`, icon: <Smartphone aria-hidden /> };
    case "CARD_ON_DELIVERY":
      return { title: `Cartão ${when}`, description: `Crédito ou débito na maquininha ${when}.`, icon: <CreditCard aria-hidden /> };
    case "CASH_ON_DELIVERY":
      return { title: `Dinheiro ${when}`, description: "Se precisar, levamos troco.", icon: <Banknote aria-hidden /> };
  }
}

export function PaymentOptions({
  methods,
  form,
  errors,
  onChange,
  pixDiscountPercent,
  totalCents,
}: {
  methods: PaymentMethodKey[];
  form: CheckoutForm;
  errors: FieldErrors;
  onChange: (patch: Partial<CheckoutForm>, clear?: string[]) => void;
  pixDiscountPercent: number;
  totalCents: number | null;
}) {
  if (methods.length === 0) {
    return (
      <p role="alert" className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
        Nenhuma forma de pagamento está disponível agora. Fale com a loja pelo WhatsApp para concluir sua compra.
      </p>
    );
  }
  return (
    <div>
      <fieldset id="co-payment" tabIndex={-1} className="outline-none" aria-describedby={errors.paymentMethod ? "co-payment-err" : undefined}>
        <legend className="sr-only">Forma de pagamento</legend>
        <div className="grid gap-3">
          {methods.map((m) => {
            const o = paymentOption(m, form.deliveryType);
            const checked = form.paymentMethod === m;
            const pix = PIX_METHODS.includes(m) && pixDiscountPercent > 0;
            return (
              <div key={m}>
                <label
                  className={cn(
                    "relative flex cursor-pointer items-start gap-3.5 rounded-2xl border bg-background p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40",
                    checked ? "border-primary bg-primary-soft/40" : "border-border hover:border-border-strong",
                  )}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={m}
                    checked={checked}
                    onChange={() => onChange({ paymentMethod: m }, ["paymentMethod", "changeForCents"])}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                      checked ? "border-primary" : "border-border-strong",
                    )}
                  >
                    <span className={cn("size-2.5 rounded-full bg-primary transition-transform", checked ? "scale-100" : "scale-0")} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-medium">{o.title}</span>
                      {pix && (
                        <Badge tone="success" size="sm">
                          −{pixDiscountPercent}% no Pix
                        </Badge>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">{o.description}</span>
                  </span>
                  <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-4.5", checked ? "bg-primary text-primary-foreground" : "bg-elevated text-muted-foreground")}>
                    {o.icon}
                  </span>
                </label>

                <AnimatePresence initial={false}>
                  {checked && m === "CASH_ON_DELIVERY" && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 rounded-2xl border border-border bg-elevated p-4">
                        <Switch
                          checked={form.needChange}
                          onChange={(v) => onChange({ needChange: v, changeForCents: v ? form.changeForCents : null }, ["changeForCents"])}
                          label="Precisa de troco?"
                          description={totalCents != null ? `Total do pedido: ${formatBRL(totalCents)}` : undefined}
                        />
                        {form.needChange && (
                          <div className="mt-4">
                            <label htmlFor="co-change" className="mb-1.5 block text-sm font-medium">
                              Troco para
                            </label>
                            <MoneyInput
                              id="co-change"
                              value={form.changeForCents}
                              allowEmpty
                              onChange={(cents) => onChange({ changeForCents: cents }, ["changeForCents"])}
                              aria-invalid={!!errors.changeForCents}
                            />
                            {errors.changeForCents ? (
                              <p role="alert" className="mt-1.5 text-sm text-danger">
                                {errors.changeForCents}
                              </p>
                            ) : (
                              <p className="mt-1.5 text-[13px] text-subtle">Informe a nota que você vai usar (ex.: R$ 200,00).</p>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </fieldset>
      {errors.paymentMethod && (
        <p id="co-payment-err" role="alert" className="mt-2 text-sm text-danger">
          {errors.paymentMethod}
        </p>
      )}
    </div>
  );
}
