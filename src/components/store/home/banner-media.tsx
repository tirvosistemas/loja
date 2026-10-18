import type { BannerDTO } from "@/lib/catalog";
import { imageSrcSet, imageUrl } from "@/lib/images";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Peças compartilhadas pelo carrossel principal e pelas faixas de banners.

/** Imagem do banner: versão de celular (< 768px) quando existir, senão a de computador. */
export function BannerPicture({
  banner,
  priority,
  sizes = "(min-width: 1320px) 1320px, 100vw",
  className,
}: {
  banner: BannerDTO;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  const mobile = banner.imageMobile;
  return (
    <picture>
      {mobile && <source media="(max-width: 767px)" srcSet={imageSrcSet(mobile) ?? imageUrl(mobile, "md")} sizes="100vw" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl(banner.imageDesktop, "lg")}
        srcSet={imageSrcSet(banner.imageDesktop)}
        sizes={imageSrcSet(banner.imageDesktop) ? sizes : undefined}
        alt=""
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        draggable={false}
        className={cn("absolute inset-0 size-full object-cover", className)}
      />
    </picture>
  );
}

const ALIGN = {
  left: "items-end text-left md:items-center md:justify-start",
  center: "items-end justify-center text-center md:items-center",
  right: "items-end text-left md:items-center md:justify-end md:text-right",
} as const;

/**
 * Textos sobre a foto. "dark" = texto claro sobre foto escura; "light" = texto escuro.
 * `controls`: reserva espaço embaixo para as bolinhas do carrossel (no celular o texto fica no rodapé).
 */
export function BannerOverlay({
  banner,
  size = "hero",
  as: Heading = "h2",
  controls,
  textClassName,
}: {
  banner: BannerDTO;
  size?: "hero" | "strip";
  as?: "h1" | "h2" | "h3";
  controls?: boolean;
  textClassName?: string;
}) {
  const dark = banner.theme !== "light";
  const align = banner.align ?? "left";
  const hasText = !!(banner.title || banner.subtitle || banner.eyebrow || banner.ctaLabel);
  if (!hasText) return null;

  // Degradê para garantir leitura do texto, no sentido do alinhamento.
  const shade = dark
    ? align === "right"
      ? "bg-gradient-to-t from-black/75 via-black/25 to-transparent md:bg-gradient-to-l md:from-black/65 md:via-black/20"
      : align === "center"
        ? "bg-gradient-to-t from-black/75 via-black/30 to-transparent md:from-black/60"
        : "bg-gradient-to-t from-black/75 via-black/25 to-transparent md:bg-gradient-to-r md:from-black/65 md:via-black/20"
    : align === "right"
      ? "bg-gradient-to-t from-white/85 via-white/30 to-transparent md:bg-gradient-to-l md:from-white/75 md:via-white/25"
      : align === "center"
        ? "bg-gradient-to-t from-white/85 via-white/35 to-transparent md:from-white/70"
        : "bg-gradient-to-t from-white/85 via-white/30 to-transparent md:bg-gradient-to-r md:from-white/75 md:via-white/25";

  const hero = size === "hero";
  return (
    <>
      <div aria-hidden className={cn("absolute inset-0", shade)} />
      <div
        className={cn(
          "absolute inset-0 flex",
          ALIGN[align],
          // No computador as setas ficam nas laterais: o texto começa depois delas.
          hero ? "p-6 sm:p-10 md:px-20 lg:p-16 lg:px-20" : "p-5 sm:p-8",
          hero && controls && "pb-16 sm:pb-16 md:pb-10 lg:pb-16",
        )}
      >
        <div className={cn("max-w-xl", dark ? "text-white" : "text-zinc-950", align === "center" && "mx-auto", textClassName)}>
          {banner.eyebrow && (
            <p
              className={cn(
                "mb-3 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] sm:text-xs",
                dark ? "text-white/80" : "text-zinc-700",
              )}
            >
              <span aria-hidden className="size-1.5 rounded-full bg-primary" />
              {banner.eyebrow}
            </p>
          )}
          {banner.title && (
            <Heading
              className={cn(
                "font-semibold tracking-tight",
                hero ? "text-3xl leading-[1.05] sm:text-4xl lg:text-5xl xl:text-6xl" : "text-2xl leading-tight sm:text-3xl",
              )}
            >
              {banner.title}
            </Heading>
          )}
          {banner.subtitle && (
            <p className={cn("mt-3 text-pretty", hero ? "text-base sm:text-lg" : "text-sm sm:text-base", dark ? "text-white/80" : "text-zinc-700")}>
              {banner.subtitle}
            </p>
          )}
          {banner.ctaLabel && banner.href && (
            <span className={cn(buttonVariants({ variant: "primary", size: hero ? "lg" : "md" }), "mt-6 pointer-events-none")}>{banner.ctaLabel}</span>
          )}
        </div>
      </div>
    </>
  );
}

export function isExternal(href: string) {
  return /^https?:\/\//i.test(href);
}
