import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SCHEDULE_LABEL, scheduleHint, scheduleState, type ScheduleState } from "./schedule";

const DOT: Record<ScheduleState, string> = {
  active: "bg-success animate-pulse-dot",
  scheduled: "bg-info",
  ended: "bg-subtle",
  inactive: "bg-warning",
};

/** Selo Ativo / Agendado / Encerrado / Inativo, calculado do período. */
export function ScheduleStatus({
  active,
  startsAt,
  endsAt,
  feminine,
  now,
  className,
}: {
  active: boolean;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  /** "Ativa / Agendada…" (promoção). */
  feminine?: boolean;
  now?: Date;
  className?: string;
}) {
  const item = { active, startsAt, endsAt };
  const state = scheduleState(item, now);
  const info = SCHEDULE_LABEL[state];
  return (
    <Badge tone={info.tone} className={cn("gap-1.5", className)} title={scheduleHint(item, now)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", DOT[state])} />
      {feminine ? info.f : info.m}
    </Badge>
  );
}
