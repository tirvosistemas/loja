import Link from "next/link";
import type { BannerDTO } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { BannerOverlay, BannerPicture, isExternal } from "./banner-media";

/** Faixas de banners no meio da página (1 ou 2 por linha). */
export function StripBanners({ banners }: { banners: BannerDTO[] }) {
  if (!banners.length) return null;
  const single = banners.length === 1;
  return (
    <section aria-label="Campanhas" className="container-page">
      {/* Lado a lado só a partir do notebook: no tablet a metade da tela não cabe o texto. */}
      <div className={cn("grid gap-4", !single && "lg:grid-cols-2")}>
        {banners.map((b) => {
          const cls = cn(
            "group relative block overflow-hidden rounded-3xl border border-border bg-elevated",
            single ? "aspect-[4/3] sm:aspect-[3/1]" : "aspect-[4/3] md:aspect-[12/5] lg:aspect-[16/9]",
          );
          // Lado a lado, a foto larga é cortada nas laterais: ancora a foto do lado oposto ao texto
          // (onde costuma estar o produto) e estreita o texto para não ficar por cima dele.
          const align = b.align ?? "left";
          const anchor = single ? undefined : align === "left" ? "md:object-left" : align === "right" ? "md:object-right" : undefined;
          const body = (
            <>
              <BannerPicture
                banner={b}
                sizes={single ? "(min-width: 1320px) 1320px, 100vw" : "(min-width: 768px) 50vw, 100vw"}
                className={cn("transition-transform duration-700 group-hover:scale-[1.02]", anchor)}
              />
              <BannerOverlay banner={b} size="strip" as="h3" textClassName={single || align === "center" ? undefined : "md:max-w-[52%] lg:max-w-[60%]"} />
            </>
          );
          if (!b.href) return <div key={b.id} className={cls}>{body}</div>;
          return isExternal(b.href) ? (
            <a key={b.id} href={b.href} target="_blank" rel="noopener noreferrer" aria-label={b.title} className={cls}>
              {body}
            </a>
          ) : (
            <Link key={b.id} href={b.href} aria-label={b.title} className={cls}>
              {body}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
