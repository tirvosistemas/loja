import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, MapPin, MessageCircle, Receipt, ShoppingBag, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { formatBRL, formatCep, formatDate, formatPhone, pluralize } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import { getSettings } from "@/lib/settings";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { OrdersTable, type OrderRow } from "@/components/admin/orders/orders-table";
import { CopyButton } from "@/components/admin/orders/copy-button";
import { firstName } from "@/components/admin/orders/templates";
import { getCustomer } from "@/components/admin/customers/data";

type Props = { params: Promise<{ phone: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { phone } = await params;
  return { title: `Cliente ${formatPhone(decodeURIComponent(phone))}` };
}

export default async function CustomerPage({ params }: Props) {
  await requireAdmin();
  const { phone } = await params;
  const [customer, settings] = await Promise.all([getCustomer(decodeURIComponent(phone)), getSettings()]);
  if (!customer) notFound();

  const orders: OrderRow[] = customer.orders.map(({ _count, ...o }) => ({ ...o, itemCount: _count.items }));
  const greeting = `Olá, ${firstName(customer.name)}! Aqui é da ${settings.store.name || "Tirvo"}.`;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/clientes", label: "Clientes" }}
        title={customer.name}
        description={`Cliente desde ${formatDate(customer.firstOrderAt, { dateStyle: "long" })}`}
        actions={
          <a href={whatsappLink(customer.phone, greeting)} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "whatsapp" })}>
            <MessageCircle aria-hidden /> Falar no WhatsApp
          </a>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total gasto" value={formatBRL(customer.spentCents)} icon={<Wallet />} hint="Sem pedidos cancelados" />
        <StatCard label="Pedidos" value={customer.validCount} icon={<ShoppingBag />} hint={customer.orders.length > customer.validCount ? `${customer.orders.length - customer.validCount} cancelado(s)` : undefined} />
        <StatCard label="Ticket médio" value={formatBRL(customer.averageCents)} icon={<Receipt />} />
        <StatCard label="Última compra" value={formatDate(customer.lastOrderAt)} icon={<CalendarClock />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <section className="min-w-0" aria-labelledby="pedidos-cliente">
          <h2 id="pedidos-cliente" className="mb-3 text-base font-semibold">
            Pedidos <span className="text-subtle">· {customer.orders.length}</span>
          </h2>
          <OrdersTable orders={orders} compact />
        </section>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Contato" />
            <CardBody>
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-xs text-subtle">WhatsApp</dt>
                  <dd className="tabular mt-0.5 flex items-center gap-2">
                    {formatPhone(customer.phone)}
                    <CopyButton text={customer.phone} iconOnly variant="ghost" label="Copiar telefone" toastMessage="Telefone copiado." />
                  </dd>
                </div>
                {customer.email && (
                  <div>
                    <dt className="text-xs text-subtle">E-mail</dt>
                    <dd className="mt-0.5 break-all">
                      <a href={`mailto:${customer.email}`} className="hover:text-primary">
                        {customer.email}
                      </a>
                    </dd>
                  </div>
                )}
                {customer.doc && (
                  <div>
                    <dt className="text-xs text-subtle">CPF</dt>
                    <dd className="tabular mt-0.5">{customer.doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")}</dd>
                  </div>
                )}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Endereços de entrega" description={customer.addresses.length ? pluralize(customer.addresses.length, "endereço usado", "endereços usados") : undefined} />
            <CardBody>
              {customer.addresses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Este cliente só retirou pedidos na loja.</p>
              ) : (
                <ul className="space-y-3">
                  {customer.addresses.map((a) => (
                    <li key={`${a.line}${a.city}`} className="flex gap-2.5 text-sm">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
                      <div className="min-w-0">
                        <p className="break-words">{a.line}</p>
                        <p className="text-xs text-subtle">
                          {a.city}
                          {a.cep ? ` · CEP ${formatCep(a.cep)}` : ""}
                          {a.count > 1 ? ` · ${a.count} pedidos` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
