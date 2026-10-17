"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Smartphone } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { forgetSavedOrders, readSavedOrders, type SavedOrder } from "./saved-orders";

/** "Pedidos feitos neste aparelho": códigos guardados no navegador depois de cada compra. */
export function DeviceOrders() {
  const [orders, setOrders] = useState<SavedOrder[] | null>(null);

  useEffect(() => setOrders(readSavedOrders()), []);

  return (
    <section aria-labelledby="aparelho-titulo" className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="aparelho-titulo" className="flex items-center gap-2 text-[15px] font-semibold">
          <Smartphone className="size-4.5 text-primary" aria-hidden /> Pedidos feitos neste aparelho
        </h2>
        {orders && orders.length > 0 && (
          <button
            type="button"
            onClick={() => {
              forgetSavedOrders();
              setOrders([]);
            }}
            className="min-h-10 shrink-0 rounded-lg px-2 text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Limpar lista
          </button>
        )}
      </div>

      {orders == null ? (
        <div className="mt-4 h-14 animate-pulse rounded-xl bg-elevated" aria-hidden />
      ) : orders.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhum pedido feito por aqui ainda. Os pedidos que você fizer neste navegador aparecem nesta lista.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {orders.map((o) => (
            <li key={o.code}>
              <Link
                href={`/pedido/${o.code}`}
                className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-elevated"
              >
                <span className="min-w-0">
                  <span className="block font-mono text-[15px] font-semibold tracking-wider">#{o.code}</span>
                  <span className="tabular block text-[13px] text-subtle">{formatDateTime(o.createdAt)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                  Ver pedido <ChevronRight className="size-4" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
