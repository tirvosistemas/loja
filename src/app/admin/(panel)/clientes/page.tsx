import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { formatBRL, formatDate, formatPhone, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AdminTable, PageHeader } from "@/components/admin/page-header";
import { SearchBox } from "@/components/admin/search-box";
import { EmptyState, Skeleton } from "@/components/ui/card";
import { Pagination } from "@/components/ui/nav";
import { CUSTOMER_SORTS, listCustomers, type CustomerSort } from "@/components/admin/customers/data";

export const metadata: Metadata = { title: "Clientes" };

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = first(sp.q).trim();
  const sortRaw = first(sp.ordem);
  const sort: CustomerSort = CUSTOMER_SORTS.some((s) => s.value === sortRaw) ? (sortRaw as CustomerSort) : "gasto";
  const pageRaw = Number.parseInt(first(sp.page), 10);
  const { customers, total, page, pageCount } = await listCustomers({ q, sort, page: Number.isFinite(pageRaw) ? pageRaw : 1 });

  const href = (patch: { ordem?: string; page?: number }) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    const o = patch.ordem ?? sort;
    if (o !== "gasto") p.set("ordem", o);
    const pg = patch.page ?? 1;
    if (pg > 1) p.set("page", String(pg));
    const s = p.toString();
    return `/admin/clientes${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Clientes" description="Quem já comprou na loja, agrupado pelo WhatsApp informado nos pedidos." />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Suspense fallback={<Skeleton className="h-11 w-full lg:w-80" />}>
          <SearchBox placeholder="Buscar por nome, telefone ou e-mail" className="w-full lg:w-80" />
        </Suspense>
        <nav aria-label="Ordenar clientes" className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex min-w-max gap-1 rounded-xl border border-border bg-elevated p-1">
            {CUSTOMER_SORTS.map((s) => (
              <li key={s.value}>
                <Link
                  href={href({ ordem: s.value })}
                  aria-current={sort === s.value ? "true" : undefined}
                  className={cn(
                    "flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors",
                    sort === s.value ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={q ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
          description={q ? `Nada encontrado para “${q}”. Confira o nome ou o número.` : "Os clientes aparecem aqui assim que fizerem o primeiro pedido pelo site."}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{pluralize(total, "cliente", "clientes")}</p>

          <AdminTable className="hidden md:block">
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Cidade</th>
                <th scope="col" className="!text-right">
                  Pedidos
                </th>
                <th scope="col" className="!text-right">
                  Total gasto
                </th>
                <th scope="col">Última compra</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.phone}>
                  <td className="max-w-[300px]">
                    <Link href={`/admin/clientes/${c.phone}`} className="font-medium hover:text-primary">
                      {c.name}
                    </Link>
                    <p className="tabular mt-0.5 truncate text-xs text-subtle">
                      {formatPhone(c.phone)}
                      {c.email ? ` · ${c.email}` : ""}
                    </p>
                  </td>
                  <td className="text-muted-foreground">{c.city ?? "—"}</td>
                  <td className="tabular text-right">
                    {c.validOrders}
                    {c.orders > c.validOrders && <span className="ml-1 text-xs text-subtle">(+{c.orders - c.validOrders} cancel.)</span>}
                  </td>
                  <td className="tabular text-right font-medium">{formatBRL(c.spentCents)}</td>
                  <td className="tabular whitespace-nowrap text-[13px] text-muted-foreground">{formatDate(c.lastOrderAt)}</td>
                </tr>
              ))}
            </tbody>
          </AdminTable>

          <ul className="space-y-2.5 md:hidden">
            {customers.map((c) => (
              <li key={c.phone}>
                <Link href={`/admin/clientes/${c.phone}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-border-strong active:bg-elevated">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="tabular shrink-0 font-semibold">{formatBRL(c.spentCents)}</span>
                    </div>
                    <p className="tabular mt-0.5 text-[13px] text-subtle">{formatPhone(c.phone)}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {pluralize(c.validOrders, "pedido", "pedidos")} · última em {formatDate(c.lastOrderAt)}
                      {c.city ? ` · ${c.city}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>

          <Pagination className="mt-6" page={page} pageCount={pageCount} hrefFor={(p) => href({ page: p })} />
        </>
      )}
    </>
  );
}
