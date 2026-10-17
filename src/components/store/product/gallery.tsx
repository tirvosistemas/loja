"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Expand, Zap } from "lucide-react";
import { SmartImage } from "@/components/ui/smart-image";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { usePurchase } from "./purchase-context";

// Galeria do produto: carrossel com arraste (toque), miniaturas (verticais no computador),
// lupa ao passar o mouse e tela cheia com setas e teclado.

type Img = { url: string; alt: string | null };

function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setFine(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return fine;
}

function ZoomImage({ img, alt, active, priority, onOpen, enabled }: { img: Img; alt: string; active: boolean; priority: boolean; onOpen: () => void; enabled: boolean }) {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const zoomed = enabled && active && origin != null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Ampliar imagem: ${alt}`}
      className={cn("relative block size-full overflow-hidden bg-well", enabled ? "cursor-zoom-in" : "cursor-pointer")}
      onMouseMove={(e) => {
        if (!enabled) return;
        const r = e.currentTarget.getBoundingClientRect();
        setOrigin({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
      }}
      onMouseLeave={() => setOrigin(null)}
    >
      <SmartImage
        src={img.url}
        alt={alt}
        size="lg"
        sizes="(min-width: 1024px) 50vw, 100vw"
        priority={priority}
        draggable={false}
        className="size-full select-none object-contain p-6 transition-transform duration-200 ease-out sm:p-10"
        style={{ transformOrigin: origin ? `${origin.x}% ${origin.y}%` : "50% 50%", transform: zoomed ? "scale(2.2)" : "scale(1)" }}
      />
    </button>
  );
}

function Lightbox({ images, name, start, open, onClose }: { images: Img[]; name: string; start: number; open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      className="sm:max-w-6xl"
      title={<span className="line-clamp-1">{name}</span>}
      description={images.length > 1 ? `Imagem ${index + 1} de ${images.length}` : undefined}
    >
      {open && <LightboxBody images={images} name={name} start={start} onIndex={setIndex} />}
    </Dialog>
  );
}

function LightboxBody({ images, name, start, onIndex }: { images: Img[]; name: string; start: number; onIndex: (i: number) => void }) {
  const [ref, api] = useEmblaCarousel({ startIndex: start, loop: images.length > 1 });
  const [selected, setSelected] = useState(start);

  useEffect(() => {
    if (!api) return;
    const on = () => {
      const i = api.selectedScrollSnap();
      setSelected(i);
      onIndex(i);
    };
    api.on("select", on);
    on();
    return () => {
      api.off("select", on);
    };
  }, [api, onIndex]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") api?.scrollPrev();
      if (e.key === "ArrowRight") api?.scrollNext();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [api]);

  return (
    <div className="-mx-5 -my-5 sm:-mx-6">
      <div className="relative bg-well">
        <div ref={ref} className="overflow-hidden">
          <div className="flex touch-pan-y">
            {images.map((img, i) => (
              <div key={i} className="min-w-0 flex-[0_0_100%]">
                <div className="grid h-[62dvh] place-items-center sm:h-[72dvh]">
                  <SmartImage src={img.url} alt={img.alt || `${name}, imagem ${i + 1}`} size="lg" sizes="100vw" className="max-h-full max-w-full object-contain p-4 sm:p-8" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => api?.scrollPrev()} aria-label="Imagem anterior" className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => api?.scrollNext()} aria-label="Próxima imagem" className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80">
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-4 sm:px-6">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => api?.scrollTo(i)}
              aria-label={`Ver imagem ${i + 1}`}
              aria-current={i === selected}
              className={cn("size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-well transition-colors", i === selected ? "border-primary" : "border-transparent opacity-70 hover:opacity-100")}
            >
              <SmartImage src={img.url} alt="" size="sm" sizes="64px" className="size-full object-contain p-1.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductGallery({ images: raw, name }: { images: Img[]; name: string }) {
  const { product, price } = usePurchase();
  const images = raw.length ? raw : [{ url: "", alt: null }];
  const [ref, api] = useEmblaCarousel({ loop: false, watchDrag: (_api, evt) => evt.type.startsWith("touch") });
  const [selected, setSelected] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const fine = useFinePointer();
  const thumbs = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!api) return;
    const on = () => {
      const i = api.selectedScrollSnap();
      setSelected(i);
      thumbs.current?.querySelector<HTMLElement>(`[data-thumb="${i}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    api.on("select", on);
    return () => {
      api.off("select", on);
    };
  }, [api]);

  const go = useCallback((i: number) => api?.scrollTo(i), [api]);
  const multi = images.length > 1;

  return (
    <div className="flex min-w-0 flex-col gap-3 lg:flex-row-reverse lg:items-start lg:gap-4">
      <div className="relative min-w-0 flex-1">
        <div className="overflow-hidden rounded-2xl border border-border sm:rounded-3xl" ref={ref} role="region" aria-roledescription="carrossel" aria-label={`Imagens de ${name}`}>
          <div className="flex touch-pan-y">
            {images.map((img, i) => (
              <div
                key={i}
                className="aspect-square min-w-0 flex-[0_0_100%]"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} de ${images.length}`}
              >
                <ZoomImage
                  img={img}
                  alt={img.alt || (multi ? `${name}, imagem ${i + 1}` : name)}
                  active={i === selected}
                  priority={i === 0}
                  enabled={fine}
                  onOpen={() => img.url && setLightbox(true)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5 sm:left-4 sm:top-4">
          {price.discountPercent > 0 && <Badge tone="solid">-{price.discountPercent}%</Badge>}
          {product.promo?.flash && (
            <Badge tone="inverse">
              <Zap aria-hidden /> Relâmpago
            </Badge>
          )}
          {product.promo?.badge && !product.promo.flash && <Badge tone="inverse">{product.promo.badge}</Badge>}
          {product.isNew && <Badge className="border-transparent bg-black/80 text-white">Lançamento</Badge>}
        </div>

        {raw.length > 0 && (
          <button
            type="button"
            onClick={() => setLightbox(true)}
            aria-label="Ver em tela cheia"
            className="absolute bottom-3 right-3 grid size-10 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80 sm:bottom-4 sm:right-4"
          >
            <Expand className="size-4.5" />
          </button>
        )}

        {multi && (
          <>
            <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 font-mono text-[11px] text-white backdrop-blur lg:hidden" aria-hidden>
              {selected + 1}/{images.length}
            </span>
            <button
              type="button"
              onClick={() => api?.scrollPrev()}
              disabled={selected === 0}
              aria-label="Imagem anterior"
              className="absolute left-3 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/90 text-foreground shadow-sm backdrop-blur transition hover:border-border-strong disabled:opacity-0 lg:grid"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => api?.scrollNext()}
              disabled={selected === images.length - 1}
              aria-label="Próxima imagem"
              className="absolute right-3 top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/90 text-foreground shadow-sm backdrop-blur transition hover:border-border-strong disabled:opacity-0 lg:grid"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      {multi && (
        <div
          ref={thumbs}
          className="no-scrollbar flex gap-2 overflow-x-auto lg:max-h-[min(640px,calc(100dvh-11rem))] lg:w-20 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden"
          aria-label="Miniaturas"
        >
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              data-thumb={i}
              onClick={() => go(i)}
              aria-label={`Ver imagem ${i + 1}`}
              aria-current={i === selected}
              className={cn(
                "size-16 shrink-0 overflow-hidden rounded-xl border-2 bg-well transition-[border-color,opacity] lg:size-20",
                i === selected ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <SmartImage src={img.url} alt="" size="sm" sizes="80px" className="size-full object-contain p-1.5" />
            </button>
          ))}
        </div>
      )}

      <Lightbox images={raw} name={name} start={selected} open={lightbox} onClose={() => setLightbox(false)} />
    </div>
  );
}
