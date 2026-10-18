"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { changeOwnPasswordAction, updateOwnNameAction } from "@/app/admin/(panel)/usuarios/actions";

export function OwnNameForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          let r: Awaited<ReturnType<typeof updateOwnNameAction>>;
          try {
            r = await updateOwnNameAction({ name });
          } catch {
            toast.error("Falha de conexão. Tente de novo.");
            return;
          }
          if (!r.ok) {
            setError(r.fieldErrors?.name ?? r.error);
            toast.error(r.error);
            return;
          }
          setError(undefined);
          setSaved(name.trim());
          toast.success(r.message ?? "Nome atualizado.");
          router.refresh();
        });
      }}
    >
      <Field label="Seu nome" htmlFor="me-name" required error={error}>
        <Input id="me-name" value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} aria-invalid={!!error} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant={name.trim() !== saved ? "primary" : "secondary"} disabled={name.trim() === saved} loading={pending}>
          Salvar nome
        </Button>
      </div>
    </form>
  );
}

export function OwnPasswordForm({ email }: { email: string }) {
  const [v, setV] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();
  const type = show ? "text" : "password";
  const strength = v.next.length === 0 ? null : v.next.length < 8 ? "curta" : /[A-Za-z]/.test(v.next) && /\d/.test(v.next) && v.next.length >= 10 ? "forte" : "ok";

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          let r: Awaited<ReturnType<typeof changeOwnPasswordAction>>;
          try {
            r = await changeOwnPasswordAction(v);
          } catch {
            toast.error("Falha de conexão. Tente de novo.");
            return;
          }
          if (!r.ok) {
            setErrors(r.fieldErrors ?? {});
            toast.error(r.error);
            return;
          }
          setErrors({});
          setV({ current: "", next: "", confirm: "" });
          toast.success(r.message ?? "Senha alterada.");
        });
      }}
    >
      {/* Ajuda o gerenciador de senhas do navegador a associar a conta. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <Field label="Senha atual" htmlFor="me-current" required error={errors.current}>
        <Input id="me-current" type={type} autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} aria-invalid={!!errors.current} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nova senha"
          htmlFor="me-next"
          required
          error={errors.next}
          hint={strength === "curta" ? "Use pelo menos 8 caracteres." : strength === "forte" ? "Boa senha." : "Misture letras e números, com 10 ou mais caracteres."}
        >
          <Input id="me-next" type={type} autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} aria-invalid={!!errors.next} />
        </Field>
        <Field label="Repita a nova senha" htmlFor="me-confirm" required error={errors.confirm}>
          <Input id="me-confirm" type={type} autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} aria-invalid={!!errors.confirm} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setShow((s) => !s)} className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          {show ? "Ocultar senhas" : "Mostrar senhas"}
        </button>
        <Button type="submit" loading={pending} disabled={!v.current || !v.next || !v.confirm}>
          Alterar senha
        </Button>
      </div>
    </form>
  );
}
