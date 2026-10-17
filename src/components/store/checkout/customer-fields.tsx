"use client";

import { Field, Input } from "@/components/ui/input";
import type { CheckoutForm, FieldErrors } from "./form";
import { maskCpf, maskPhone } from "./masks";

export function CustomerFields({
  form,
  errors,
  onChange,
}: {
  form: CheckoutForm;
  errors: FieldErrors;
  onChange: (patch: Partial<CheckoutForm>, clear?: string[]) => void;
}) {
  const err = (k: string) => errors[k];
  const described = (k: string, id: string) => (errors[k] ? `${id}-err` : `${id}-hint`);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Nome completo"
        htmlFor="co-name"
        required
        error={err("customer.name") && <span id="co-name-err">{err("customer.name")}</span>}
        className="sm:col-span-2"
      >
        <Input
          id="co-name"
          name="name"
          autoComplete="name"
          autoCapitalize="words"
          maxLength={120}
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value }, ["customer.name"])}
          aria-invalid={!!err("customer.name") || undefined}
          aria-describedby={err("customer.name") ? "co-name-err" : undefined}
          aria-required
        />
      </Field>
      <Field
        label="WhatsApp"
        htmlFor="co-phone"
        required
        hint={<span id="co-phone-hint">É por ele que confirmamos o pedido e a entrega.</span>}
        error={err("customer.phone") && <span id="co-phone-err">{err("customer.phone")}</span>}
      >
        <Input
          id="co-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(41) 99999-9999"
          maxLength={16}
          value={form.phone}
          onChange={(e) => onChange({ phone: maskPhone(e.target.value) }, ["customer.phone"])}
          aria-invalid={!!err("customer.phone") || undefined}
          aria-describedby={described("customer.phone", "co-phone")}
          aria-required
          className="tabular"
        />
      </Field>
      <Field
        label="E-mail (opcional)"
        htmlFor="co-email"
        hint={<span id="co-email-hint">Para receber o comprovante do pagamento online.</span>}
        error={err("customer.email") && <span id="co-email-err">{err("customer.email")}</span>}
      >
        <Input
          id="co-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={160}
          value={form.email}
          onChange={(e) => onChange({ email: e.target.value }, ["customer.email"])}
          aria-invalid={!!err("customer.email") || undefined}
          aria-describedby={described("customer.email", "co-email")}
        />
      </Field>
      <Field
        label="CPF (opcional)"
        htmlFor="co-doc"
        hint={<span id="co-doc-hint">Informe se quiser o CPF na nota fiscal.</span>}
        error={err("customer.doc") && <span id="co-doc-err">{err("customer.doc")}</span>}
      >
        <Input
          id="co-doc"
          name="doc"
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          maxLength={14}
          value={form.doc}
          onChange={(e) => onChange({ doc: maskCpf(e.target.value) }, ["customer.doc"])}
          aria-invalid={!!err("customer.doc") || undefined}
          aria-describedby={described("customer.doc", "co-doc")}
          className="tabular"
        />
      </Field>
    </div>
  );
}
