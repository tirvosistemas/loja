import { MapPin, ShoppingBag, Truck } from "lucide-react";
import { freeShippingMinimum, freeShippingWhere, type FreeShippingRule } from "@/lib/shipping/free";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Aviso do frete grátis da loja (aparece só com o frete grátis ligado em Configurações → Frete). */
export function FreeShippingBanner({ rule }: { rule: FreeShippingRule }) {
  const min = freeShippingMinimum(rule);
  return (
    <section aria-labelledby="frete-gratis-titulo" className="container-page">
      <div className="flex flex-col gap-5 rounded-3xl bg-primary px-5 py-6 text-primary-foreground sm:flex-row sm:items-center sm:gap-6 sm:px-8 sm:py-7">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-black/10">
          <Truck className="size-7" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="frete-gratis-titulo" className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
            Frete grátis em todos os produtos
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2 text-sm font-medium">
            <li className="inline-flex items-center gap-1.5 rounded-full bg-black/10 px-3 py-1.5">
              <MapPin className="size-4" aria-hidden /> {capitalize(freeShippingWhere(rule))}
            </li>
            {min && (
              <li className="inline-flex items-center gap-1.5 rounded-full bg-black/10 px-3 py-1.5">
                <ShoppingBag className="size-4" aria-hidden /> {capitalize(min)}
              </li>
            )}
          </ul>
        </div>
        <p className="text-sm font-medium opacity-80 sm:ml-auto sm:max-w-56 sm:text-right">Entrega por motoboy. Confira pelo CEP no produto ou no carrinho.</p>
      </div>
    </section>
  );
}
