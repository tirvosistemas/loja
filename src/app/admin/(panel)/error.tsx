"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";

/** Falha inesperada numa tela do painel: o menu continua no lugar e dá para tentar de novo. */
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";

  return (
    <EmptyState
      className="mt-6"
      icon={<AlertTriangle />}
      title="Não foi possível carregar esta tela"
      description={
        <>
          Pode ter sido uma falha de conexão ou do servidor. Tente de novo em alguns segundos.
          {digest && <span className="mt-2 block font-mono text-xs text-subtle">Código: {digest}</span>}
        </>
      }
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => retry()}>
            <RotateCcw aria-hidden /> Tentar de novo
          </Button>
          <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
            Ir para o painel
          </Link>
        </div>
      }
    />
  );
}
