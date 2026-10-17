// Formatação pt-BR. Seguro para servidor e cliente.

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 129990 → "R$ 1.299,90" */
export function formatBRL(cents: number): string {
  return brl.format((cents || 0) / 100).replace(/ /g, " ");
}

/** "1.299,90" | "1299.90" | "R$ 1.299,90" → 129990 (null se inválido) */
export function parseBRL(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input === "number") return Math.round(input * 100);
  let s = input.replace(/[^\d,.-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  // "1.299" e "1.299.900" são milhares (pt-BR), não decimais.
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/\d/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function formatKm(km: number): string {
  return `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: km < 10 ? 1 : 0 })} km`;
}

/** "41999998888" → "(41) 99999-8888" */
export function formatPhone(value: string): string {
  const d = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return value;
}

/** "80010000" → "80010-000" */
export function formatCep(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function formatDate(date: Date | string, opts: Intl.DateTimeFormatOptions = { dateStyle: "short" }) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...opts }).format(new Date(date));
}

export function formatDateTime(date: Date | string) {
  return formatDate(date, { dateStyle: "short", timeStyle: "short" });
}

export function pluralize(n: number, one: string, many: string) {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;
}

/** Valor de cada parcela, sem juros. */
export function installmentText(totalCents: number, maxInstallments: number, minInstallmentCents: number) {
  if (maxInstallments <= 1 || totalCents < minInstallmentCents * 2) return null;
  const n = Math.max(1, Math.min(maxInstallments, Math.floor(totalCents / Math.max(1, minInstallmentCents))));
  if (n <= 1) return null;
  return { count: n, valueCents: Math.ceil(totalCents / n) };
}
