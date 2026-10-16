"use client";

import { useActionState } from "react";
import { Lock, Mail } from "lucide-react";
import { loginAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function LoginForm({ voltar }: { voltar: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="voltar" value={voltar} />
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required leading={<Mail />} placeholder="voce@tirvo.com.br" />
      </Field>
      <Field label="Senha" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required leading={<Lock />} placeholder="••••••••" />
      </Field>
      {state?.error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" block loading={pending}>
        Entrar
      </Button>
    </form>
  );
}
