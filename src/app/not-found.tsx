import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Logo, NextMascot } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Página não encontrada" };

/** 404 da marca. Fica fora do layout da loja, então tem um topo simples próprio. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" aria-label="Tirvo — página inicial" className="flex h-10 items-center text-foreground">
            <Logo className="h-7" title="Tirvo" />
          </Link>
          <Link href="/ofertas" className="flex h-10 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            <span aria-hidden className="size-2 rounded-full bg-primary animate-pulse-dot" /> Ofertas
          </Link>
        </div>
      </header>

      <main id="conteudo" className="bg-grid flex flex-1 items-center">
        <div className="container-page flex flex-col items-center py-14 text-center">
          <NextMascot className="h-44 sm:h-56" />
          <p className="mt-8 font-mono text-xs uppercase tracking-[0.16em] text-subtle">Erro 404 · fora da mira</p>
          <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Página não encontrada</h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            O endereço pode ter mudado ou o produto saiu do catálogo. Busque o que você precisa:
          </p>

          <form action="/busca" method="get" role="search" className="mt-7 w-full max-w-md">
            <label htmlFor="busca-404" className="sr-only">
              Buscar produtos
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-subtle" />
                <input
                  id="busca-404"
                  name="q"
                  type="search"
                  required
                  minLength={2}
                  maxLength={80}
                  enterKeyHint="search"
                  placeholder="Geladeira, fogão, air fryer..."
                  className="h-12 w-full rounded-xl border border-input bg-card pl-11 pr-3 text-[15px] text-foreground placeholder:text-subtle hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                />
              </div>
              <button type="submit" className={buttonVariants({ variant: "primary", className: "h-12" })}>
                Buscar
              </button>
            </div>
          </form>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Ir para o início
            </Link>
            <Link href="/ofertas" className={buttonVariants({ variant: "ghost", size: "lg" })}>
              Ver ofertas <ArrowRight aria-hidden />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
