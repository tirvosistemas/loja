"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { NextMascot } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";

/** Erro inesperado dentro da loja: mantém cabeçalho e rodapé e oferece tentar de novo. */
export default function StoreError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";

  return (
    <section className="container-page flex flex-col items-center py-16 text-center md:py-24" aria-labelledby="erro-titulo">
      <NextMascot className="h-40 sm:h-48" />
      <p className="mt-8 font-mono text-xs uppercase tracking-[0.16em] text-subtle">Algo saiu do eixo</p>
      <h1 id="erro-titulo" className="mt-2 text-2xl font-semibold sm:text-3xl">
        Não conseguimos carregar esta página
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Pode ter sido uma instabilidade rápida. Tente de novo; se continuar, fale com a gente pelo WhatsApp.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={() => retry()}>
          <RotateCcw aria-hidden /> Tentar de novo
        </Button>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Voltar para o início
        </Link>
      </div>
      {digest && <p className="mt-6 font-mono text-[11px] text-subtle">Código do erro: {digest}</p>}
    </section>
  );
}
