import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { AnimatedLogo } from "@/components/brand/animated-logo";

export const metadata: Metadata = { title: "Entrar no painel", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const { voltar } = await searchParams;
  return (
    <main className="bg-grid relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="glow-orange pointer-events-none absolute left-1/2 top-1/3 size-[42rem] -translate-x-1/2 -translate-y-1/2" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <AnimatedLogo className="h-10" />
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-subtle">Painel administrativo</p>
        </div>
        <div className="rounded-3xl border border-border bg-card/90 p-6 shadow-2xl backdrop-blur sm:p-7">
          <h1 className="text-xl font-semibold">Entrar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesse para gerenciar produtos, pedidos e configurações.</p>
          <LoginForm voltar={voltar ?? ""} />
        </div>
        <p className="mt-6 text-center text-xs text-subtle">Se algo pode ser melhorado, ainda não está pronto.</p>
      </div>
    </main>
  );
}
