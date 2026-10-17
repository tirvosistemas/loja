import Link from "next/link";
import { Smartphone } from "lucide-react";
import type { Banner } from "@prisma/client";
import { imageUrl } from "@/lib/images";
import { BannerActions } from "./banner-actions";
import { periodText, scheduleState } from "./schedule";
import { ScheduleStatus } from "./schedule-status";

export type BannerCardData = Pick<Banner, "id" | "title" | "eyebrow" | "ctaLabel" | "imageDesktop" | "imageMobile" | "active" | "startsAt" | "endsAt">;

/** Cartão de um banner na lista (miniatura, situação, botão, período e ações). */
export function BannerCard({ banner: b, index, total, aspect, now, linkText }: { banner: BannerCardData; index: number; total: number; aspect: string; now: Date; linkText: string }) {
  const state = scheduleState(b, now);
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <Link href={`/admin/banners/${b.id}`} className={`group relative block overflow-hidden bg-well ${aspect}`} aria-label={`Editar “${b.title}”`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl(b.imageDesktop, "md")}
          alt=""
          loading="lazy"
          className={`size-full object-cover transition duration-500 group-hover:scale-[1.02] ${state === "active" ? "" : "opacity-60 grayscale-[.4]"}`}
        />
        <span className="absolute left-2.5 top-2.5 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white backdrop-blur">#{index + 1}</span>
        {b.imageMobile && (
          <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-white backdrop-blur" title="Tem imagem própria para celular">
            <Smartphone className="size-3" aria-hidden /> celular
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {b.eyebrow && <p className="truncate font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle">{b.eyebrow}</p>}
            <h3 className="line-clamp-2 font-semibold leading-snug">{b.title}</h3>
          </div>
          <ScheduleStatus active={b.active} startsAt={b.startsAt} endsAt={b.endsAt} now={now} className="shrink-0" />
        </div>
        <dl className="mt-auto space-y-1 text-[13px]">
          <div className="flex gap-2">
            <dt className="shrink-0 text-subtle">Botão</dt>
            <dd className="min-w-0 truncate text-muted-foreground">
              {b.ctaLabel ? `“${b.ctaLabel}”` : "Sem botão"} · {linkText}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-subtle">Período</dt>
            <dd className="tabular min-w-0 truncate text-muted-foreground">{periodText(b.startsAt, b.endsAt, "Sempre")}</dd>
          </div>
        </dl>
      </div>
      <div className="border-t border-border p-1.5">
        <BannerActions id={b.id} title={b.title} active={b.active} first={index === 0} last={index === total - 1} />
      </div>
    </li>
  );
}
