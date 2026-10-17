"use client";

import { ChevronDown } from "lucide-react";
import { imageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

// Simulação de como a notificação aparece no Android (Chrome) e no iPhone (app instalado).
// As cores imitam a interface dos sistemas, por isso não seguem o tema do painel.

type PushData = { title: string; body: string; image?: string | null; storeName?: string };

const lockDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" });

const placeholder = { title: "Título da notificação", body: "A mensagem aparece aqui. Seja direto: o que é, quanto custa, até quando." };

function AndroidCard({ title, body, image, storeName = "Tirvo" }: PushData) {
  return (
    <div className="rounded-[26px] bg-[#2a2a30] p-4 text-white shadow-lg">
      <div className="flex items-center gap-2 text-[12px] text-white/65">
        <span className="grid size-5 place-items-center overflow-hidden rounded-full bg-[#ff5500]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon-32.png" alt="" className="size-3.5" />
        </span>
        <span className="truncate">{storeName}</span>
        <span aria-hidden>·</span>
        <span className="shrink-0">agora</span>
        <ChevronDown className="ml-auto size-4 shrink-0" aria-hidden />
      </div>
      <div className="mt-2.5 flex gap-3">
        <div className="min-w-0 flex-1">
          <p className={cn("line-clamp-1 break-words text-[15px] font-medium", !title && "text-white/40")}>{title || placeholder.title}</p>
          <p className={cn("mt-0.5 line-clamp-2 break-words text-[14px] leading-snug text-white/75", !body && "text-white/35")}>{body || placeholder.body}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="size-10 shrink-0 rounded-full" />
      </div>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl(image, "md")} alt="" className="mt-3 aspect-[2/1] w-full rounded-2xl object-cover" />
      )}
    </div>
  );
}

function IphoneCard({ title, body }: PushData) {
  return (
    <div className="flex gap-3 rounded-[22px] bg-white/75 p-3 text-[#0b0b0f] shadow-lg backdrop-blur-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" className="size-9 shrink-0 rounded-[9px]" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn("line-clamp-1 break-words text-[15px] font-semibold", !title && "text-black/35")}>{title || placeholder.title}</p>
          <span className="shrink-0 text-[13px] text-black/45">agora</span>
        </div>
        <p className={cn("line-clamp-4 break-words text-[15px] leading-snug", !body && "text-black/35")}>{body || placeholder.body}</p>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-subtle">{children}</p>;
}

/** As duas prévias lado a lado, em “telas” de celular. */
export function PushPreview(props: PushData) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="min-w-0">
        <Label>Android</Label>
        <div className="rounded-[28px] bg-[#121214] px-3 pb-5 pt-3">
          <div className="mb-3 flex items-center justify-between px-2 text-[11px] text-white/70">
            <span>9:41</span>
            <span className="flex items-center gap-1" aria-hidden>
              <span className="h-2 w-3 rounded-sm bg-white/60" />
              <span className="h-2 w-4 rounded-sm bg-white/60" />
            </span>
          </div>
          <AndroidCard {...props} />
        </div>
      </div>
      <div className="min-w-0">
        <Label>iPhone</Label>
        <div className="rounded-[28px] bg-[radial-gradient(120%_90%_at_20%_0%,#ff8a4c_0%,#7a2e8f_45%,#1b1740_100%)] px-3 pb-5 pt-4">
          <div className="mb-4 text-center text-white">
            <p className="text-[12px] font-medium text-white/80" suppressHydrationWarning>
              {lockDate.format(new Date())}
            </p>
            <p className="text-5xl font-semibold leading-none tracking-tight">9:41</p>
          </div>
          <IphoneCard {...props} />
        </div>
        {props.image && <p className="mt-2 text-[12px] text-subtle">O iPhone não exibe a imagem; só o título e a mensagem.</p>}
      </div>
    </div>
  );
}

/** Versão compacta (uma embaixo da outra), para formulários estreitos. */
export function PushPreviewCompact(props: PushData) {
  return (
    <div className="space-y-3" aria-label="Prévia da notificação">
      <div>
        <Label>Android</Label>
        <div className="rounded-[28px] bg-[#121214] p-2.5">
          <AndroidCard {...props} />
        </div>
      </div>
      <div>
        <Label>iPhone</Label>
        <div className="rounded-[28px] bg-[radial-gradient(120%_90%_at_20%_0%,#ff8a4c_0%,#7a2e8f_45%,#1b1740_100%)] p-2.5">
          <IphoneCard {...props} />
        </div>
      </div>
    </div>
  );
}
