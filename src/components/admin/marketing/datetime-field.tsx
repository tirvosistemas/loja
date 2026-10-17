"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Data e hora no fuso da loja (America/Sao_Paulo), guardadas em ISO (UTC).

const TZ = "America/Sao_Paulo";
const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function localParts(d: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value])) as Record<string, string>;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
}

/** Diferença (ms) entre o horário de São Paulo e o UTC naquele instante. */
function offsetMs(d: Date) {
  const p = localParts(d);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(d.getTime() / 1000) * 1000;
}

/** ISO → "2026-10-17T14:30" (horário de São Paulo), para o campo datetime-local. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = localParts(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** "2026-10-17T14:30" (São Paulo) → ISO em UTC. */
export function localInputToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let t = guess - offsetMs(new Date(guess));
  const second = offsetMs(new Date(t));
  if (guess - second !== t) t = guess - second;
  return new Date(t).toISOString();
}

/** Atalhos para o fim do período, a partir de agora. */
function endOfTodayIso() {
  const today = isoToLocalInput(new Date().toISOString()).slice(0, 10);
  return localInputToIso(`${today}T23:59`);
}

const QUICK = {
  start: [{ label: "Agora", get: () => new Date(Math.floor(Date.now() / 60000) * 60000).toISOString() }],
  end: [
    { label: "Hoje 23:59", get: endOfTodayIso },
    { label: "+24 h", get: () => new Date(Math.ceil(Date.now() / 60000) * 60000 + 86_400_000).toISOString() },
    { label: "+7 dias", get: () => new Date(Math.ceil(Date.now() / 60000) * 60000 + 7 * 86_400_000).toISOString() },
  ],
};

/** Campo de data e hora (horário de Brasília) com botão para limpar e atalhos opcionais. */
export function DateTimeField({
  id,
  value,
  onChange,
  quick,
  invalid,
  describedBy,
  className,
}: {
  id?: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  quick?: "start" | "end";
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}) {
  const local = isoToLocalInput(value);
  return (
    <div className={className}>
      <div className="relative">
        <input
          id={id}
          type="datetime-local"
          value={local}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value ? localInputToIso(e.target.value) : null)}
          className={cn(
            "tabular h-11 w-full rounded-xl border border-input bg-card px-3.5 text-[15px] text-foreground transition-colors hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 aria-[invalid=true]:border-danger",
            value && "pr-11",
            !value && "text-subtle",
          )}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Limpar data"
            title="Limpar data"
            className="absolute right-0.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-subtle hover:bg-elevated hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {quick && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK[quick].map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => onChange(q.get())}
              className="h-10 rounded-lg border border-border px-3 text-xs sm:h-8 sm:px-2.5 text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
            >
              {q.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
