import { db } from "@/lib/db";
import { getSettings, stripeIsReady } from "@/lib/settings";
import { cancelExpiredStripeOrders } from "@/lib/orders/status";
import { addDays, spDateKey, startOfTodaySP, STORE_TZ } from "@/components/admin/orders/time";
import type { SalesPoint } from "./sales-chart";

// Números do painel inicial. Faturamento = soma dos pedidos não cancelados, no fuso da loja.

export type Trend = { value: string; positive: boolean } | undefined;

function trend(current: number, previous: number): Trend {
  if (previous <= 0) return undefined;
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.abs(pct) >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10;
  return { value: `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded).toLocaleString("pt-BR")}%`, positive: pct >= 0 };
}

const labelFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: STORE_TZ, day: "2-digit", month: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: STORE_TZ, weekday: "short" });

export type ChecklistItem = { id: string; title: string; description: string; href: string; cta: string };

export async function getDashboardData(now = new Date()) {
  await cancelExpiredStripeOrders();
  const today = startOfTodaySP(now);
  const yesterday = addDays(today, -1);
  const d7 = addDays(today, -6);
  const prev7 = addDays(today, -13);
  const d30 = addDays(today, -29);
  const prev30 = addDays(today, -59);

  const [recent, newOrders, byStatus, top, latest, activeProducts, totalProducts, tracked, banners, shippingRow, settings] = await Promise.all([
    db.order.findMany({ where: { createdAt: { gte: prev30 }, status: { not: "CANCELED" } }, select: { createdAt: true, totalCents: true } }),
    db.order.count({ where: { status: "NEW" } }),
    db.order.groupBy({ by: ["status"], where: { createdAt: { gte: d30 } }, _count: { _all: true } }),
    db.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { not: null }, order: { createdAt: { gte: d30 }, status: { not: "CANCELED" } } },
      _sum: { quantity: true, totalCents: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        code: true,
        customerName: true,
        customerPhone: true,
        city: true,
        totalCents: true,
        paymentMethod: true,
        paymentStatus: true,
        status: true,
        deliveryType: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    db.product.count({ where: { status: "ACTIVE" } }),
    db.product.count(),
    db.product.findMany({
      where: { status: "ACTIVE", trackStock: true },
      select: {
        id: true,
        name: true,
        stock: true,
        lowStockAlert: true,
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
        variants: { where: { active: true }, select: { id: true, name: true, stock: true } },
      },
    }),
    db.banner.count(),
    db.setting.findUnique({ where: { key: "shipping" }, select: { key: true } }),
    getSettings(),
  ]);

  // ───────── Faturamento por período
  const sum = (from: Date, to?: Date) => {
    let cents = 0;
    let count = 0;
    for (const o of recent) {
      if (o.createdAt >= from && (!to || o.createdAt < to)) {
        cents += o.totalCents;
        count++;
      }
    }
    return { cents, count };
  };
  // O período anterior para no mesmo ponto do atual (ontem até esta hora, não o dia inteiro),
  // senão a comparação de hoje começa o dia sempre em queda.
  const ago = (days: number) => addDays(now, -days);
  const todayRev = sum(today);
  const yesterdayRev = sum(yesterday, ago(1));
  const rev7 = sum(d7);
  const revPrev7 = sum(prev7, ago(7));
  const rev30 = sum(d30);
  const revPrev30 = sum(prev30, ago(30));
  const avg30 = rev30.count ? Math.round(rev30.cents / rev30.count) : 0;
  const avgPrev30 = revPrev30.count ? Math.round(revPrev30.cents / revPrev30.count) : 0;

  // ───────── Série diária (30 dias)
  const byDay = new Map<string, { cents: number; orders: number }>();
  for (const o of recent) {
    if (o.createdAt < d30) continue;
    const k = spDateKey(o.createdAt);
    const cur = byDay.get(k) ?? { cents: 0, orders: 0 };
    cur.cents += o.totalCents;
    cur.orders++;
    byDay.set(k, cur);
  }
  const series: SalesPoint[] = [];
  for (let i = 0; i < 30; i++) {
    const day = addDays(d30, i);
    const key = spDateKey(day);
    const v = byDay.get(key);
    series.push({
      date: key,
      label: labelFmt.format(day),
      weekday: weekdayFmt.format(day).replace(".", ""),
      revenueCents: v?.cents ?? 0,
      orders: v?.orders ?? 0,
    });
  }

  // ───────── Mais vendidos
  const topIds = top.map((t) => t.productId).filter((id): id is string => !!id);
  const topProducts = topIds.length
    ? await db.product.findMany({
        where: { id: { in: topIds } },
        select: { id: true, name: true, slug: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } } },
      })
    : [];
  const topList = top
    .map((t) => {
      const p = topProducts.find((x) => x.id === t.productId);
      return p ? { id: p.id, name: p.name, slug: p.slug, image: p.images[0]?.url ?? null, quantity: t._sum.quantity ?? 0, revenueCents: t._sum.totalCents ?? 0 } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  // ───────── Estoque baixo (produto sem variações ou cada variação ativa)
  const low: { key: string; productId: string; name: string; variant: string | null; stock: number; alert: number; image: string | null }[] = [];
  for (const p of tracked) {
    if (p.variants.length) {
      for (const v of p.variants) {
        if (v.stock <= p.lowStockAlert) low.push({ key: `${p.id}:${v.id}`, productId: p.id, name: p.name, variant: v.name, stock: v.stock, alert: p.lowStockAlert, image: p.images[0]?.url ?? null });
      }
    } else if (p.stock <= p.lowStockAlert) {
      low.push({ key: p.id, productId: p.id, name: p.name, variant: null, stock: p.stock, alert: p.lowStockAlert, image: p.images[0]?.url ?? null });
    }
  }
  low.sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, "pt-BR"));

  // ───────── Configure sua loja
  const checklist: ChecklistItem[] = [];
  if (!/^55\d{10,11}$/.test(settings.store.whatsapp)) {
    checklist.push({
      id: "whatsapp",
      title: "WhatsApp de pedidos",
      description: "Cadastre o número que recebe os pedidos do site.",
      href: "/admin/configuracoes?aba=loja",
      cta: "Cadastrar",
    });
  }
  if (settings.address.lat == null || settings.address.lng == null) {
    checklist.push({
      id: "address",
      title: "Endereço da loja no mapa",
      description: "O frete por km sai deste ponto. Salve o endereço para localizarmos.",
      href: "/admin/configuracoes?aba=endereco",
      cta: "Localizar",
    });
  }
  if (settings.shipping.enabled && (!shippingRow || settings.shipping.pricePerKmCents <= 0)) {
    checklist.push({
      id: "shipping",
      title: "Preço do frete por km",
      description: "Confira o preço por km, a taxa de saída e o frete grátis.",
      href: "/admin/configuracoes?aba=frete",
      cta: "Revisar",
    });
  }
  if (settings.payment.stripeEnabled && !stripeIsReady(settings)) {
    checklist.push({
      id: "stripe",
      title: "Chaves da Stripe",
      description: "O pagamento online está ligado, mas faltam as chaves.",
      href: "/admin/configuracoes?aba=integracoes",
      cta: "Cadastrar chaves",
    });
  } else if (!settings.payment.stripeEnabled) {
    checklist.push({
      id: "online",
      title: "Ative pagamentos online",
      description: "Receba por cartão, Pix e boleto com confirmação automática.",
      href: "/admin/configuracoes?aba=pagamentos",
      cta: "Ativar",
    });
  }
  if (banners === 0) {
    checklist.push({ id: "banners", title: "Banners da página inicial", description: "Destaque ofertas e novidades no topo da loja.", href: "/admin/banners", cta: "Criar banner" });
  }
  if (totalProducts === 0) {
    checklist.push({ id: "product", title: "Primeiro produto", description: "Cadastre os produtos para começar a vender.", href: "/admin/produtos", cta: "Cadastrar" });
  }

  return {
    stats: {
      today: { cents: todayRev.cents, count: todayRev.count, trend: trend(todayRev.cents, yesterdayRev.cents) },
      week: { cents: rev7.cents, count: rev7.count, trend: trend(rev7.cents, revPrev7.cents) },
      month: { cents: rev30.cents, count: rev30.count, trend: trend(rev30.cents, revPrev30.cents) },
      avgTicket: { cents: avg30, trend: trend(avg30, avgPrev30) },
      newOrders,
      activeProducts,
      lowStockCount: low.length,
    },
    series,
    byStatus: byStatus.map((g) => ({ status: g.status as string, count: g._count._all })),
    top: topList,
    latest: latest.map(({ _count, ...o }) => ({ ...o, itemCount: _count.items })),
    lowStock: low.slice(0, 6),
    checklist,
    storeName: settings.store.name,
  };
}
