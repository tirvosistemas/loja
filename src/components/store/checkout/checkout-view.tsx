"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, ChevronDown, Lock, ShoppingBag } from "lucide-react";
import type { PaymentMethodKey } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/switch";
import { Eyebrow } from "@/components/store/catalog/headers";
import { useMounted } from "@/components/store/layout/ui-store";
import { WhatsAppIcon } from "@/components/store/layout/social-icons";
import { CartNotices, QuoteError } from "@/components/store/cart/cart-notices";
import { FreeShippingProgress, type FreeShippingCfg } from "@/components/store/cart/summary";
import { useCartQuote, useDebouncedValue, type QuoteAddressInput } from "@/components/store/cart/use-cart-quote";
import { saveOrderCode } from "@/components/store/order/saved-orders";
import { formatBRL, formatCep, pluralize } from "@/lib/format";
import { cn, onlyDigits } from "@/lib/utils";
import { cartCount, cartSubtotal, useCart } from "@/stores/cart";
import { CustomerFields } from "./customer-fields";
import { DeliveryFields, type PickupInfo } from "./delivery-fields";
import { buildPayload, EMPTY_FORM, FIELD_IDS, firstErrorId, validateForm, type CheckoutForm, type FieldErrors } from "./form";
import { maskPhone } from "./masks";
import { CheckoutSummary } from "./order-summary";
import { PaymentOptions } from "./payment-options";
import { CheckoutSection } from "./section";

export type CheckoutConfig = {
  methods: PaymentMethodKey[];
  pixDiscountPercent: number;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  pickup: PickupInfo;
  freeShipping: FreeShippingCfg;
  hasWhatsapp: boolean;
};

type OrderResponse = {
  code?: string;
  whatsappUrl?: string | null;
  stripeUrl?: string | null;
  error?: string;
  fieldErrors?: Record<string, string>;
  issues?: string[];
};

function focusField(id: string | null) {
  if (!id) return;
  let el = document.getElementById(id);
  // Resumo escondido no celular: usa a versão recolhível do topo.
  if (el && el.offsetParent === null) el = document.getElementById(`${id}-mobile`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const target = el.matches("input, select, textarea, button, fieldset, [tabindex]") ? el : el.querySelector<HTMLElement>("input, select, textarea, button");
  (target as HTMLElement | null)?.focus({ preventScroll: true });
}

export function CheckoutView({ config }: { config: CheckoutConfig }) {
  const router = useRouter();
  const mounted = useMounted();
  const items = useCart((s) => s.items);
  const couponCode = useCart((s) => s.couponCode);
  const count = useCart(cartCount);
  const localSubtotal = useCart(cartSubtotal);

  const allowedMethods = (list: PaymentMethodKey[]) => (config.hasWhatsapp ? list : list.filter((m) => m === "ONLINE_STRIPE"));

  const [form, setForm] = useState<CheckoutForm>(() => ({
    ...EMPTY_FORM,
    deliveryType: config.deliveryEnabled || !config.pickupEnabled ? "DELIVERY" : "PICKUP",
    paymentMethod: allowedMethods(config.methods)[0] ?? null,
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [waitingQuote, setWaitingQuote] = useState(false);
  const sent = useRef(false);
  // O aviso geral veio da validação dos campos (some sozinho quando todos forem corrigidos).
  const validationBanner = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Dados usados na última compra (ficam neste aparelho).
  useEffect(() => {
    const s = useCart.getState();
    const a = s.address;
    setForm((f) => ({
      ...f,
      name: s.customer.name || f.name,
      phone: s.customer.phone ? maskPhone(s.customer.phone) : f.phone,
      email: s.customer.email || f.email,
      ...(a
        ? {
            cep: formatCep(a.cep),
            street: a.street,
            number: a.number,
            complement: a.complement,
            neighborhood: a.neighborhood,
            city: a.city,
            state: (a.state || "PR").toUpperCase(),
            reference: a.reference,
          }
        : s.shipping
          ? { cep: formatCep(s.shipping.cep), number: s.shipping.number }
          : {}),
    }));
  }, []);

  // Carrinho vazio: volta para o carrinho (menos logo depois de enviar o pedido).
  useEffect(() => {
    if (mounted && !sent.current && useCart.getState().items.length === 0) router.replace("/carrinho");
  }, [mounted, items.length, router]);

  // Endereço e telefone para a cotação, com uma pausa para não recalcular a cada tecla.
  const cepDigits = onlyDigits(form.cep);
  const addressReady = form.deliveryType === "DELIVERY" && cepDigits.length === 8 && !!form.number.trim();
  const addressKey = addressReady
    ? JSON.stringify({
        cep: cepDigits,
        number: form.number.trim(),
        street: form.street.trim() || undefined,
        neighborhood: form.neighborhood.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state || undefined,
      } satisfies QuoteAddressInput)
    : "";
  const debouncedAddressKey = useDebouncedValue(addressKey, 600);
  const phoneDigits = onlyDigits(form.phone);
  const debouncedPhone = useDebouncedValue(phoneDigits.length >= 10 ? phoneDigits : "", 600);

  const q = useCartQuote(
    {
      couponCode,
      phone: debouncedPhone || null,
      address: form.deliveryType === "DELIVERY" && debouncedAddressKey ? (JSON.parse(debouncedAddressKey) as QuoteAddressInput) : null,
      deliveryType: form.deliveryType,
      paymentMethod: form.paymentMethod,
    },
    { enabled: mounted && items.length > 0 },
  );
  const { quote } = q;
  const addressPending = addressReady && addressKey !== debouncedAddressKey;
  const loading = q.loading || addressPending;
  const shipping = form.deliveryType === "DELIVERY" && addressReady ? (quote?.shipping ?? null) : null;

  const methods = allowedMethods(quote?.paymentMethods ?? config.methods);
  const methodsKey = methods.join(",");
  useEffect(() => {
    if (form.paymentMethod && methodsKey.split(",").includes(form.paymentMethod)) return;
    const first = (methodsKey.split(",")[0] || null) as PaymentMethodKey | null;
    if (first !== form.paymentMethod) setForm((f) => ({ ...f, paymentMethod: first }));
  }, [methodsKey, form.paymentMethod]);

  const totalCents = quote?.totals.totalCents ?? null;

  const update = (patch: Partial<CheckoutForm>, clear: string[] = []) => {
    setForm((f) => ({ ...f, ...patch }));
    if (clear.length) {
      setErrors((e) => {
        if (!clear.some((k) => e[k])) return e;
        const next = { ...e };
        for (const k of clear) delete next[k];
        return next;
      });
    }
  };

  const persistCustomer = () => {
    const cart = useCart.getState();
    cart.setCustomer({ name: form.name.trim(), phone: phoneDigits, email: form.email.trim() });
    if (form.deliveryType === "DELIVERY" && cepDigits.length === 8) {
      cart.setAddress({
        cep: cepDigits,
        street: form.street.trim(),
        number: form.number.trim(),
        complement: form.complement.trim(),
        neighborhood: form.neighborhood.trim(),
        city: form.city.trim(),
        state: form.state,
        reference: form.reference.trim(),
      });
    }
  };

  // Envio pedido enquanto os valores atualizavam: envia assim que a cotação chegar.
  useEffect(() => {
    if (!waitingQuote || loading) return;
    setWaitingQuote(false);
    formRef.current?.requestSubmit();
  }, [waitingQuote, loading]);

  useEffect(() => {
    if (validationBanner.current && Object.keys(errors).length === 0) {
      validationBanner.current = false;
      setFormError(null);
    }
  }, [errors]);

  const showErrors = (errs: FieldErrors, message: string) => {
    validationBanner.current = true;
    setErrors(errs);
    setFormError(message);
    if (errs.couponCode) setSummaryOpen(true);
    setTimeout(() => focusField(firstErrorId(errs)), 30);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || sent.current) return;
    validationBanner.current = false;
    setFormError(null);
    if (loading) {
      setWaitingQuote(true);
      return;
    }

    const payload = buildPayload(form, items, couponCode, quote && !q.error ? quote.totals.totalCents : undefined);
    const errs = validateForm(form, payload, totalCents);
    if (form.deliveryType === "DELIVERY" && addressReady && shipping && (!shipping.ok || !shipping.available)) {
      errs.address = shipping.reason || "Não entregamos nesse endereço.";
    }
    if (couponCode && quote?.coupon?.code === couponCode && !quote.coupon.ok) {
      errs.couponCode = quote.coupon.error || "Este cupom não vale para este pedido. Remova ou troque o cupom.";
    }
    if (Object.keys(errs).length > 0) {
      const only = Object.keys(errs).length === 1 ? (errs.address ?? errs.couponCode) : undefined;
      showErrors(errs, only ?? "Confira os campos destacados.");
      return;
    }

    persistCustomer();
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as OrderResponse | null;

      if (res.status === 201 && data?.code) {
        sent.current = true;
        saveOrderCode(data.code);
        useCart.getState().clear();
        if (data.stripeUrl) window.location.assign(data.stripeUrl);
        else router.replace(`/pedido/${data.code}?novo=1`);
        return;
      }
      if (res.status === 409) {
        q.addNotices(data?.issues?.length ? data.issues : [data?.error || "Alguns itens do carrinho mudaram."]);
        q.refresh();
        setErrors({});
        setFormError(data?.error || "Alguns itens do carrinho mudaram. Confira antes de enviar.");
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (data?.fieldErrors && Object.keys(data.fieldErrors).length > 0) {
        const known = Object.fromEntries(Object.entries(data.fieldErrors).filter(([k]) => FIELD_IDS[k]));
        if (Object.keys(known).length > 0) {
          showErrors(known, data.error || "Confira os campos destacados.");
          return;
        }
      }
      setFormError(data?.error || "Não foi possível enviar o pedido agora. Tente de novo em instantes.");
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      setFormError("Sem conexão com a internet. Confira sua rede e tente de novo — seu carrinho continua salvo.");
    } finally {
      if (!sent.current) setSubmitting(false);
    }
  };

  if (!mounted || items.length === 0) return <CheckoutSkeleton />;

  const isStripe = form.paymentMethod === "ONLINE_STRIPE";
  const done = {
    customer: form.name.trim().length >= 3 && (phoneDigits.length === 10 || phoneDigits.length === 11),
    delivery:
      form.deliveryType === "PICKUP" ||
      (!!shipping?.ok && !!shipping.available && !!form.street.trim() && !!form.neighborhood.trim() && !!form.city.trim()),
    payment:
      !!form.paymentMethod &&
      (form.paymentMethod !== "CASH_ON_DELIVERY" || !form.needChange || (!!form.changeForCents && (totalCents == null || form.changeForCents >= totalCents))),
    notes: form.accepted,
  };
  const itemCount = quote?.itemCount ?? count;
  const shownTotal = totalCents ?? localSubtotal;
  const totalHint = form.deliveryType === "DELIVERY" && !(shipping?.ok && shipping.available) ? "sem o frete" : null;

  const submitButton = (block = true, size: "lg" | "xl" = "xl") => (
    <Button
      type="submit"
      form="checkout-form"
      variant={isStripe ? "primary" : "whatsapp"}
      size={size}
      block={block}
      loading={submitting || waitingQuote}
      disabled={!form.paymentMethod || methods.length === 0}
      className="shrink-0"
    >
      {!submitting && !waitingQuote && (isStripe ? <Lock aria-hidden /> : <WhatsAppIcon aria-hidden />)}
      {submitting ? (
        "Enviando…"
      ) : waitingQuote ? (
        "Atualizando…"
      ) : (
        <>
          <span className={cn(!block && "max-sm:hidden")}>{isStripe ? "Ir para o pagamento seguro" : "Enviar pedido pelo WhatsApp"}</span>
          {!block && <span className="sm:hidden">{isStripe ? "Pagar agora" : "Enviar pedido"}</span>}
        </>
      )}
    </Button>
  );

  const summaryProps = {
    items,
    quote,
    loading,
    deliveryType: form.deliveryType,
    fallbackSubtotalCents: localSubtotal,
    itemCount,
    couponError: errors.couponCode,
  };

  return (
    <form ref={formRef} id="checkout-form" onSubmit={submit} noValidate className="mt-6 sm:mt-8">
      <div ref={topRef} className="scroll-mt-28" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-10">
        <div className="min-w-0 space-y-5">
          {/* Resumo recolhível no celular */}
          <div className="rounded-2xl border border-border bg-card lg:hidden">
            <button
              type="button"
              onClick={() => setSummaryOpen((v) => !v)}
              aria-expanded={summaryOpen}
              aria-controls="co-summary-mobile"
              className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium">
                <ShoppingBag className="size-4.5 shrink-0 text-primary" aria-hidden />
                <span className="truncate">
                  {summaryOpen ? "Esconder resumo" : "Resumo do pedido"}
                  <span className="text-subtle"> · {pluralize(itemCount, "item", "itens")}</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular text-[15px] font-semibold">{formatBRL(shownTotal)}</span>
                <ChevronDown className={cn("size-4 text-subtle transition-transform", summaryOpen && "rotate-180")} aria-hidden />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {summaryOpen && (
                <motion.div
                  id="co-summary-mobile"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border px-4 pb-5 pt-4">
                    <CheckoutSummary {...summaryProps} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <CartNotices notices={q.notices} onDismiss={q.dismissNotices} />
          {q.error && <QuoteError message={q.error} onRetry={q.refresh} />}
          {formError && (
            <div role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3.5 text-sm">
              <AlertCircle className="mt-0.5 size-4.5 shrink-0 text-danger" aria-hidden />
              <p className="font-medium">{formError}</p>
            </div>
          )}

          <CheckoutSection id="dados" step={1} title="Seus dados" description="Usamos só para confirmar e entregar o seu pedido." done={done.customer}>
            <CustomerFields form={form} errors={errors} onChange={update} />
          </CheckoutSection>

          <CheckoutSection
            id="entrega"
            step={2}
            title="Entrega"
            description={config.deliveryEnabled ? "Motoboy para Curitiba e região metropolitana." : "Retirada na loja."}
            done={done.delivery}
          >
            {config.deliveryEnabled && form.deliveryType === "DELIVERY" && (
              <FreeShippingProgress cfg={config.freeShipping} quote={shipping ? quote : null} subtotalCents={quote?.totals.subtotalCents ?? localSubtotal} className="mb-5" />
            )}
            {!config.deliveryEnabled && !config.pickupEnabled ? (
              <p role="alert" className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
                As entregas estão pausadas no momento. Fale com a loja pelo WhatsApp para combinar o seu pedido.
              </p>
            ) : (
              <DeliveryFields
                form={form}
                errors={errors}
                onChange={update}
                options={{ delivery: config.deliveryEnabled, pickup: config.pickupEnabled }}
                pickup={config.pickup}
                shipping={shipping}
                quoting={loading || (addressReady && !quote?.shipping && !q.error)}
                addressReady={addressReady}
              />
            )}
          </CheckoutSection>

          <CheckoutSection id="pagamento" step={3} title="Pagamento" description="Escolha como prefere pagar." done={done.payment}>
            {!config.hasWhatsapp && methods.length > 0 && (
              <p className="mb-4 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-sm">
                No momento, os pedidos pelo site são concluídos só com pagamento online.
              </p>
            )}
            <PaymentOptions
              methods={methods}
              form={form}
              errors={errors}
              onChange={update}
              pixDiscountPercent={quote?.pixDiscountPercent ?? config.pixDiscountPercent}
              totalCents={totalCents}
            />
          </CheckoutSection>

          <CheckoutSection id="observacoes" step={4} title="Observações e confirmação" done={done.notes}>
            <label htmlFor="co-notes" className="mb-1.5 block text-sm font-medium">
              Observações <span className="font-normal text-subtle">(opcional)</span>
            </label>
            <Textarea
              id="co-notes"
              rows={3}
              maxLength={600}
              value={form.notes}
              onChange={(e) => update({ notes: e.target.value }, ["notes"])}
              placeholder="Ex.: melhor horário para entrega, interfone, dúvidas sobre o produto…"
              aria-invalid={!!errors.notes || undefined}
            />
            <p className="mt-1 text-right font-mono text-[11px] text-subtle tabular">{form.notes.length}/600</p>
            {errors.notes && (
              <p role="alert" className="text-sm text-danger">
                {errors.notes}
              </p>
            )}

            <div id="co-terms" tabIndex={-1} className={cn("mt-4 rounded-xl border px-4 py-3 outline-none", errors.acceptedTerms ? "border-danger/40 bg-danger-soft" : "border-border")}>
              <Checkbox
                checked={form.accepted}
                onChange={(v) => update({ accepted: v }, ["acceptedTerms"])}
                className="items-start [&>input]:mt-0.5"
                label={
                  <span className="leading-relaxed">
                    Li e concordo com os{" "}
                    <Link href="/pagina/termos-de-uso" target="_blank" className="font-medium text-primary underline-offset-4 hover:underline">
                      Termos de uso
                    </Link>{" "}
                    e a{" "}
                    <Link href="/pagina/politica-de-privacidade" target="_blank" className="font-medium text-primary underline-offset-4 hover:underline">
                      Política de privacidade
                    </Link>
                    .<span className="ml-0.5 text-primary">*</span>
                  </span>
                }
              />
            </div>
            {errors.acceptedTerms && (
              <p role="alert" className="mt-1.5 text-sm text-danger">
                {errors.acceptedTerms}
              </p>
            )}
          </CheckoutSection>
        </div>

        {/* Resumo fixo na lateral (computador) */}
        <aside aria-labelledby="co-summary-title" className="hidden min-w-0 lg:sticky lg:top-24 lg:block lg:self-start">
          <div id="co-summary" className="rounded-2xl border border-border bg-card p-6">
            <Eyebrow>Resumo</Eyebrow>
            <h2 id="co-summary-title" className="mt-2 text-lg font-semibold">
              Seu pedido
            </h2>
            <div className="mt-5">
              <CheckoutSummary {...summaryProps} />
            </div>
            <div className="mt-6">{submitButton()}</div>
            <SubmitNote stripe={isStripe} />
          </div>
        </aside>
      </div>

      {/* Barra de envio fixa no celular */}
      <div aria-hidden className="h-28 lg:hidden" />
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 shadow-[0_-12px_32px_-16px_rgb(0_0_0/0.5)] backdrop-blur-md lg:hidden">
        <div className="container-page flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Total{totalHint ? ` ${totalHint}` : ""}</p>
            <p className="tabular truncate text-lg font-semibold leading-tight">{formatBRL(shownTotal)}</p>
          </div>
          <div className="shrink-0 [&_button]:px-4 sm:[&_button]:px-6">{submitButton(false, "lg")}</div>
        </div>
      </div>
    </form>
  );
}

function SubmitNote({ stripe }: { stripe: boolean }) {
  return (
    <p className="mt-3 text-center text-[13px] leading-relaxed text-subtle">
      {stripe
        ? "Você vai para a página segura da Stripe e, depois do pagamento, volta para acompanhar o pedido."
        : "Seu pedido fica registrado e a mensagem pronta abre no WhatsApp da loja para confirmarmos."}
    </p>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="mt-6 grid gap-6 sm:mt-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8 xl:gap-10" aria-busy="true" aria-label="Carregando checkout">
      <div className="space-y-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="hidden h-[28rem] rounded-2xl lg:block" />
    </div>
  );
}
