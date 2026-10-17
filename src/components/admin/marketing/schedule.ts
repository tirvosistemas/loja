import type { Tone } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

// Situação de algo com período (banner, promoção, cupom) e textos de período.
// Funções puras: servem no servidor e no navegador.

export type ScheduleState = "active" | "scheduled" | "ended" | "inactive";

type DateLike = Date | string | null | undefined;
const toDate = (d: DateLike) => (d ? new Date(d) : null);

export function scheduleState(item: { active: boolean; startsAt?: DateLike; endsAt?: DateLike }, now = new Date()): ScheduleState {
  const end = toDate(item.endsAt);
  if (end && end <= now) return "ended";
  if (!item.active) return "inactive";
  const start = toDate(item.startsAt);
  if (start && start > now) return "scheduled";
  return "active";
}

export const SCHEDULE_LABEL: Record<ScheduleState, { m: string; f: string; tone: Tone }> = {
  active: { m: "Ativo", f: "Ativa", tone: "success" },
  scheduled: { m: "Agendado", f: "Agendada", tone: "info" },
  ended: { m: "Encerrado", f: "Encerrada", tone: "neutral" },
  inactive: { m: "Inativo", f: "Inativa", tone: "warning" },
};

/** "17/10 14:00 → 20/10 23:59", "A partir de 17/10/26 14:00", "Até 20/10/26 23:59" ou "Sem prazo". */
export function periodText(startsAt: DateLike, endsAt: DateLike, empty = "Sem prazo") {
  const s = toDate(startsAt);
  const e = toDate(endsAt);
  if (s && e) return `${formatDateTime(s)} → ${formatDateTime(e)}`;
  if (s) return `A partir de ${formatDateTime(s)}`;
  if (e) return `Até ${formatDateTime(e)}`;
  return empty;
}

/** Texto curto para a dica de situação (ex.: "Começa em 20/10/26"). */
export function scheduleHint(item: { active: boolean; startsAt?: DateLike; endsAt?: DateLike }, now = new Date()) {
  const state = scheduleState(item, now);
  const s = toDate(item.startsAt);
  const e = toDate(item.endsAt);
  if (state === "scheduled" && s) return `Começa em ${formatDateTime(s)}`;
  if (state === "ended" && e) return `Terminou em ${formatDate(e)}`;
  if (state === "active" && e) return `Termina em ${formatDateTime(e)}`;
  if (state === "inactive") return "Não está no ar";
  return "Sem data de término";
}

/** "18/10/26 16:58" — data curta para tabelas. */
export function shortDateTime(d: Date | string) {
  return formatDate(d, { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "");
}
