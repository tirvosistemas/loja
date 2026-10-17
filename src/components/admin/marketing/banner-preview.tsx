"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImageIcon, Menu, Monitor, Search, ShoppingBag, Smartphone } from "lucide-react";
import { Segmented } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

// Prévia ao vivo do banner, com as mesmas regras visuais da vitrine
// (components/store/home/banner-media.tsx), em tamanho real e reduzida para caber.

export type BannerPreviewData = {
  title: string;
  subtitle: string;
  eyebrow: string;
  ctaLabel: string;
  href: string;
  imageDesktop: string | null;
  imageMobile: string | null;
  theme: "dark" | "light";
  align: "left" | "center" | "right";
  placement: "HERO" | "STRIP";
};

type Device = "desktop" | "mobile";

const SHADE = {
  desktop: {
    dark: {
      left: "bg-gradient-to-r from-black/65 via-black/20 to-transparent",
      center: "bg-gradient-to-t from-black/60 via-black/30 to-transparent",
      right: "bg-gradient-to-l from-black/65 via-black/20 to-transparent",
    },
    light: {
      left: "bg-gradient-to-r from-white/75 via-white/25 to-transparent",
      center: "bg-gradient-to-t from-white/70 via-white/35 to-transparent",
      right: "bg-gradient-to-l from-white/75 via-white/25 to-transparent",
    },
  },
  mobile: {
    dark: {
      left: "bg-gradient-to-t from-black/75 via-black/25 to-transparent",
      center: "bg-gradient-to-t from-black/75 via-black/30 to-transparent",
      right: "bg-gradient-to-t from-black/75 via-black/25 to-transparent",
    },
    light: {
      left: "bg-gradient-to-t from-white/85 via-white/30 to-transparent",
      center: "bg-gradient-to-t from-white/85 via-white/35 to-transparent",
      right: "bg-gradient-to-t from-white/85 via-white/30 to-transparent",
    },
  },
} as const;

const ALIGN = {
  desktop: { left: "items-center justify-start text-left", center: "items-center justify-center text-center", right: "items-center justify-end text-right" },
  mobile: { left: "items-end text-left", center: "items-end justify-center text-center", right: "items-end text-left" },
} as const;

/** Tamanho real (px) do banner em cada aparelho. */
function bannerSize(placement: BannerPreviewData["placement"], device: Device, hasMobileImage: boolean) {
  if (device === "desktop") return placement === "HERO" ? { w: 1256, h: Math.round((1256 * 720) / 1920) } : { w: 1256, h: Math.round(1256 / 3) };
  const w = 358;
  if (placement === "HERO") return { w, h: Math.round(hasMobileImage ? (w * 5) / 4 : (w * 3) / 4) };
  return { w, h: Math.round((w * 3) / 4) };
}

function BannerArt({ data, device }: { data: BannerPreviewData; device: Device }) {
  const hero = data.placement === "HERO";
  const dark = data.theme !== "light";
  const img = device === "mobile" ? data.imageMobile || data.imageDesktop : data.imageDesktop;
  const hasText = !!(data.title || data.subtitle || data.eyebrow || (data.ctaLabel && data.href));
  const desk = device === "desktop";
  return (
    <div className={cn("relative size-full overflow-hidden border border-border bg-elevated", desk || !hero ? "rounded-3xl" : "rounded-2xl")}>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl(img, desk ? "lg" : "md")} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
      ) : (
        <div className="bg-grid absolute inset-0 grid place-items-center">
          <div className={cn("flex flex-col items-center gap-4 text-subtle", desk ? "text-4xl" : "text-lg")}>
            <ImageIcon className={desk ? "size-24" : "size-10"} strokeWidth={desk ? 1.2 : 1.5} aria-hidden />
            <span>Envie a imagem para ver a prévia</span>
          </div>
        </div>
      )}
      {hasText && (
        <>
          <div aria-hidden className={cn("absolute inset-0", SHADE[device][dark ? "dark" : "light"][data.align])} />
          <div className={cn("absolute inset-0 flex", ALIGN[device][data.align], desk ? (hero ? "p-16" : "p-8") : hero ? "p-6" : "p-5")}>
            <div className={cn("max-w-xl", dark ? "text-white" : "text-zinc-950", data.align === "center" && "mx-auto")}>
              {data.eyebrow && (
                <p className={cn("mb-3 inline-flex items-center gap-2 font-mono uppercase tracking-[0.18em]", desk ? "text-xs" : "text-[11px]", dark ? "text-white/80" : "text-zinc-700")}>
                  <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                  {data.eyebrow}
                </p>
              )}
              {data.title && (
                <p
                  className={cn(
                    "break-words font-semibold tracking-tight",
                    hero ? (desk ? "text-6xl leading-[1.05]" : "text-3xl leading-[1.05]") : desk ? "text-3xl leading-tight" : "text-2xl leading-tight",
                  )}
                >
                  {data.title}
                </p>
              )}
              {data.subtitle && (
                <p className={cn("mt-3 text-pretty", hero ? (desk ? "text-lg" : "text-base") : desk ? "text-base" : "text-sm", dark ? "text-white/80" : "text-zinc-700")}>{data.subtitle}</p>
              )}
              {data.ctaLabel && data.href && <span className={cn(buttonVariants({ variant: "primary", size: hero ? "lg" : "md" }), "pointer-events-none mt-6")}>{data.ctaLabel}</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Desenha o conteúdo em tamanho real e reduz para caber na largura disponível. */
function Scaled({ width, height, children, center }: { width: number; height: number; children: ReactNode; center?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, el.clientWidth / width));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className="w-full">
      <div className={cn("relative overflow-hidden", center && "mx-auto")} style={{ width: scale ? width * scale : "100%", height: scale ? height * scale : 0 }}>
        <div className="absolute left-0 top-0" style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function DesktopFrame({ data }: { data: BannerPreviewData }) {
  const b = bannerSize(data.placement, "desktop", !!data.imageMobile);
  const pad = 32;
  const width = b.w + pad * 2;
  const height = b.h + pad * 2;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border bg-elevated/60 px-3 py-2">
        <span aria-hidden className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
        </span>
        <span className="mx-auto truncate rounded-md bg-background px-3 py-0.5 font-mono text-[11px] text-subtle">
          {data.placement === "HERO" ? "início · carrossel do topo" : "início · faixa no meio da página"}
        </span>
      </div>
      <Scaled width={width} height={height}>
        <div className="bg-background" style={{ width, height, padding: pad }}>
          <div style={{ width: b.w, height: b.h }}>
            <BannerArt data={data} device="desktop" />
          </div>
        </div>
      </Scaled>
    </div>
  );
}

function MobileFrame({ data }: { data: BannerPreviewData }) {
  const b = bannerSize(data.placement, "mobile", !!data.imageMobile);
  const width = 390;
  const header = 56;
  const height = header + 16 + b.h + 96;
  return (
    <Scaled width={width + 20} height={height + 20} center>
      <div className="rounded-[44px] border-[10px] border-border-strong bg-background shadow-card" style={{ width: width + 20, height: height + 20 }}>
        <div className="overflow-hidden rounded-[34px]" style={{ width, height }}>
          <div className="flex items-center justify-between border-b border-border px-4" style={{ height: header }}>
            <Menu className="size-5 text-muted-foreground" aria-hidden />
            <Logo className="h-5 text-foreground" />
            <span className="flex gap-3 text-muted-foreground">
              <Search className="size-5" aria-hidden />
              <ShoppingBag className="size-5" aria-hidden />
            </span>
          </div>
          <div style={{ padding: "16px 16px 0" }}>
            <div style={{ width: b.w, height: b.h }}>
              <BannerArt data={data} device="mobile" />
            </div>
            <div className="mt-5 flex gap-3" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <span className="size-14 rounded-2xl border border-border bg-card" />
                  <span className="h-2 w-12 rounded-full bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Scaled>
  );
}

export function BannerPreview({ data }: { data: BannerPreviewData }) {
  const [device, setDevice] = useState<Device>("desktop");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
          <span aria-hidden className="size-1.5 animate-pulse-dot rounded-full bg-primary" />
          Prévia ao vivo
        </p>
        <Segmented<Device>
          value={device}
          onChange={setDevice}
          options={[
            { value: "desktop", label: <><Monitor className="size-4" aria-hidden /> Computador</> },
            { value: "mobile", label: <><Smartphone className="size-4" aria-hidden /> Celular</> },
          ]}
        />
      </div>
      <div aria-label={`Prévia do banner no ${device === "desktop" ? "computador" : "celular"}`} role="img">
        {device === "desktop" ? <DesktopFrame data={data} /> : <MobileFrame data={data} />}
      </div>
      {device === "mobile" && !data.imageMobile && data.imageDesktop && (
        <p className="text-[13px] text-subtle">Sem imagem para celular, a de computador é recortada no centro. Envie uma vertical (1080 × 1350 px) para controlar o enquadramento.</p>
      )}
      {data.ctaLabel && !data.href && <p className="text-[13px] text-warning">O botão só aparece na loja quando o banner tem um link.</p>}
    </div>
  );
}
