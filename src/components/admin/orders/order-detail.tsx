import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Bike, ExternalLink, MapPin, Printer, Store, UserRound } from "lucide-react";
import type { Settings } from "@/lib/settings";
import { DELIVERY_TYPE_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { formatBRL, formatCep, formatDateTime, formatKm, formatPhone, pluralize } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import { absoluteUrl, onlyDigits } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { SmartImage } from "@/components/ui/smart-image";
import { OrderStatusBadge, PaymentStatusBadge } from "./badges";
import { OrderActions } from "./order-actions";
import { CustomerWhatsapp } from "./customer-whatsapp";
import { AdminNotes } from "./admin-notes";
import { WhatsappMessage } from "./whatsapp-message";
import { OrderTimeline } from "./timeline";
import { CopyButton } from "./copy-button";
import { TEMPLATE_FOR_STATUS, customerTemplates, defaultTemplateKey } from "./templates";

// Tela do pedido no painel (só apresentação; os dados vêm da página).

export const orderDetailInclude = {
  items: { orderBy: { id: "asc" }, include: { product: { select: { slug: true } } } },
  events: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderInclude;

export type OrderDetailData = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

function stripeModeOf(key: string) {
  if (/^(pk|sk|rk)_test_/.test(key)) return "test";
  if (/^(pk|sk|rk)_live_/.test(key)) return "live";
  return null;
}

function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children}</dd>
    </div>
  );
}

export function OrderDetailView({ order, settings, currentMessage }: { order: OrderDetailData; settings: Settings; currentMessage: string | null }) {

  const store = settings.store;
  const a = settings.address;
  const pickupAddress = [[a.street, a.number].filter(Boolean).join(", "), a.complement, a.neighborhood, [a.city, a.state].filter(Boolean).join("/")]
    .filter(Boolean)
    .join(" · ");
  const trackUrl = absoluteUrl(`/pedido/${order.code}`);

  const tplOrder = {
    code: order.code,
    customerName: order.customerName,
    status: order.status,
    deliveryType: order.deliveryType,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    totalCents: order.totalCents,
    changeForCents: order.changeForCents,
  };
  const templates = customerTemplates(tplOrder, {
    storeName: store.name || "Tirvo",
    trackUrl,
    pickupAddress: pickupAddress || null,
    businessHours: store.businessHours,
    pickupInstructions: a.pickupInstructions,
    pixKey: settings.payment.pixKey,
    pixHolder: settings.payment.pixHolder,
  });
  const notifyLinks: Record<string, string> = {};
  for (const [status, key] of Object.entries(TEMPLATE_FOR_STATUS)) {
    const t = templates.find((x) => x.key === key);
    if (t) notifyLinks[status] = whatsappLink(order.customerPhone, t.text);
  }

  // Mensagem remontada com os dados atuais (mostra só se mudou, ex.: “✅ PAGO”).
  const showCurrent = currentMessage && currentMessage.trim() !== order.whatsappMessage.trim() ? currentMessage : null;

  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
  const isDelivery = order.deliveryType === "DELIVERY";
  const addressLine1 = [order.street, order.number].filter(Boolean).join(", ");
  const fullAddress = [addressLine1, order.complement, order.neighborhood, [order.city, order.state].filter(Boolean).join(" - "), order.cep ? formatCep(order.cep) : ""]
    .filter(Boolean)
    .join(", ");
  const mapsUrl =
    order.lat != null && order.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${order.lat},${order.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  const changeFor = order.paymentMethod === "CASH_ON_DELIVERY" && order.changeForCents && order.changeForCents > order.totalCents ? order.changeForCents : null;
  const mode = stripeModeOf(settings.integrations.stripePublishableKey || settings.integrations.stripeSecretKey);
  const stripeBase = `https://dashboard.stripe.com/${mode === "test" ? "test/" : ""}`;
  const customerPhoneDigits = onlyDigits(order.customerPhone);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/pedidos", label: "Pedidos" }}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>
              Pedido <span className="font-mono">#{order.code}</span>
            </span>
            <span className="flex flex-wrap gap-1.5">
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.paymentStatus} />
            </span>
          </span>
        }
        description={`${formatDateTime(order.createdAt)} · ${DELIVERY_TYPE_LABEL[order.deliveryType]} · ${pluralize(itemCount, "item", "itens")}`}
        actions={
          <>
            <Link href={`/admin/pedidos/${order.id}/imprimir?auto=1`} target="_blank" className={buttonVariants({ variant: "secondary" })}>
              <Printer aria-hidden /> Imprimir
            </Link>
            <a href={trackUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "ghost" })}>
              Página do cliente <ExternalLink aria-hidden />
            </a>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Andamento" description="Atualize o status conforme o pedido avança. Tudo fica registrado no histórico." />
            <CardBody>
              <OrderActions
                orderId={order.id}
                status={order.status}
                deliveryType={order.deliveryType}
                paymentMethod={order.paymentMethod}
                paymentStatus={order.paymentStatus}
                notifyLinks={notifyLinks}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Itens" description={pluralize(itemCount, "unidade", "unidades")} />
            <ul className="divide-y divide-border">
              {order.items.map((it) => (
                <li key={it.id} className="flex gap-3.5 px-5 py-4">
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-well">
                    <SmartImage src={it.image} alt="" size="sm" sizes="64px" className="size-full object-contain p-1.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        {it.product?.slug ? (
                          <Link href={`/produto/${it.product.slug}`} target="_blank" className="font-medium hover:text-primary">
                            {it.name}
                          </Link>
                        ) : (
                          <p className="font-medium">{it.name}</p>
                        )}
                        <p className="mt-0.5 text-[13px] text-subtle">
                          {[it.variantName, it.sku ? `SKU ${it.sku}` : null].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <p className="tabular shrink-0 font-semibold sm:text-right">{formatBRL(it.totalCents)}</p>
                    </div>
                    <p className="tabular mt-1 text-[13px] text-muted-foreground">
                      {it.quantity} × {formatBRL(it.unitPriceCents)}
                      {it.originalUnitPriceCents > it.unitPriceCents && <s className="ml-2 text-subtle">{formatBRL(it.originalUnitPriceCents)}</s>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="tabular space-y-2 border-t border-border px-5 py-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatBRL(order.subtotalCents)}</dd>
              </div>
              {order.discountCents > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    Cupom {order.couponCode && <span className="font-mono text-xs text-foreground">{order.couponCode}</span>}
                  </dt>
                  <dd className="text-success">−{formatBRL(order.discountCents)}</dd>
                </div>
              )}
              {order.pixDiscountCents > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Desconto Pix</dt>
                  <dd className="text-success">−{formatBRL(order.pixDiscountCents)}</dd>
                </div>
              )}
              {isDelivery && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Frete{order.distanceKm != null ? ` (${formatKm(order.distanceKm)})` : ""}</dt>
                  <dd>{order.shippingCents > 0 ? formatBRL(order.shippingCents) : <span className="text-success">Grátis</span>}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 border-t border-border pt-3 text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatBRL(order.totalCents)}</dd>
              </div>
            </dl>
          </Card>

          {order.notes && (
            <Card>
              <CardHeader title="Observações do cliente" />
              <CardBody>
                <p className="whitespace-pre-wrap break-words text-sm">{order.notes}</p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Mensagem do pedido" description="O pedido organizado que o cliente enviou para o WhatsApp da loja." />
            <CardBody>
              <WhatsappMessage received={order.whatsappMessage} current={showCurrent} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Histórico" />
            <CardBody>
              <OrderTimeline events={order.events} />
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader
              title="Cliente"
              action={
                <Link href={`/admin/clientes/${customerPhoneDigits}`} className="-my-2 -mr-2 inline-flex h-10 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground hover:bg-elevated hover:text-foreground">
                  <UserRound className="size-4" aria-hidden /> Ver cliente
                </Link>
              }
            />
            <CardBody className="space-y-4">
              <dl className="grid gap-3">
                <Row label="Nome">{order.customerName}</Row>
                <Row label="WhatsApp">
                  <span className="tabular inline-flex items-center gap-2">
                    {formatPhone(order.customerPhone)}
                    <CopyButton text={customerPhoneDigits} iconOnly variant="ghost" label="Copiar telefone" toastMessage="Telefone copiado." />
                  </span>
                </Row>
                {order.customerEmail && (
                  <Row label="E-mail">
                    <a href={`mailto:${order.customerEmail}`} className="hover:text-primary">
                      {order.customerEmail}
                    </a>
                  </Row>
                )}
                {order.customerDoc && <Row label="CPF">{order.customerDoc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")}</Row>}
              </dl>
              <CustomerWhatsapp phone={order.customerPhone} templates={templates} defaultKey={defaultTemplateKey(tplOrder)} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={isDelivery ? "Entrega" : "Retirada"} action={isDelivery ? <Bike className="size-4.5 text-subtle" aria-hidden /> : <Store className="size-4.5 text-subtle" aria-hidden />} />
            <CardBody className="space-y-4">
              {isDelivery ? (
                <>
                  <address className="not-italic">
                    <p className="font-medium">
                      {addressLine1 || "Endereço não informado"}
                      {order.complement ? ` · ${order.complement}` : ""}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {[order.neighborhood, [order.city, order.state].filter(Boolean).join("/")].filter(Boolean).join(" · ")}
                    </p>
                  </address>
                  <dl className="grid grid-cols-2 gap-3">
                    {order.cep && <Row label="CEP">{formatCep(order.cep)}</Row>}
                    {order.distanceKm != null && <Row label="Distância da loja">{formatKm(order.distanceKm)}</Row>}
                    {order.reference && (
                      <Row label="Referência" className="col-span-2">
                        {order.reference}
                      </Row>
                    )}
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary", size: "sm", className: "h-10" })}>
                      <MapPin aria-hidden /> Abrir no Google Maps
                    </a>
                    {fullAddress && <CopyButton text={fullAddress} label="Copiar endereço" toastMessage="Endereço copiado." className="h-10" />}
                  </div>
                </>
              ) : (
                <div className="text-sm">
                  <p className="font-medium">O cliente vai retirar na loja.</p>
                  {pickupAddress && <p className="mt-1 text-muted-foreground">{pickupAddress}</p>}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Pagamento" />
            <CardBody>
              <dl className="grid gap-3">
                <Row label="Forma">{PAYMENT_METHOD_LABEL[order.paymentMethod]}</Row>
                <Row label="Situação">
                  <PaymentStatusBadge status={order.paymentStatus} />
                </Row>
                {order.paymentMethod === "CASH_ON_DELIVERY" && (
                  <Row label="Troco">
                    {changeFor ? (
                      <span className="tabular">
                        Troco para {formatBRL(changeFor)} · <strong className="font-semibold">levar {formatBRL(changeFor - order.totalCents)}</strong>
                      </span>
                    ) : (
                      "Não precisa de troco"
                    )}
                  </Row>
                )}
                {order.stripeSessionId && (
                  <Row label="Sessão da Stripe">
                    <span className="break-all font-mono text-xs">{order.stripeSessionId}</span>
                  </Row>
                )}
                {order.stripePaymentIntentId && (
                  <Row label="Pagamento na Stripe">
                    <a
                      href={`${stripeBase}payments/${order.stripePaymentIntentId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 break-all font-mono text-xs hover:text-primary"
                    >
                      {order.stripePaymentIntentId} <ExternalLink className="size-3 shrink-0" aria-hidden />
                    </a>
                  </Row>
                )}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Anotações internas" />
            <CardBody>
              <AdminNotes orderId={order.id} initial={order.adminNotes ?? ""} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
