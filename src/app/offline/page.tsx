import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export const metadata = { title: "Sem conexão" };

export default function OfflinePage() {
  return (
    <main className="bg-grid flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo className="h-8" />
      <div className="grid size-14 place-items-center rounded-2xl bg-elevated text-primary">
        <WifiOff className="size-7" />
      </div>
      <div className="max-w-sm">
        <h1 className="text-2xl font-semibold">Você está sem internet</h1>
        <p className="mt-2 text-muted-foreground">Seu carrinho continua salvo. Assim que a conexão voltar, é só continuar de onde parou.</p>
      </div>
      <Link href="/" className="rounded-xl bg-primary px-5 py-3 font-medium text-primary-foreground">
        Tentar de novo
      </Link>
    </main>
  );
}
