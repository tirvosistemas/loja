import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeDollarSign, ReceiptText, ShoppingBag, TicketCheck } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatBRL, formatDateTime, formatPhone } from "@/lib/format";
import { jsonIds } from "@/lib/utils";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { CopyButton } from "@/components/admin/orders/copy-button";
import { OrderStatusBadge } from "@/components/admin/orders/badges";
import { getPickerOptions } from "@/components/admin/marketing/data";
import { CouponForm, type CouponFormValues } from "@/components/admin/marketing/coupon-form";
import { ScheduleStatus } from "@/components/admin/marketing/schedule-status";

export const metadata: Metadata = { title: "Editar cupom" };

export default async function EditCouponPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const coupon = await db.coupon.findUnique({ where: { id: id.slice(0, 40) } });
  if (!coupon) notFound();

  // Pedidos com este cupom (pelo id; pedidos antigos sem id, pelo código).
  const where: Prisma.OrderWhereInput = {
    OR: [{ couponId: coupon.id }, { couponId: null, couponCode: coupon.code }],
    status: { not: "CANCELED" },
  };
  const [options, stats, recent] = await Promise.all([
    getPickerOptions(),
    db.order.aggregate({ where, _count: true, _sum: { totalCents: true, discountCents: true } }),
    db.order.findMany({
      where: { OR: where.OR },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, code: true, customerName: true, customerPhone: true, totalCents: true, discountCents: true, status: true, createdAt: true },
    }),
  ]);

  const initial: CouponFormValues = {
    code: coupon.code,
    description: coupon.description ?? "",
    type: coupon.type,
    percent: coupon.type === "PERCENT" ? coupon.value : null,
    fixedCents: coupon.type === "FIXED" ? coupon.value : null,
    minSubtotalCents: coupon.minSubtotalCents,
    maxDiscountCents: coupon.maxDiscountCents,
    usageLimit: coupon.usageLimit,
    perCustomerLimit: coupon.perCustomerLimit,
    firstOrderOnly: coupon.firstOrderOnly,
    stackWithPromotions: coupon.stackWithPromotions,
    scope: coupon.scope,
    categoryIds: jsonIds(coupon.categoryIds),
    brandIds: jsonIds(coupon.brandIds),
    productIds: jsonIds(coupon.productIds),
    startsAt: coupon.startsAt?.toISOString() ?? null,
    endsAt: coupon.endsAt?.toISOString() ?? null,
    active: coupon.active,
  };
  const orders = stats._count;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono tracking-wider">{coupon.code}</span>
            <ScheduleStatus active={coupon.active} startsAt={coupon.startsAt} endsAt={coupon.endsAt} />
          </span>
        }
        description={`Criado em ${formatDateTime(coupon.createdAt)} · atualizado em ${formatDateTime(coupon.updatedAt)}`}
        back={{ href: "/admin/cupons", label: "Cupons" }}
        actions={<CopyButton text={coupon.code} label="Copiar código" toastMessage={`Código ${coupon.code} copiado.`} size="md" />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Usos" value={`${coupon.usedCount.toLocaleString("pt-BR")}${coupon.usageLimit != null ? ` / ${coupon.usageLimit.toLocaleString("pt-BR")}` : ""}`} icon={<TicketCheck />} hint={coupon.usageLimit != null ? "do limite" : "sem limite"} />
        <StatCard label="Pedidos" value={orders.toLocaleString("pt-BR")} icon={<ShoppingBag />} hint="não cancelados" />
        <StatCard label="Vendas com o cupom" value={formatBRL(stats._sum.totalCents ?? 0)} icon={<ReceiptText />} hint="total dos pedidos" />
        <StatCard label="Desconto concedido" value={formatBRL(stats._sum.discountCents ?? 0)} icon={<BadgeDollarSign />} hint={orders ? `média de ${formatBRL(Math.round((stats._sum.discountCents ?? 0) / orders))}` : "nenhum pedido ainda"} />
      </div>

      <CouponForm id={coupon.id} initial={initial} categories={options.categories} brands={options.brands} usedCount={coupon.usedCount} />

      <section aria-labelledby="pedidos-cupom" className="mt-10">
        <h2 id="pedidos-cupom" className="mb-3 text-lg font-semibold tracking-tight">
          Últimos pedidos com este cupom
        </h2>
        {recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">Nenhum pedido usou este cupom ainda.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {recent.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/pedidos/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-elevated/50">
                  <span className="font-mono text-sm font-semibold">#{o.code}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {o.customerName} <span className="text-subtle">· {formatPhone(o.customerPhone)}</span>
                  </span>
                  <OrderStatusBadge status={o.status} />
                  <span className="tabular w-full text-sm sm:w-auto sm:text-right">
                    {formatBRL(o.totalCents)} <span className="text-xs text-success">−{formatBRL(o.discountCents)}</span>
                  </span>
                  <span className="tabular text-xs text-subtle">{formatDateTime(o.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
