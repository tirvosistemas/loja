import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download, ShoppingBag } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { cancelExpiredStripeOrders } from "@/lib/orders/status";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import { SearchBox } from "@/components/admin/search-box";
import { EmptyState, Skeleton } from "@/components/ui/card";
import { Pagination } from "@/components/ui/nav";
import { buttonVariants } from "@/components/ui/button";
import { OrderFiltersBar } from "@/components/admin/orders/order-filters";
import { OrdersTable, type OrderRow } from "@/components/admin/orders/orders-table";
import { ORDER_TABS, ORDERS_PER_PAGE, filtersQuery, hasActiveFilters, orderWhere, parseOrderFilters } from "@/components/admin/orders/filters";

export const metadata: Metadata = { title: "Pedidos" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  // Pagamentos online abandonados viram cancelados (e devolvem o estoque) antes de listar.
  await cancelExpiredStripeOrders();
  const filters = parseOrderFilters(await searchParams);
  const where = orderWhere(filters);

  const [total, byStatus] = await Promise.all([
    db.order.count({ where }),
    db.order.groupBy({ by: ["status"], where: orderWhere(filters, { ignoreStatus: true }), _count: { _all: true } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / ORDERS_PER_PAGE));
  const page = Math.min(filters.page, pageCount);

  const rows = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * ORDERS_PER_PAGE,
    take: ORDERS_PER_PAGE,
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
  });
  const orders: OrderRow[] = rows.map(({ _count, ...o }) => ({ ...o, itemCount: _count.items }));

  const counts = new Map(byStatus.map((g) => [g.status as string, g._count._all]));
  const allCount = byStatus.reduce((n, g) => n + g._count._all, 0);
  const exportHref = `/api/admin/orders/export${filtersQuery(filters, { page: 1 })}`;
  const filtered = hasActiveFilters(filters) || !!filters.status;

  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Acompanhe, confirme e despache os pedidos que chegam pelo site e pelo WhatsApp."
        actions={
          <a href={exportHref} className={buttonVariants({ variant: "secondary" })} download>
            <Download aria-hidden /> Exportar CSV
          </a>
        }
      />

      <nav aria-label="Filtrar por status" className="no-scrollbar -mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1.5">
          {ORDER_TABS.map((t) => {
            const active = filters.status === t.status;
            const count = t.status ? (counts.get(t.status) ?? 0) : allCount;
            return (
              <li key={t.label}>
                <Link
                  href={`/admin/pedidos${filtersQuery(filters, { status: t.status, page: 1 })}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition-colors",
                    active ? "border-transparent bg-inverse text-inverse-foreground" : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      "tabular rounded-full px-1.5 text-[11px] font-semibold leading-5",
                      active ? "bg-inverse-foreground/15" : t.status === "NEW" && count > 0 ? "bg-primary text-primary-foreground" : "bg-elevated text-subtle",
                    )}
                  >
                    {count.toLocaleString("pt-BR")}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mb-5 flex flex-col gap-2.5 lg:flex-row lg:items-center">
        <Suspense fallback={<Skeleton className="h-11 w-full lg:w-80" />}>
          <SearchBox placeholder="Buscar por código, nome ou telefone" className="w-full lg:w-80" />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-11 w-full lg:w-[640px]" />}>
          <OrderFiltersBar />
        </Suspense>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag />}
          title={filtered ? "Nenhum pedido encontrado" : "Nenhum pedido ainda"}
          description={
            filtered
              ? "Nenhum pedido corresponde aos filtros escolhidos. Tente outro período ou status."
              : "Quando um cliente finalizar uma compra no site, o pedido aparece aqui e chega no WhatsApp da loja."
          }
          action={
            filtered ? (
              <Link href="/admin/pedidos" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Ver todos os pedidos
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {total === 1 ? "1 pedido" : `${total.toLocaleString("pt-BR")} pedidos`}
            {pageCount > 1 && ` · página ${page} de ${pageCount}`}
          </p>
          <OrdersTable orders={orders} />
          <Pagination className="mt-6" page={page} pageCount={pageCount} hrefFor={(p) => `/admin/pedidos${filtersQuery(filters, { page: p })}`} />
        </>
      )}
    </>
  );
}
