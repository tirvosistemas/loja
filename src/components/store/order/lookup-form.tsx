"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Hash, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { maskPhone } from "@/components/store/checkout/masks";
import { useCart } from "@/stores/cart";
import { onlyDigits } from "@/lib/utils";

// Busca de pedido por código + WhatsApp usado na compra.

export function LookupForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ code?: string; phone?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // WhatsApp da última compra neste aparelho.
  useEffect(() => {
    const saved = useCart.getState().customer.phone;
    if (saved) setPhone((p) => p || maskPhone(saved));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.replace(/[^a-z0-9]/gi, "").toUpperCase();
    const digits = onlyDigits(phone);
    const errs: typeof errors = {};
    if (c.length < 4) errs.code = "Informe o código do pedido (ex.: TV7K2Q9).";
    if (digits.length < 10 || digits.length > 11) errs.phone = "Informe o WhatsApp com DDD.";
    setErrors(errs);
    setError(null);
    if (errs.code || errs.phone) {
      document.getElementById(errs.code ? "lk-code" : "lk-phone")?.focus();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c, phone: digits }),
      });
      const data = (await res.json().catch(() => null)) as { code?: string; error?: string; fieldErrors?: Record<string, string> } | null;
      if (res.ok && data?.code) {
        router.push(`/pedido/${data.code}`);
        return;
      }
      if (data?.fieldErrors) setErrors({ code: data.fieldErrors.code, phone: data.fieldErrors.phone });
      setError(data?.error || "Pedido não encontrado.");
    } catch {
      setError("Sem conexão. Confira sua internet e tente de novo.");
    }
    setLoading(false);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field
        label="Código do pedido"
        htmlFor="lk-code"
        hint="Está na mensagem do WhatsApp e no e-mail do pagamento."
        error={errors.code}
      >
        <Input
          id="lk-code"
          leading={<Hash aria-hidden />}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="TV7K2Q9"
          maxLength={16}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9#]/g, ""));
            setErrors((x) => ({ ...x, code: undefined }));
          }}
          aria-invalid={!!errors.code || undefined}
          className="font-mono uppercase tracking-wider placeholder:font-sans placeholder:normal-case"
        />
      </Field>
      <Field label="WhatsApp usado na compra" htmlFor="lk-phone" error={errors.phone}>
        <Input
          id="lk-phone"
          leading={<Phone aria-hidden />}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(41) 99999-9999"
          maxLength={16}
          value={phone}
          onChange={(e) => {
            setPhone(maskPhone(e.target.value));
            setErrors((x) => ({ ...x, phone: undefined }));
          }}
          aria-invalid={!!errors.phone || undefined}
          className="tabular"
        />
      </Field>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" block loading={loading}>
        Ver meu pedido {!loading && <ArrowRight aria-hidden />}
      </Button>
    </form>
  );
}
