import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgeDollarSign, Plus, ReceiptText, Ticket, TicketCheck } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatBRL } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { SearchBox } from "@/components/admin/search-box";
import { EmptyState, Skeleton } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { scheduleState } from "@/components/admin/marketing/schedule";
import { CouponsTable } from "@/components/admin/marketing/coupons-table";

export const metadata: Metadata = { title: "Cupons" };

type SP = Record<string, string | string[] | undefined>;

export default async function CouponsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 60) ?? "";
  const where: Prisma.CouponWhereInput = q ? { OR: [{ code: { contains: q.toUpperCase() } }, { description: { contains: q } }] } : {};
  const orderWhere: Prisma.OrderWhereInput = { couponId: { not: null }, status: { not: "CANCELED" } };

  const [coupons, total, usage, orders] = await Promise.all([
    db.coupon.findMany({ where, orderBy: [{ active: "desc" }, { createdAt: "desc" }], take: 300 }),
    db.coupon.count(),
    db.coupon.aggregate({ _sum: { usedCount: true } }),
    db.order.aggregate({ where: orderWhere, _sum: { discountCents: true, totalCents: true }, _count: true }),
  ]);
  const now = new Date();
  const liveCount = await db.coupon.findMany({ select: { active: true, startsAt: true, endsAt: true, usageLimit: true, usedCount: true } }).then((all) =>
    all.filter((c) => scheduleState(c, now) === "active" && !(c.usageLimit != null && c.usedCount >= c.usageLimit)).length,
  );

  return (
    <>
      <PageHeader
        title="Cupons"
        description="Códigos de desconto que o cliente aplica no carrinho."
        actions={
          <Link href="/admin/cupons/novo" className={buttonVariants({ variant: "primary" })}>
            <Plus aria-hidden /> Novo cupom
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Cupons valendo" value={liveCount.toLocaleString("pt-BR")} icon={<Ticket />} hint={`de ${total.toLocaleString("pt-BR")} criados`} />
        <StatCard label="Usos" value={(usage._sum.usedCount ?? 0).toLocaleString("pt-BR")} icon={<TicketCheck />} hint="em pedidos feitos" />
        <StatCard label="Desconto concedido" value={formatBRL(orders._sum.discountCents ?? 0)} icon={<BadgeDollarSign />} hint="pedidos não cancelados" />
        <StatCard label="Vendas com cupom" value={formatBRL(orders._sum.totalCents ?? 0)} icon={<ReceiptText />} hint={`${orders._count.toLocaleString("pt-BR")} ${orders._count === 1 ? "pedido" : "pedidos"}`} />
      </div>

      {total > 0 && (
        <div className="mb-4">
          <Suspense fallback={<Skeleton className="h-11 w-full sm:w-80" />}>
            <SearchBox placeholder="Buscar código ou descrição" className="w-full sm:w-80" />
          </Suspense>
        </div>
      )}

      {coupons.length === 0 ? (
        <EmptyState
          icon={<Ticket />}
          title={q ? "Nenhum cupom encontrado" : "Nenhum cupom criado"}
          description={q ? `Nada encontrado para “${q}”.` : "Crie cupons para campanhas no Instagram, primeira compra, frete grátis ou para recuperar clientes."}
          action={
            q ? undefined : (
              <Link href="/admin/cupons/novo" className={buttonVariants({ variant: "primary" })}>
                <Plus aria-hidden /> Criar cupom
              </Link>
            )
          }
        />
      ) : (
        <CouponsTable rows={coupons} now={now} />
      )}
    </>
  );
}
