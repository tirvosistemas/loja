import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, Bike, CheckCircle2, Clock, CreditCard, Hourglass, MapPin, PackageCheck, Store, XCircle } from "lucide-react";
import { ON_DELIVERY_METHODS, PAYMENT_METHOD_SHORT, PAYMENT_STATUS_LABEL, ORDER_STATUS_LABEL, type Tone } from "@/lib/constants";
import type { PublicOrder } from "@/lib/orders/public-order";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/nav";
import { SmartImage } from "@/components/ui/smart-image";
import { Eyebrow } from "@/components/store/catalog/headers";
import { WhatsAppIcon } from "@/components/store/layout/social-icons";
import { formatBRL, formatDateTime, formatKm, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OrderTimeline } from "./order-timeline";
import { PixInstructions } from "./pix-instructions";
import { RetryPayment } from "./retry-payment";
import { WhatsAppSend } from "./whatsapp-send";

export type HeroKind = "new" | "paid" | "processing" | "payment-canceled" | "awaiting-payment" | "canceled" | "delivered" | "default";

export type OrderViewProps = {
  order: PublicOrder;
  hero: HeroKind;
  whatsappUrl: string | null;
  helpUrl: string | null;
  autoOpenWhatsapp: boolean;
  pix: { key: string; keyType: string; holder: string } | null;
  pickup: { place: string | null; instructions: string; hours: string };
  stripeAvailable: boolean;
};

function methodLabel(o: PublicOrder) {
  const base = PAYMENT_METHOD_SHORT[o.paymentMethod];
  return o.deliveryType === "PICKUP" ? base.replace("na entrega", "na retirada") : base;
}

function paymentBadge(o: PublicOrder): { label: string; tone: Tone } {
  if (o.paymentStatus === "PENDING" && ON_DELIVERY_METHODS.includes(o.paymentMethod))
    return { label: o.deliveryType === "PICKUP" ? "Pagar na retirada" : "Pagar na entrega", tone: "neutral" };
  if (o.paymentStatus === "PENDING" && o.paymentProcessing) return { label: "Em processamento", tone: "info" };
  return PAYMENT_STATUS_LABEL[o.paymentStatus] ?? { label: o.paymentStatus, tone: "neutral" };
}

function Panel({ title, icon, children, className, action }: { title: string; icon?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5 sm:p-6", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold [&_svg]:size-4.5 [&_svg]:text-primary">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Hero({ kind, order, whatsappUrl, autoOpenWhatsapp, stripeAvailable }: Omit<OrderViewProps, "pix" | "pickup" | "helpUrl"> & { kind: HeroKind }) {
  const code = order.code;
  const isPix = order.paymentMethod === "PIX_MANUAL" && order.paymentStatus !== "PAID";
  const canPay = order.paymentMethod === "ONLINE_STRIPE" && order.paymentStatus === "PENDING" && order.status !== "CANCELED" && stripeAvailable;

  const content: Record<HeroKind, { icon: ReactNode; tone: "success" | "primary" | "danger" | "info"; title: string; text: string }> = {
    new: {
      icon: <CheckCircle2 aria-hidden />,
      tone: "success",
      title: `Pedido #${code} recebido!`,
      text: isPix
        ? whatsappUrl
          ? "Seu pedido já foi registrado. Faça o Pix com os dados abaixo e envie a mensagem do pedido no WhatsApp junto com o comprovante."
          : "Seu pedido já foi registrado. Faça o Pix com os dados abaixo e guarde o comprovante: a loja vai falar com você pelo WhatsApp."
        : whatsappUrl
          ? "Seu pedido já foi registrado. Envie a mensagem no WhatsApp para confirmarmos."
          : "Seu pedido já foi registrado. A loja vai entrar em contato pelo seu WhatsApp para confirmar.",
    },
    paid: {
      icon: <CheckCircle2 aria-hidden />,
      tone: "success",
      title: "Pagamento aprovado!",
      text: whatsappUrl
        ? `O pedido #${code} está pago. Envie a mensagem no WhatsApp para combinarmos a ${order.deliveryType === "PICKUP" ? "retirada" : "entrega"}.`
        : `O pedido #${code} está pago. A loja vai falar com você pelo WhatsApp para combinar a ${order.deliveryType === "PICKUP" ? "retirada" : "entrega"}.`,
    },
    processing: {
      icon: <Hourglass aria-hidden />,
      tone: "info",
      title: "Pagamento em processamento",
      text: "Assim que a Stripe confirmar o pagamento, esta página é atualizada sozinha. Boletos podem levar até 3 dias úteis.",
    },
    "payment-canceled": {
      icon: <AlertTriangle aria-hidden />,
      tone: "primary",
      title: "Pagamento não concluído",
      text: `O pedido #${code} está reservado, mas o pagamento não foi feito. Tente de novo ou fale com a loja.`,
    },
    "awaiting-payment": {
      icon: <Clock aria-hidden />,
      tone: "primary",
      title: `Falta pagar o pedido #${code}`,
      text: "Os itens ficam reservados por pouco tempo. Conclua o pagamento online para confirmarmos.",
    },
    canceled: {
      icon: <XCircle aria-hidden />,
      tone: "danger",
      title: `Pedido #${code} cancelado`,
      text: "Este pedido foi cancelado. Se foi um engano ou tiver dúvidas, fale com a loja pelo WhatsApp.",
    },
    delivered: {
      icon: <PackageCheck aria-hidden />,
      tone: "success",
      title: order.deliveryType === "PICKUP" ? "Pedido retirado" : "Pedido entregue",
      text: "Obrigado por comprar na Tirvo! Qualquer coisa, estamos no WhatsApp.",
    },
    default: {
      icon: <PackageCheck aria-hidden />,
      tone: "primary",
      title: `Pedido #${code}`,
      text: `${ORDER_STATUS_LABEL[order.status]?.label ?? "Em andamento"}. Esta página atualiza sozinha a cada mudança.`,
    },
  };
  const c = content[kind];
  const toneClass = {
    success: "bg-success-soft text-success",
    primary: "bg-primary-soft text-primary",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
  }[c.tone];

  const showWhatsappPrimary = !!whatsappUrl && (kind === "new" || kind === "paid" || kind === "default" || kind === "processing");

  return (
    <section aria-labelledby="pedido-titulo" className="relative overflow-hidden rounded-3xl border border-border bg-card px-5 py-8 sm:px-8 sm:py-10">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      {(kind === "new" || kind === "paid") && <div className="glow-orange pointer-events-none absolute -right-24 -top-24 size-80 opacity-60" aria-hidden />}
      <div className="relative max-w-2xl">
        <span className={cn("grid size-12 place-items-center rounded-2xl [&_svg]:size-6", toneClass)}>{c.icon}</span>
        <Eyebrow className="mt-5">
          Pedido #{code} · {formatDateTime(order.createdAt)}
        </Eyebrow>
        <h1 id="pedido-titulo" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {c.title}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{c.text}</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
          {canPay && (kind === "payment-canceled" || kind === "awaiting-payment") && (
            <RetryPayment code={code} label={kind === "payment-canceled" ? "Tentar pagar de novo" : "Pagar agora"} />
          )}
          {showWhatsappPrimary && <WhatsAppSend code={code} href={whatsappUrl!} autoOpen={autoOpenWhatsapp} />}
        </div>
      </div>
    </section>
  );
}

export function OrderView(props: OrderViewProps) {
  const { order, hero, pix, pickup, helpUrl } = props;
  const pay = paymentBadge(order);
  const status = ORDER_STATUS_LABEL[order.status] ?? { label: order.status, tone: "neutral" as Tone };
  const units = order.items.reduce((n, i) => n + i.quantity, 0);
  const paidAt = [...order.events].reverse().find((e) => e.type === "payment" && e.status === "PAID")?.createdAt;
  const showPix = order.paymentMethod === "PIX_MANUAL" && order.paymentStatus === "PENDING" && order.status !== "CANCELED";

  return (
    <div className="container-page pb-16 pt-4 sm:pt-6">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Acompanhar pedido", href: "/acompanhar" }, { label: `#${order.code}` }]} />
      <div className="mt-4 space-y-6 sm:mt-5">
        <Hero kind={hero} {...props} />

        {showPix && pix && (
          <PixInstructions pixKey={pix.key} keyType={pix.keyType} holder={pix.holder} amountCents={order.totalCents} hasWhatsapp={!!props.whatsappUrl} />
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
          <div className="min-w-0 space-y-6">
            <Panel
              title="Acompanhe seu pedido"
              icon={<Clock aria-hidden />}
              action={<Badge tone={status.tone}>{status.label}</Badge>}
            >
              <OrderTimeline order={order} />
            </Panel>

            <Panel title={`Itens (${units})`} icon={<PackageCheck aria-hidden />}>
              <ul className="divide-y divide-border">
                {order.items.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4">
                    <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-well sm:size-20">
                      <SmartImage src={it.image} alt="" size="sm" sizes="80px" className="size-full object-contain p-1.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      {it.slug ? (
                        <Link href={`/produto/${it.slug}`} className="line-clamp-2 text-sm font-medium leading-snug hover:text-primary sm:text-[15px]">
                          {it.name}
                        </Link>
                      ) : (
                        <p className="line-clamp-2 text-sm font-medium leading-snug sm:text-[15px]">{it.name}</p>
                      )}
                      <p className="mt-0.5 text-[13px] text-subtle">
                        {it.variantName ? `${it.variantName} · ` : ""}
                        {it.quantity} × <span className="tabular">{formatBRL(it.unitPriceCents)}</span>
                      </p>
                    </div>
                    <div className="tabular shrink-0 text-right">
                      {it.originalUnitPriceCents > it.unitPriceCents && (
                        <s className="block text-xs text-subtle">{formatBRL(it.originalUnitPriceCents * it.quantity)}</s>
                      )}
                      <p className="text-sm font-semibold sm:text-[15px]">{formatBRL(it.totalCents)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <aside className="min-w-0 space-y-6">
            <Panel title="Resumo" icon={<CreditCard aria-hidden />}>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Subtotal ({pluralize(units, "item", "itens")})</dt>
                  <dd className="tabular font-medium">{formatBRL(order.subtotalCents)}</dd>
                </div>
                {order.discountCents > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{order.couponCode ? `Cupom ${order.couponCode}` : "Desconto do cupom"}</dt>
                    <dd className="tabular font-medium text-success">−{formatBRL(order.discountCents)}</dd>
                  </div>
                )}
                {order.pixDiscountCents > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Desconto Pix</dt>
                    <dd className="tabular font-medium text-success">−{formatBRL(order.pixDiscountCents)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {order.deliveryType === "PICKUP" ? "Retirada na loja" : `Frete${order.distanceKm ? ` (${formatKm(order.distanceKm)})` : ""}`}
                  </dt>
                  <dd className={cn("tabular font-medium", order.shippingCents === 0 && "text-success")}>
                    {order.shippingCents > 0 ? formatBRL(order.shippingCents) : "Grátis"}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-border pt-4">
                <span className="text-sm font-medium">Total</span>
                <span className="tabular text-2xl font-semibold tracking-tight">{formatBRL(order.totalCents)}</span>
              </div>
            </Panel>

            <Panel title="Pagamento" icon={<CreditCard aria-hidden />} action={<Badge tone={pay.tone}>{pay.label}</Badge>}>
              <p className="text-sm font-medium">{methodLabel(order)}</p>
              {order.paymentMethod === "CASH_ON_DELIVERY" && (
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {order.changeForCents && order.changeForCents > order.totalCents
                    ? `Troco para ${formatBRL(order.changeForCents)} (levamos ${formatBRL(order.changeForCents - order.totalCents)}).`
                    : "Não precisa de troco."}
                </p>
              )}
              {paidAt && order.paymentStatus === "PAID" && (
                <p className="tabular mt-1 text-[13px] text-muted-foreground">Pago em {formatDateTime(paidAt)}</p>
              )}
              {order.paymentStatus === "REFUNDED" && <p className="mt-1 text-[13px] text-muted-foreground">O valor foi devolvido pela forma de pagamento original.</p>}
            </Panel>

            <Panel
              title={order.deliveryType === "PICKUP" ? "Retirada na loja" : "Entrega por motoboy"}
              icon={order.deliveryType === "PICKUP" ? <Store aria-hidden /> : <Bike aria-hidden />}
            >
              {order.address ? (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
                  <div>
                    <p className="font-medium">
                      {order.address.street}
                      {order.address.number ? `, ${order.address.number}` : ""}
                    </p>
                    <p className="text-muted-foreground">
                      {[order.address.neighborhood, order.address.city && `${order.address.city}/${order.address.state}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 text-sm">
                  {pickup.place && (
                    <p className="flex items-start gap-2">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden /> {pickup.place}
                    </p>
                  )}
                  {pickup.hours && (
                    <p className="flex items-start gap-2 text-muted-foreground">
                      <Clock className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden /> {pickup.hours}
                    </p>
                  )}
                  {pickup.instructions && <p className="pt-1 text-[13px] text-muted-foreground">{pickup.instructions}</p>}
                </div>
              )}
              <p className="mt-4 border-t border-border pt-3 text-[13px] text-subtle">
                Contato: {order.customerFirstName} · <span className="tabular">{order.customerPhoneMasked}</span>
              </p>
            </Panel>

            <section className="rounded-2xl border border-dashed border-border-strong p-5 text-sm">
              <p className="font-medium">Precisa de ajuda com o pedido?</p>
              <p className="mt-1 text-muted-foreground">Fale com a gente informando o código #{order.code}.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {helpUrl && (
                  <a
                    href={helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-10 items-center gap-2 rounded-xl border border-border px-3.5 font-medium hover:border-border-strong hover:bg-elevated"
                  >
                    <WhatsAppIcon className="size-4 text-whatsapp" aria-hidden /> Falar no WhatsApp
                  </a>
                )}
                <Link href="/" className="flex min-h-10 items-center rounded-xl px-3.5 font-medium text-muted-foreground hover:bg-elevated hover:text-foreground">
                  Voltar para a loja
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
