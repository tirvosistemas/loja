import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ProductCardDTO } from "@/lib/catalog";
import { ProductCard } from "@/components/store/product-card";
import { buttonVariants } from "@/components/ui/button";
import { SectionHeader } from "./section-header";

/** Grade de ofertas da página inicial (até 8 produtos). */
export function OffersGrid({ products }: { products: ProductCardDTO[] }) {
  if (!products.length) return null;
  const list = products.slice(0, 8);
  return (
    <section aria-labelledby="ofertas-titulo" className="container-page">
      <SectionHeader id="ofertas-titulo" eyebrow="Preço baixo" title="Ofertas da semana" href="/ofertas" hrefLabel="Ver todas as ofertas" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
        {list.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      <div className="mt-6 flex justify-center">
        <Link href="/ofertas" className={buttonVariants({ variant: "outline" })}>
          Ver todas as ofertas <ArrowRight aria-hidden />
        </Link>
      </div>
    </section>
  );
}
