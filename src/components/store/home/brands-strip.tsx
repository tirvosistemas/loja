import Link from "next/link";
import { SmartImage } from "@/components/ui/smart-image";
import { SectionHeader } from "./section-header";

type Brand = { id: string; name: string; slug: string; logo: string | null };

function BrandChip({ brand, hidden }: { brand: Brand; hidden?: boolean }) {
  return (
    <Link
      href={`/marca/${brand.slug}`}
      tabIndex={hidden ? -1 : undefined}
      aria-hidden={hidden || undefined}
      className="group flex h-16 min-w-36 shrink-0 items-center justify-center rounded-2xl border border-border bg-card px-6 transition-colors hover:border-border-strong"
    >
      {brand.logo ? (
        <span className="flex h-10 items-center rounded-lg bg-well px-3">
          <SmartImage
            src={brand.logo}
            alt={hidden ? "" : brand.name}
            size="sm"
            sizes="160px"
            className="h-7 w-auto max-w-[120px] object-contain opacity-80 grayscale transition group-hover:opacity-100 group-hover:grayscale-0"
          />
        </span>
      ) : (
        <span className="font-mono text-sm uppercase tracking-[0.18em] text-muted-foreground transition-colors group-hover:text-foreground">{brand.name}</span>
      )}
    </Link>
  );
}

/** Marcas da loja: faixa em movimento quando são muitas, lista simples quando são poucas. */
export function BrandsStrip({ brands }: { brands: Brand[] }) {
  if (!brands.length) return null;
  const marquee = brands.length >= 6;
  return (
    <section aria-labelledby="marcas-titulo" className="container-page">
      <SectionHeader id="marcas-titulo" eyebrow="Marcas" title="Trabalhamos com as marcas que você confia" />
      {marquee ? (
        <div className="group/marquee relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] motion-reduce:[mask-image:none]">
          <ul className="flex w-max animate-marquee group-hover/marquee:[animation-play-state:paused] group-focus-within/marquee:[animation-play-state:paused] motion-reduce:w-auto motion-reduce:flex-wrap motion-reduce:animate-none">
            {[...brands, ...brands].map((b, i) => (
              <li key={`${b.id}-${i}`} aria-hidden={i >= brands.length || undefined} className={i >= brands.length ? "pr-3 motion-reduce:hidden" : "pr-3 motion-reduce:pb-3"}>
                <BrandChip brand={b} hidden={i >= brands.length} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {brands.map((b) => (
            <li key={b.id}>
              <BrandChip brand={b} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
