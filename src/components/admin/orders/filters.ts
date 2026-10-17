import type { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { onlyDigits } from "@/lib/utils";
import { addDays, isDateKey, spDayStart, startOfTodaySP } from "./time";

// Filtros da lista de pedidos, lidos da URL. Usados pela página e pela exportação em CSV,
// para a planilha sair exatamente com o que está na tela.

export const ORDER_STATUSES: OrderStatus[] = ["NEW", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "DELIVERED", "CANCELED"];
export const PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "PAID", "FAILED", "EXPIRED", "REFUNDED"];
export const PAYMENT_METHODS: PaymentMethod[] = ["ONLINE_STRIPE", "PIX_MANUAL", "PIX_ON_DELIVERY", "CARD_ON_DELIVERY", "CASH_ON_DELIVERY"];

export const ORDER_TABS: { status: OrderStatus | null; label: string }[] = [
  { status: null, label: "Todos" },
  { status: "NEW", label: "Novos" },
  { status: "CONFIRMED", label: "Confirmados" },
  { status: "PREPARING", label: "Em separação" },
  { status: "OUT_FOR_DELIVERY", label: "Saiu para entrega" },
  { status: "READY_FOR_PICKUP", label: "Prontos p/ retirada" },
  { status: "DELIVERED", label: "Entregues" },
  { status: "CANCELED", label: "Cancelados" },
];

export const PERIODS = [
  { value: "hoje", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "personalizado", label: "Personalizado" },
] as const;

export type Period = (typeof PERIODS)[number]["value"];

export const ORDERS_PER_PAGE = 20;

export type OrderFilters = {
  status: OrderStatus | null;
  paymentStatus: PaymentStatus | null;
  paymentMethod: PaymentMethod | null;
  period: Period | null;
  from: string | null;
  to: string | null;
  q: string;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function pick(sp: RawParams, key: string): string {
  const v = sp instanceof URLSearchParams ? sp.get(key) : sp[key];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
}

function oneOf<T extends string>(list: readonly T[], v: string): T | null {
  return (list as readonly string[]).includes(v) ? (v as T) : null;
}

export function parseOrderFilters(sp: RawParams): OrderFilters {
  const period = oneOf(
    PERIODS.map((p) => p.value),
    pick(sp, "periodo"),
  );
  const from = pick(sp, "de");
  const to = pick(sp, "ate");
  const page = Number.parseInt(pick(sp, "page"), 10);
  return {
    status: oneOf(ORDER_STATUSES, pick(sp, "status")),
    paymentStatus: oneOf(PAYMENT_STATUSES, pick(sp, "pagamento")),
    paymentMethod: oneOf(PAYMENT_METHODS, pick(sp, "forma")),
    period,
    from: period === "personalizado" && isDateKey(from) ? from : null,
    to: period === "personalizado" && isDateKey(to) ? to : null,
    q: pick(sp, "q").slice(0, 80),
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
  };
}

/** Intervalo [gte, lt) do período escolhido, no fuso da loja. */
export function periodRange(f: Pick<OrderFilters, "period" | "from" | "to">, now = new Date()): { gte?: Date; lt?: Date } | null {
  const today = startOfTodaySP(now);
  switch (f.period) {
    case "hoje":
      return { gte: today };
    case "7d":
      return { gte: addDays(today, -6) };
    case "30d":
      return { gte: addDays(today, -29) };
    case "personalizado": {
      if (!f.from && !f.to) return null;
      let from = f.from;
      let to = f.to;
      if (from && to && from > to) [from, to] = [to, from];
      return {
        ...(from ? { gte: spDayStart(from) } : {}),
        ...(to ? { lt: addDays(spDayStart(to), 1) } : {}),
      };
    }
    default:
      return null;
  }
}

export function orderWhere(f: OrderFilters, opts: { ignoreStatus?: boolean } = {}): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  if (f.status && !opts.ignoreStatus) and.push({ status: f.status });
  if (f.paymentStatus) and.push({ paymentStatus: f.paymentStatus });
  if (f.paymentMethod) and.push({ paymentMethod: f.paymentMethod });
  const range = periodRange(f);
  if (range) and.push({ createdAt: range });
  if (f.q) {
    const q = f.q.replace(/^#/, "");
    const digits = onlyDigits(q);
    const or: Prisma.OrderWhereInput[] = [{ code: { contains: q.toUpperCase() } }, { customerName: { contains: q } }, { customerEmail: { contains: q } }];
    if (digits.length >= 3) {
      // Aceita o número com ou sem o 55 do Brasil.
      const local = digits.length >= 12 && digits.startsWith("55") ? digits.slice(2) : digits;
      or.push({ customerPhone: { contains: local } });
    }
    and.push({ OR: or });
  }
  return and.length ? { AND: and } : {};
}

/** Monta a query string a partir dos filtros (com alterações). Sem a página quando for 1. */
export function filtersQuery(f: OrderFilters, patch: Partial<OrderFilters> = {}): string {
  const n = { ...f, ...patch };
  const sp = new URLSearchParams();
  if (n.status) sp.set("status", n.status);
  if (n.paymentStatus) sp.set("pagamento", n.paymentStatus);
  if (n.paymentMethod) sp.set("forma", n.paymentMethod);
  if (n.period) sp.set("periodo", n.period);
  if (n.period === "personalizado") {
    if (n.from) sp.set("de", n.from);
    if (n.to) sp.set("ate", n.to);
  }
  if (n.q) sp.set("q", n.q);
  if (n.page > 1) sp.set("page", String(n.page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function hasActiveFilters(f: OrderFilters) {
  return !!(f.paymentStatus || f.paymentMethod || f.period || f.q);
}
