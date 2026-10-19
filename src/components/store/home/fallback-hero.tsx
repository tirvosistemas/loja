import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { Eyebrow } from "./section-header";

/** Mira decorativa da marca, apontando para Curitiba. */
function Crosshair({ cities }: { cities: number | null }) {
  return (
    <div aria-hidden className="relative mx-auto aspect-square w-full max-w-[300px] sm:max-w-[380px]">
      <div className="absolute inset-0 rounded-full border border-border" />
      <div className="absolute inset-[9%] rounded-full border border-dashed border-border-strong motion-safe:animate-[spin_60s_linear_infinite]" />
      <div className="absolute inset-[24%] rounded-full border border-border" />
      <div className="glow-orange absolute inset-[10%] rounded-full" />
      {/* eixos */}
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-border-strong to-transparent" />
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-border-strong to-transparent" />
      <LogoMark className="absolute left-[30%] top-[30%] size-[40%] text-foreground" />
      <span className="absolute left-[6%] top-[6%] rounded-md border border-border bg-background/80 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur sm:text-[11px]">
        lat −25,4284
      </span>
      <span className="absolute bottom-[6%] right-[4%] rounded-md border border-border bg-background/80 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur sm:text-[11px]">
        lng −49,2733
      </span>
      <span className="absolute right-[2%] top-[18%] flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary-soft px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-primary sm:text-[11px]">
        <span className="size-1.5 rounded-full bg-primary animate-pulse-dot" />
        {cities ? `${cities} cidades` : "Curitiba e RMC"}
      </span>
    </div>
  );
}

/** Destaque da marca quando ainda não há banners cadastrados. */
export function FallbackHero({ categoriesHref, cities }: { categoriesHref: string; cities: number | null }) {
  return (
    <section className="container-page pt-4 md:pt-6" aria-labelledby="hero-titulo">
      <div className="relative isolate overflow-hidden rounded-3xl border border-border bg-card">
        <div aria-hidden className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
        <div aria-hidden className="glow-orange absolute -left-40 -top-40 -z-10 size-[520px]" />
        <div className="grid items-center gap-10 px-5 py-10 sm:px-10 sm:py-14 md:grid-cols-[1.2fr_1fr] lg:px-14 lg:py-20">
          <div className="animate-slide-up">
            <Eyebrow className="mb-5">Curitiba e região</Eyebrow>
            <h1 id="hero-titulo" className="max-w-2xl text-[1.875rem] font-semibold leading-[1.06] tracking-tight min-[400px]:text-4xl sm:text-5xl lg:text-6xl">
              Eletrônicos com <span className="text-brand">entrega rápida</span> por motoboy
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Frete calculado na hora pelo CEP, sem surpresa no final. Pague online, no Pix ou só quando o produto chegar na sua casa.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/ofertas" className={buttonVariants({ variant: "primary", size: "xl" })}>
                Ver ofertas <ArrowRight aria-hidden />
              </Link>
              <Link href={categoriesHref} className={buttonVariants({ variant: "outline", size: "xl" })}>
                Explorar categorias
              </Link>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border text-left">
              {[
                ["Entrega", "Motoboy"],
                ["Frete", "Pelo CEP"],
                ["Pagamento", "Na entrega"],
              ].map(([k, v]) => (
                <div key={k} className="bg-card px-3 py-3 sm:px-4">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-subtle sm:text-[11px]">{k}</dt>
                  <dd className="mt-1 text-sm font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Crosshair cities={cities} />
        </div>
      </div>
    </section>
  );
}
