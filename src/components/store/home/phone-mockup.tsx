import { BellRing, Gamepad2, Headset, Heart, House, LayoutGrid, Search, ShoppingBag, Smartphone, Watch } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/** Celular desenhado em CSS com uma versão em miniatura da loja (decorativo). */
export function PhoneMockup({ className, storeName = "Tirvo" }: { className?: string; storeName?: string }) {
  const cats = [Headset, Gamepad2, Smartphone, Watch];
  return (
    <div aria-hidden className={cn("relative mx-auto w-[248px] select-none sm:w-[272px]", className)}>
      <div className="glow-orange absolute -inset-16 -z-10" />
      <div className="rounded-[2.6rem] border border-border-strong bg-elevated p-2 shadow-card">
        <div className="relative flex aspect-[9/19] flex-col overflow-hidden rounded-[2.1rem] border border-border bg-background">
          {/* barra de status */}
          <div className="relative flex h-8 shrink-0 items-center justify-between px-6 pt-1 font-mono text-[10px] text-muted-foreground">
            <span>9:41</span>
            <span className="absolute left-1/2 top-1.5 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
            <span className="flex gap-0.5">
              <span className="h-2 w-0.5 rounded-sm bg-muted-foreground" />
              <span className="h-2.5 w-0.5 rounded-sm bg-muted-foreground" />
              <span className="h-3 w-0.5 rounded-sm bg-muted-foreground" />
            </span>
          </div>

          {/* cabeçalho */}
          <div className="flex items-center justify-between px-4 py-2">
            <span className="flex items-center gap-1.5">
              <LogoMark className="size-5 text-foreground" />
              <span className="text-[13px] font-semibold tracking-tight">{storeName}</span>
            </span>
            <span className="relative">
              <ShoppingBag className="size-4 text-foreground" />
              <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary" />
            </span>
          </div>
          <div className="mx-4 flex h-7 items-center gap-1.5 rounded-lg border border-border bg-card px-2 text-[10px] text-subtle">
            <Search className="size-3" /> O que você procura?
          </div>

          {/* notificação */}
          <div className="absolute inset-x-2.5 top-[4.6rem] z-10 rounded-2xl border border-border-strong bg-card/95 p-2.5 shadow-2xl backdrop-blur motion-safe:animate-slide-up">
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
                <BellRing className="size-3.5" />
              </span>
              <span className="flex-1 font-mono text-[9px] uppercase tracking-[0.14em] text-subtle">{storeName} · agora</span>
            </div>
            <p className="mt-1.5 text-[11px] font-semibold leading-tight">Oferta relâmpago começou ⚡</p>
            <p className="text-[10px] leading-tight text-muted-foreground">Toque para ver os descontos de hoje.</p>
          </div>

          {/* destaque */}
          <div className="relative mx-4 mt-16 overflow-hidden rounded-xl border border-border bg-card p-3">
            <div className="bg-grid absolute inset-0 opacity-60" />
            <div className="relative">
              <span className="flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.16em] text-subtle">
                <span className="size-1 rounded-full bg-primary" /> Curitiba e região
              </span>
              <span className="mt-1.5 block h-2 w-4/5 rounded bg-foreground/80" />
              <span className="mt-1 block h-2 w-3/5 rounded bg-foreground/80" />
              <span className="mt-2.5 inline-block h-4 w-14 rounded-md bg-primary" />
            </div>
          </div>

          {/* categorias */}
          <div className="mx-4 mt-3 grid grid-cols-4 gap-2">
            {cats.map((Icon, i) => (
              <span key={i} className="grid aspect-square place-items-center rounded-lg border border-border bg-elevated text-muted-foreground">
                <Icon className="size-3.5" />
              </span>
            ))}
          </div>

          {/* produtos */}
          <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-1.5">
                <div className="relative aspect-square rounded-md bg-well">
                  <span className="absolute left-1 top-1 h-2.5 w-5 rounded bg-primary" />
                </div>
                <span className="mt-1.5 block h-1.5 w-full rounded bg-muted" />
                <span className="mt-1 block h-1.5 w-2/3 rounded bg-muted" />
                <span className="mt-1.5 block h-2 w-1/2 rounded bg-foreground/70" />
              </div>
            ))}
          </div>

          {/* abas */}
          <div className="mt-auto grid grid-cols-4 border-t border-border bg-card/80 px-3 pb-3 pt-2 text-muted-foreground">
            {[House, LayoutGrid, Heart, ShoppingBag].map((Icon, i) => (
              <span key={i} className={cn("grid place-items-center", i === 0 && "text-primary")}>
                <Icon className="size-4" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
