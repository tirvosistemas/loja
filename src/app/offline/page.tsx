import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "Sem conexão", robots: { index: false } };

export default function OfflinePage() {
  return (
    <main className="bg-grid flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo className="h-8" />
      <div className="grid size-14 place-items-center rounded-2xl bg-elevated text-primary">
        <WifiOff className="size-7" aria-hidden />
      </div>
      <div className="max-w-sm">
        <h1 className="text-2xl font-semibold">Você está sem internet</h1>
        <p className="mt-2 text-muted-foreground">Seu carrinho continua salvo. Assim que a conexão voltar, é só continuar de onde parou.</p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <RetryButton />
        <Link href="/" className="inline-flex h-10 items-center px-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Ir para o início
        </Link>
      </div>
    </main>
  );
}
