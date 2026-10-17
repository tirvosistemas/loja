"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eyebrow } from "./section-header";

/** Inscrição na newsletter (POST /api/newsletter). */
export function Newsletter() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website: String(form.get("website") ?? "") }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
      if (!res.ok || !data?.ok) {
        const msg = data?.error ?? "Não conseguimos concluir agora. Tente novamente em instantes.";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success(data.message ?? "Inscrição confirmada!");
      setEmail("");
    } catch {
      const msg = "Sem conexão. Confira sua internet e tente de novo.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="news-titulo" className="container-page">
      <div className="grid items-center gap-6 rounded-3xl border border-border bg-card px-5 py-8 sm:px-10 sm:py-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <div>
          <Eyebrow className="mb-3">Newsletter</Eyebrow>
          <h2 id="news-titulo" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ofertas no seu e-mail
          </h2>
          <p className="mt-2 text-muted-foreground">Cupons exclusivos, lançamentos e ofertas relâmpago. Sem spam, e você sai quando quiser.</p>
        </div>
        <form onSubmit={onSubmit} className="relative w-full">
          <label htmlFor="news-email" className="sr-only">
            Seu e-mail
          </label>
          {/* Campo invisível contra robôs */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <Input
                id="news-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                maxLength={191}
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                leading={<Mail />}
                aria-invalid={!!error || undefined}
                aria-describedby={error ? "news-erro" : "news-dica"}
              />
            </div>
            <Button type="submit" size="md" loading={busy} className="sm:w-auto">
              Quero receber
            </Button>
          </div>
          {error ? (
            <p id="news-erro" role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          ) : (
            <p id="news-dica" className="mt-2 text-xs text-subtle">
              Ao se inscrever, você concorda com a nossa{" "}
              <Link href="/pagina/politica-de-privacidade" className="underline underline-offset-2 hover:text-foreground">
                política de privacidade
              </Link>
              .
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
