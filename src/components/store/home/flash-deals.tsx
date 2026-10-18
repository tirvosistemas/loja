import { Zap } from "lucide-react";
import type { ProductCardDTO } from "@/lib/catalog";
import { Countdown } from "@/components/ui/countdown";
import { ProductRail } from "@/components/store/product-rail";

/** Faixa escura da oferta relâmpago, com contagem regressiva. Sempre no tema escuro. */
export function FlashDeals({ endsAt, products }: { endsAt: string; products: ProductCardDTO[] }) {
  if (!products.length) return null;
  return (
    <section data-theme="dark" aria-label="Oferta relâmpago" className="relative isolate overflow-hidden border-y border-border bg-background py-10 text-foreground md:py-14">
      <div aria-hidden className="bg-grid absolute inset-0 -z-10 opacity-70" />
      <div aria-hidden className="glow-orange absolute -right-40 -top-48 -z-10 size-[560px]" />
      <ProductRail
        eyebrow={
          <span className="inline-flex items-center gap-1.5 text-primary">
            <Zap className="size-3.5" aria-hidden /> Oferta relâmpago
          </span>
        }
        title="Preços que acabam logo"
        href="/ofertas"
        hrefLabel="Ver todas as ofertas"
        headerExtra={
          <div className="hidden items-center gap-3 lg:flex">
            <span className="text-sm text-muted-foreground">Termina em</span>
            <Countdown endsAt={endsAt} />
          </div>
        }
        // No celular e no tablet a contagem fica logo abaixo do título (no topo não cabe tudo numa linha).
        belowHeader={
          <div className="-mt-1 mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 lg:hidden">
            <span className="text-sm text-muted-foreground">Termina em</span>
            <Countdown endsAt={endsAt} />
          </div>
        }
        products={products}
      />
    </section>
  );
}
