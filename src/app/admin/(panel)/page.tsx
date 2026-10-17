import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarDays, CircleDollarSign, Inbox, Package, PackageX, Receipt, ShoppingBag, TrendingUp } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { ORDER_STATUS_LABEL, type Tone } from "@/lib/constants";
import { formatBRL, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/admin/page-header";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SmartImage } from "@/components/ui/smart-image";
import { OrdersTable } from "@/components/admin/orders/orders-table";
import { STORE_TZ, spHour } from "@/components/admin/orders/time";
import { SalesChart } from "@/components/admin/dashboard/sales-chart";
import { SetupChecklist } from "@/components/admin/dashboard/setup-checklist";
import { getDashboardData } from "@/components/admin/dashboard/data";

export const metadata: Metadata = { title: "Painel" };

const CHECKLIST_TOTAL = 6;
const STATUS_ORDER = ["NEW", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "DELIVERED", "CANCELED"];
const BAR: Record<Tone, string> = {
  neutral: "bg-subtle",
  accent: "bg-primary",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

function greeting(hour: number) {
  if (hour < 5) return "Boa noite";
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireAdmin();
  const [sp, data] = await Promise.all([searchParams, getDashboardData()]);
  const now = new Date();
  const firstName = session.name.trim().split(/\s+/)[0] || session.name;
  const dateText = new Intl.DateTimeFormat("pt-BR", { timeZone: STORE_TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
  const noPermission = (Array.isArray(sp.erro) ? sp.erro[0] : sp.erro) === "permissao";
  const { stats } = data;
  const statusMax = Math.max(1, ...data.byStatus.map((s) => s.count));
  const statusTotal = data.byStatus.reduce((n, s) => n + s.count, 0);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.16em] text-subtle">
            <CalendarDays className="size-3.5" aria-hidden /> {dateText}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[28px]">
            {greeting(spHour(now))}, {firstName}
            <span className="text-primary">.</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Veja como está a {data.storeName || "loja"} hoje.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/pedidos?status=NEW" className={buttonVariants({ variant: stats.newOrders > 0 ? "primary" : "secondary" })}>
            <Inbox aria-hidden />
            {stats.newOrders > 0 ? `${pluralize(stats.newOrders, "pedido novo", "pedidos novos")}` : "Pedidos"}
          </Link>
        </div>
      </div>

      {noPermission && (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <p>
            <span className="font-medium">Acesso restrito.</span> <span className="text-muted-foreground">Sua conta não tem permissão para abrir aquela página. Fale com o dono da loja.</span>
          </p>
        </div>
      )}

      {/* Editores não acessam as configurações: o checklist é para dono e administradores. */}
      {session.role !== "EDITOR" && data.checklist.length > 0 && (
        <div className="mb-6">
          <SetupChecklist items={data.checklist} total={CHECKLIST_TOTAL} />
        </div>
      )}

      <section aria-label="Resumo" className="mb-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Faturamento hoje" value={formatBRL(stats.today.cents)} icon={<CircleDollarSign />} trend={stats.today.trend} hint={stats.today.trend ? "vs. ontem" : pluralize(stats.today.count, "pedido", "pedidos")} />
        <StatCard label="Últimos 7 dias" value={formatBRL(stats.week.cents)} icon={<TrendingUp />} trend={stats.week.trend} hint={stats.week.trend ? "vs. 7 dias antes" : pluralize(stats.week.count, "pedido", "pedidos")} />
        <StatCard label="Últimos 30 dias" value={formatBRL(stats.month.cents)} icon={<TrendingUp />} trend={stats.month.trend} hint={stats.month.trend ? "vs. 30 dias antes" : pluralize(stats.month.count, "pedido", "pedidos")} />
        <Link href="/admin/pedidos?status=NEW" className="rounded-2xl transition-shadow hover:ring-1 hover:ring-border-strong focus-visible:ring-2 focus-visible:ring-primary">
          <StatCard label="Pedidos novos" value={stats.newOrders.toLocaleString("pt-BR")} icon={<ShoppingBag />} hint={stats.newOrders > 0 ? "aguardando confirmação" : "nada pendente"} />
        </Link>
        <StatCard label="Ticket médio" value={formatBRL(stats.avgTicket.cents)} icon={<Receipt />} trend={stats.avgTicket.trend} hint="últimos 30 dias" />
        <StatCard
          label="Produtos ativos"
          value={stats.activeProducts.toLocaleString("pt-BR")}
          icon={<Package />}
          hint={stats.lowStockCount > 0 ? <span className="text-warning">{pluralize(stats.lowStockCount, "com estoque baixo", "com estoque baixo")}</span> : "estoque em dia"}
        />
      </section>

      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader title="Vendas · últimos 30 dias" description={`${formatBRL(stats.month.cents)} em ${pluralize(stats.month.count, "pedido", "pedidos")} não cancelados`} />
          <CardBody className="pt-3">
            <SalesChart data={data.series} />
          </CardBody>
        </Card>

        <Card className="min-w-0">
          <CardHeader title="Pedidos por status" description="Últimos 30 dias" />
          <CardBody>
            {statusTotal === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pedido nos últimos 30 dias.</p>
            ) : (
              <ul className="space-y-3.5">
                {STATUS_ORDER.map((st) => {
                  const count = data.byStatus.find((s) => s.status === st)?.count ?? 0;
                  const meta = ORDER_STATUS_LABEL[st];
                  return (
                    <li key={st}>
                      <Link href={`/admin/pedidos?status=${st}&periodo=30d`} className="group block rounded-lg focus-visible:outline-offset-4">
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                          <span className="text-muted-foreground group-hover:text-foreground">{meta.label}</span>
                          <span className="tabular font-medium">{count}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-full rounded-full", BAR[meta.tone], count === 0 && "opacity-0")} style={{ width: `${Math.max(count ? 4 : 0, (count / statusMax) * 100)}%` }} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section aria-labelledby="ultimos-pedidos" className="min-w-0 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="ultimos-pedidos" className="text-base font-semibold">
              Últimos pedidos
            </h2>
            <Link href="/admin/pedidos" className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground">
              Ver todos <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          {data.latest.length === 0 ? (
            <EmptyState icon={<ShoppingBag />} title="Nenhum pedido ainda" description="Quando alguém comprar pelo site, o pedido aparece aqui e chega no WhatsApp da loja." />
          ) : (
            <OrdersTable orders={data.latest} compact />
          )}
        </section>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Mais vendidos" description="Unidades nos últimos 30 dias" />
            {data.top.length === 0 ? (
              <CardBody>
                <p className="py-4 text-center text-sm text-muted-foreground">As vendas dos últimos 30 dias aparecem aqui.</p>
              </CardBody>
            ) : (
              <ol className="divide-y divide-border">
                {data.top.map((p, i) => (
                  <li key={p.id}>
                    <Link href={`/admin/produtos?q=${encodeURIComponent(p.name)}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-elevated/50">
                      <span className="tabular w-4 shrink-0 font-mono text-xs text-subtle">{i + 1}</span>
                      <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-well">
                        <SmartImage src={p.image} alt="" size="sm" sizes="40px" className="size-full object-contain p-1" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-sm font-medium">{p.name}</span>
                        <span className="tabular text-xs text-subtle">{formatBRL(p.revenueCents)}</span>
                      </span>
                      <span className="tabular shrink-0 text-sm font-semibold">{p.quantity} un.</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Estoque baixo"
              description={stats.lowStockCount > 0 ? pluralize(stats.lowStockCount, "item precisa de reposição", "itens precisam de reposição") : "Nenhum item abaixo do alerta"}
            />
            {data.lowStock.length === 0 ? (
              <CardBody>
                <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                  <Package className="size-4 text-success" aria-hidden /> Estoque em dia.
                </p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-border">
                {data.lowStock.map((it) => (
                  <li key={it.key}>
                    <Link href={`/admin/produtos?q=${encodeURIComponent(it.name)}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-elevated/50">
                      <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-well">
                        <SmartImage src={it.image} alt="" size="sm" sizes="40px" className="size-full object-contain p-1" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 text-sm font-medium">{it.name}</span>
                        <span className="text-xs text-subtle">{it.variant ? `${it.variant} · ` : ""}alerta em {it.alert}</span>
                      </span>
                      {it.stock <= 0 ? (
                        <Badge tone="danger">
                          <PackageX aria-hidden /> Esgotado
                        </Badge>
                      ) : (
                        <Badge tone="warning">{it.stock} un.</Badge>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
