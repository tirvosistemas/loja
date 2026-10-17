import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { onlyDigits } from "@/lib/utils";

// Clientes não têm cadastro: são agrupados pelos pedidos, usando o WhatsApp como chave.
// Valor gasto e pedidos válidos ignoram os cancelados.

export const CUSTOMER_SORTS = [
  { value: "gasto", label: "Maior gasto" },
  { value: "pedidos", label: "Mais pedidos" },
  { value: "recente", label: "Compra mais recente" },
] as const;

export type CustomerSort = (typeof CUSTOMER_SORTS)[number]["value"];
export const CUSTOMERS_PER_PAGE = 20;

export type CustomerRow = {
  phone: string;
  name: string;
  email: string | null;
  city: string | null;
  orders: number;
  validOrders: number;
  spentCents: number;
  lastOrderAt: Date;
  firstOrderAt: Date;
};

type RawRow = {
  phone: string;
  orders: bigint | number;
  validOrders: bigint | number | Prisma.Decimal | null;
  spent: bigint | number | Prisma.Decimal | null;
  lastOrderAt: Date;
  firstOrderAt: Date;
};

const num = (v: unknown) => (v == null ? 0 : Number(String(v)));

/** Telefone da URL/busca → só dígitos, sem o 55 do Brasil (como fica no pedido). */
export function normalizePhone(raw: string) {
  const d = onlyDigits(raw);
  return d.length >= 12 && d.startsWith("55") ? d.slice(2) : d;
}

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const ORDER_BY: Record<CustomerSort, Prisma.Sql> = {
  gasto: Prisma.sql`spent DESC, lastOrderAt DESC`,
  pedidos: Prisma.sql`validOrders DESC, spent DESC`,
  recente: Prisma.sql`lastOrderAt DESC`,
};

export async function listCustomers({ q, sort, page }: { q: string; sort: CustomerSort; page: number }) {
  const term = q.trim().slice(0, 80);
  let where = Prisma.empty;
  if (term) {
    const like = `%${escapeLike(term)}%`;
    const conds = [Prisma.sql`customerName LIKE ${like}`, Prisma.sql`customerEmail LIKE ${like}`];
    const digits = normalizePhone(term);
    if (digits.length >= 3) conds.push(Prisma.sql`customerPhone LIKE ${`%${digits}%`}`);
    // Filtra pelo cliente (qualquer pedido bate na busca), mas soma todos os pedidos dele.
    where = Prisma.sql`WHERE customerPhone IN (SELECT customerPhone FROM \`Order\` WHERE ${Prisma.join(conds, " OR ")})`;
  }

  const [countRows] = await db.$queryRaw<{ total: bigint | number }[]>`SELECT COUNT(DISTINCT customerPhone) AS total FROM \`Order\` ${where}`;
  const total = num(countRows?.total);
  const pageCount = Math.max(1, Math.ceil(total / CUSTOMERS_PER_PAGE));
  const current = Math.min(Math.max(1, page), pageCount);

  const rows = total
    ? await db.$queryRaw<RawRow[]>`
        SELECT customerPhone AS phone,
               COUNT(*) AS orders,
               SUM(CASE WHEN status <> 'CANCELED' THEN 1 ELSE 0 END) AS validOrders,
               SUM(CASE WHEN status <> 'CANCELED' THEN totalCents ELSE 0 END) AS spent,
               MAX(createdAt) AS lastOrderAt,
               MIN(createdAt) AS firstOrderAt
        FROM \`Order\`
        ${where}
        GROUP BY customerPhone
        ORDER BY ${ORDER_BY[sort]}
        LIMIT ${Prisma.raw(String(CUSTOMERS_PER_PAGE))} OFFSET ${Prisma.raw(String((current - 1) * CUSTOMERS_PER_PAGE))}`
    : [];

  const phones = rows.map((r) => r.phone);
  const details = phones.length
    ? await db.order.findMany({
        where: { customerPhone: { in: phones } },
        orderBy: { createdAt: "desc" },
        select: { customerPhone: true, customerName: true, customerEmail: true, city: true },
      })
    : [];
  const info = new Map<string, { name: string; email: string | null; city: string | null }>();
  for (const d of details) {
    const cur = info.get(d.customerPhone);
    if (!cur) info.set(d.customerPhone, { name: d.customerName, email: d.customerEmail, city: d.city });
    else {
      // Pedido mais recente manda; e-mail e cidade vêm do último pedido que tiver.
      if (!cur.email && d.customerEmail) cur.email = d.customerEmail;
      if (!cur.city && d.city) cur.city = d.city;
    }
  }

  const customers: CustomerRow[] = rows.map((r) => ({
    phone: r.phone,
    name: info.get(r.phone)?.name ?? "Cliente",
    email: info.get(r.phone)?.email ?? null,
    city: info.get(r.phone)?.city ?? null,
    orders: num(r.orders),
    validOrders: num(r.validOrders),
    spentCents: num(r.spent),
    lastOrderAt: new Date(r.lastOrderAt),
    firstOrderAt: new Date(r.firstOrderAt),
  }));

  return { customers, total, page: current, pageCount };
}

export async function getCustomer(phoneRaw: string) {
  const phone = normalizePhone(phoneRaw);
  if (phone.length < 10 || phone.length > 13) return null;
  const orders = await db.order.findMany({
    where: { customerPhone: phone },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      code: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      customerDoc: true,
      city: true,
      street: true,
      number: true,
      complement: true,
      neighborhood: true,
      state: true,
      cep: true,
      totalCents: true,
      paymentMethod: true,
      paymentStatus: true,
      status: true,
      deliveryType: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  });
  if (orders.length === 0) return null;
  const valid = orders.filter((o) => o.status !== "CANCELED");
  const spentCents = valid.reduce((n, o) => n + o.totalCents, 0);
  const latest = orders[0];
  const addresses = new Map<string, { line: string; city: string; cep: string | null; count: number }>();
  for (const o of orders) {
    if (o.deliveryType !== "DELIVERY" || !o.street) continue;
    const line = [[o.street, o.number].filter(Boolean).join(", "), o.complement, o.neighborhood].filter(Boolean).join(" · ");
    const key = `${line}|${o.city}`.toLowerCase();
    const cur = addresses.get(key);
    if (cur) cur.count++;
    else addresses.set(key, { line, city: [o.city, o.state].filter(Boolean).join("/"), cep: o.cep, count: 1 });
  }
  return {
    phone,
    name: latest.customerName,
    email: orders.find((o) => o.customerEmail)?.customerEmail ?? null,
    doc: orders.find((o) => o.customerDoc)?.customerDoc ?? null,
    orders,
    validCount: valid.length,
    spentCents,
    averageCents: valid.length ? Math.round(spentCents / valid.length) : 0,
    firstOrderAt: orders[orders.length - 1].createdAt,
    lastOrderAt: latest.createdAt,
    addresses: [...addresses.values()].sort((a, b) => b.count - a.count),
  };
}
