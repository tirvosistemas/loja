// Datas no fuso da loja (America/Sao_Paulo). Brasília está em UTC−3 o ano todo desde 2019
// (sem horário de verão), então o início do dia local é 03:00 UTC.

export const STORE_TZ = "America/Sao_Paulo";
const OFFSET_HOURS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: STORE_TZ, hour: "2-digit", hour12: false });

/** "2026-10-17" no fuso da loja. */
export function spDateKey(d: Date): string {
  return keyFmt.format(d);
}

/** Valida "AAAA-MM-DD". */
export function isDateKey(v: string | null | undefined): v is string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Início (00:00 local) do dia "AAAA-MM-DD". */
export function spDayStart(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, OFFSET_HOURS));
}

export function startOfTodaySP(now = new Date()): Date {
  return spDayStart(spDateKey(now));
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

export function spHour(d = new Date()): number {
  return Number(hourFmt.format(d)) % 24;
}
