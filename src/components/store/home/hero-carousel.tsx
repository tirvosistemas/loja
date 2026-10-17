"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { BannerDTO } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { BannerOverlay, BannerPicture, isExternal } from "./banner-media";

function Slide({ banner, index, total, mobileAspect }: { banner: BannerDTO; index: number; total: number; mobileAspect: string }) {
  const body = (
    <>
      <BannerPicture banner={banner} priority={index === 0} />
      <BannerOverlay banner={banner} as="h2" />
    </>
  );
  const cls = cn("relative block overflow-hidden bg-elevated md:aspect-[1920/720]", mobileAspect);
  return (
    <div role="group" aria-roledescription="slide" aria-label={`${index + 1} de ${total}: ${banner.title}`} className="min-w-0 shrink-0 grow-0 basis-full">
      {banner.href ? (
        isExternal(banner.href) ? (
          <a href={banner.href} target="_blank" rel="noopener noreferrer" className={cls} aria-label={banner.title}>
            {body}
          </a>
        ) : (
          <Link href={banner.href} className={cls} aria-label={banner.title} draggable={false}>
            {body}
          </Link>
        )
      ) : (
        <div className={cls}>{body}</div>
      )}
    </div>
  );
}

/** Carrossel principal da página inicial (arrasta no celular, pausa ao passar o mouse/focar). */
export function HeroCarousel({ banners, autoplayMs }: { banners: BannerDTO[]; autoplayMs: number }) {
  const many = banners.length > 1;
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);

  const autoplayOn = many && autoplayMs > 0 && !reduced;
  const plugins = useMemo(
    () =>
      autoplayOn
        ? [
            Autoplay({
              delay: autoplayMs,
              stopOnInteraction: false,
              stopOnMouseEnter: true,
              stopOnFocusIn: true,
              // Pausa com o mouse em qualquer parte do carrossel, inclusive setas e bolinhas.
              rootNode: (root) => root.parentElement ?? root,
            }),
          ]
        : [],
    [autoplayOn, autoplayMs],
  );
  const [viewportRef, api] = useEmblaCarousel({ loop: many, align: "start", duration: 28, watchDrag: many }, plugins);
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect).on("reInit", onSelect);
    return () => {
      api.off("select", onSelect).off("reInit", onSelect);
    };
  }, [api]);

  const autoplay = useCallback(() => api?.plugins()?.autoplay, [api]);

  const go = useCallback(
    (i: number) => {
      api?.scrollTo(i);
      if (!paused) autoplay()?.reset();
    },
    [api, autoplay, paused],
  );
  const prev = () => {
    api?.scrollPrev();
    if (!paused) autoplay()?.reset();
  };
  const next = () => {
    api?.scrollNext();
    if (!paused) autoplay()?.reset();
  };
  const togglePause = () => {
    const a = autoplay();
    if (!a) return;
    pausedRef.current = !paused;
    if (paused) a.play();
    else a.stop();
    setPaused(!paused);
  };

  // Mantém pausado se a pessoa pausou, mesmo quando o mouse ou o foco saem do carrossel.
  useEffect(() => {
    if (!api) return;
    const hold = () => {
      if (pausedRef.current) api.plugins()?.autoplay?.stop();
    };
    api.on("autoplay:timerset", hold);
    return () => {
      api.off("autoplay:timerset", hold);
    };
  }, [api]);

  const mobileAspect = banners.every((b) => b.imageMobile) ? "aspect-[4/5]" : "aspect-[4/3]";

  return (
    <section aria-roledescription="carrossel" aria-label="Destaques da loja" className="container-page pt-4 md:pt-6">
      <div
        className="relative overflow-hidden rounded-2xl border border-border md:rounded-3xl"
        onKeyDown={(e) => {
          if (!many) return;
          if (e.key === "ArrowLeft") prev();
          if (e.key === "ArrowRight") next();
        }}
      >
        <div ref={viewportRef} className="overflow-hidden">
          <div className="flex touch-pan-y">
            {banners.map((b, i) => (
              <Slide key={b.id} banner={b} index={i} total={banners.length} mobileAspect={mobileAspect} />
            ))}
          </div>
        </div>

        {many && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Banner anterior"
              className="absolute left-4 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur transition hover:bg-black/60 md:grid"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Próximo banner"
              className="absolute right-4 top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur transition hover:bg-black/60 md:grid"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>

            <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1 md:bottom-5">
              <div className="flex items-center gap-0.5 rounded-full bg-black/40 px-1.5 py-0.5 backdrop-blur">
                {banners.map((b, i) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`Ir para o banner ${i + 1} de ${banners.length}`}
                    aria-current={selected === i ? "true" : undefined}
                    className="grid h-8 min-w-6 place-items-center"
                  >
                    <span
                      aria-hidden
                      className={cn("block h-1.5 rounded-full transition-all duration-300", selected === i ? "w-6 bg-primary" : "w-1.5 bg-white/60")}
                    />
                  </button>
                ))}
                {autoplayOn && (
                  <button
                    type="button"
                    onClick={togglePause}
                    aria-label={paused ? "Retomar troca automática" : "Pausar troca automática"}
                    className="grid size-8 place-items-center rounded-full text-white/80 hover:text-white"
                  >
                    {paused ? <Play className="size-3.5" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
