import Link from "next/link";
import { Bike, ChevronRight, Store } from "lucide-react";
import { AdminTable } from "@/components/admin/page-header";
import { PAYMENT_METHOD_SHORT } from "@/lib/constants";
import { formatBRL, formatDateTime, formatPhone, pluralize } from "@/lib/format";
import { OrderStatusBadge, PaymentStatusBadge } from "./badges";

export type OrderRow = {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  city: string | null;
  totalCents: number;
  paymentMethod: keyof typeof PAYMENT_METHOD_SHORT;
  paymentStatus: string;
  status: string;
  deliveryType: "DELIVERY" | "PICKUP";
  createdAt: Date;
  itemCount: number;
};

function DeliveryIcon({ type }: { type: OrderRow["deliveryType"] }) {
  return type === "PICKUP" ? (
    <Store className="size-3.5 shrink-0 text-subtle" aria-label="Retirada na loja" />
  ) : (
    <Bike className="size-3.5 shrink-0 text-subtle" aria-label="Entrega por motoboy" />
  );
}

/** Lista de pedidos: tabela no computador e cartões no celular. */
export function OrdersTable({ orders, compact }: { orders: OrderRow[]; compact?: boolean }) {
  return (
    <>
      <AdminTable className="hidden md:block">
        <thead>
          <tr>
            <th scope="col">Pedido</th>
            <th scope="col">Cliente</th>
            <th scope="col" className="!text-right">
              Total
            </th>
            <th scope="col">Pagamento</th>
            <th scope="col">Status</th>
            <th scope="col">Data</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <Link href={`/admin/pedidos/${o.id}`} className="font-mono text-[13px] font-semibold tracking-wide text-foreground hover:text-primary">
                  #{o.code}
                </Link>
                {!compact && <p className="mt-0.5 text-xs text-subtle">{pluralize(o.itemCount, "item", "itens")}</p>}
              </td>
              <td className="max-w-[240px]">
                <div className="flex items-center gap-1.5">
                  <DeliveryIcon type={o.deliveryType} />
                  <span className="truncate font-medium">{o.customerName}</span>
                </div>
                <p className="tabular mt-0.5 truncate text-xs text-subtle">
                  {formatPhone(o.customerPhone)}
                  {!compact && o.city ? ` · ${o.city}` : ""}
                </p>
              </td>
              <td className="tabular whitespace-nowrap text-right font-medium">{formatBRL(o.totalCents)}</td>
              <td>
                <p className="text-[13px] text-muted-foreground">{PAYMENT_METHOD_SHORT[o.paymentMethod]}</p>
                <div className="mt-1">
                  <PaymentStatusBadge status={o.paymentStatus} />
                </div>
              </td>
              <td>
                <OrderStatusBadge status={o.status} />
              </td>
              <td className="tabular whitespace-nowrap text-[13px] text-muted-foreground">{formatDateTime(o.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </AdminTable>

      <ul className="space-y-2.5 md:hidden">
        {orders.map((o) => (
          <li key={o.id}>
            <Link
              href={`/admin/pedidos/${o.id}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-border-strong active:bg-elevated"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[13px] font-semibold tracking-wide">#{o.code}</span>
                  <span className="tabular text-[15px] font-semibold">{formatBRL(o.totalCents)}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-sm">
                  <DeliveryIcon type={o.deliveryType} />
                  <span className="truncate">{o.customerName}</span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <OrderStatusBadge status={o.status} />
                  <PaymentStatusBadge status={o.paymentStatus} />
                </div>
                <p className="tabular mt-2 text-xs text-subtle">
                  {formatDateTime(o.createdAt)} · {PAYMENT_METHOD_SHORT[o.paymentMethod]}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
