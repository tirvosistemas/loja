import type { Prisma } from "@prisma/client";
import type { Settings } from "@/lib/settings";
import { DELIVERY_TYPE_LABEL, ON_DELIVERY_METHODS, PAYMENT_METHOD_SHORT, PAYMENT_STATUS_LABEL } from "@/lib/constants";
import { formatBRL, formatCep, formatDateTime, formatKm, formatPhone } from "@/lib/format";
import { Logo } from "@/components/brand/logo";
import { PrintControls } from "./print-controls";

// Comprovante para imprimir e entregar ao motoboy: fundo branco sempre (é papel),
// endereço em destaque e o valor a cobrar quando o pagamento é na entrega.

export type PrintOrderData = Prisma.OrderGetPayload<{ include: { items: true } }>;

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 10mm; }
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  #print-root, #print-root * { visibility: visible !important; }
  #print-root { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; overflow: visible !important; background: #fff !important; }
  #print-root .print-hide { display: none !important; }
  #print-root .print-paper { box-shadow: none !important; margin: 0 !important; padding: 0 !important; max-width: none !important; border: 0 !important; }
  #print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

export function PrintSlip({ order, settings, auto }: { order: PrintOrderData; settings: Settings; auto: boolean }) {
  const store = settings.store;
  const sa = settings.address;
  const storeAddress = [[sa.street, sa.number].filter(Boolean).join(", "), sa.neighborhood, [sa.city, sa.state].filter(Boolean).join("/")].filter(Boolean).join(" · ");
  const isDelivery = order.deliveryType === "DELIVERY";
  const paid = order.paymentStatus === "PAID";
  const collect = !paid && ON_DELIVERY_METHODS.includes(order.paymentMethod) && order.status !== "CANCELED";
  const changeFor = order.paymentMethod === "CASH_ON_DELIVERY" && order.changeForCents && order.changeForCents > order.totalCents ? order.changeForCents : null;
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div id="print-root" className="fixed inset-0 z-[80] overflow-y-auto bg-zinc-100 text-zinc-900" style={{ colorScheme: "light" }}>
      <style>{PRINT_CSS}</style>
      <PrintControls backHref={`/admin/pedidos/${order.id}`} auto={auto} />

      <article className="print-paper mx-auto my-6 max-w-[794px] bg-white px-6 py-8 shadow-xl sm:px-10">
        <header className="flex flex-col gap-4 border-b-2 border-zinc-900 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Logo className="h-7 text-zinc-900" title={store.name || "Tirvo"} />
            <div className="mt-2 text-xs leading-relaxed text-zinc-600">
              {store.legalName && <p>{store.legalName}{store.cnpj ? ` · CNPJ ${store.cnpj}` : ""}</p>}
              {storeAddress && <p>{storeAddress}</p>}
              {(store.whatsapp || store.phone) && <p>WhatsApp {formatPhone(store.whatsapp || store.phone)}</p>}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Pedido</p>
            <p className="font-mono text-3xl font-bold tracking-wide">#{order.code}</p>
            <p className="mt-1 text-xs text-zinc-600">{formatDateTime(order.createdAt)}</p>
            <p className="mt-1 inline-block rounded border border-zinc-900 px-2 py-0.5 text-xs font-semibold uppercase">{DELIVERY_TYPE_LABEL[order.deliveryType]}</p>
          </div>
        </header>

        {order.status === "CANCELED" && (
          <p className="mt-5 rounded-lg border-2 border-red-600 px-4 py-2 text-center text-sm font-bold uppercase text-red-700">Pedido cancelado · não entregar</p>
        )}

        <section className="mt-6 rounded-xl border-2 border-zinc-900 p-5" aria-label={isDelivery ? "Endereço de entrega" : "Retirada"}>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">{isDelivery ? "Entregar para" : "Retirada na loja"}</p>
          <p className="mt-1 text-xl font-bold">{order.customerName}</p>
          <p className="text-base font-semibold">{formatPhone(order.customerPhone)}</p>
          {isDelivery ? (
            <div className="mt-4 border-t border-dashed border-zinc-400 pt-4">
              <p className="text-2xl font-bold leading-snug sm:text-[28px]">
                {[order.street, order.number].filter(Boolean).join(", ")}
              </p>
              {order.complement && <p className="mt-1 text-lg font-semibold">{order.complement}</p>}
              <p className="mt-1 text-lg">
                {[order.neighborhood, [order.city, order.state].filter(Boolean).join("/")].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 text-base">
                {order.cep && <>CEP {formatCep(order.cep)}</>}
                {order.distanceKm != null && <> · {formatKm(order.distanceKm)} da loja</>}
              </p>
              {order.reference && (
                <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 text-base">
                  <strong>Referência:</strong> {order.reference}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-700">O cliente retira o pedido na loja. Confira o código #{order.code} na entrega.</p>
          )}
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2" aria-label="Pagamento">
          <div className={`rounded-xl border-2 p-5 ${collect ? "border-[#ff5500]" : "border-zinc-300"}`}>
            {collect ? (
              <>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Cobrar {isDelivery ? "na entrega" : "na retirada"}</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{formatBRL(order.totalCents)}</p>
                <p className="mt-1 text-sm font-semibold">{PAYMENT_METHOD_SHORT[order.paymentMethod]}</p>
                {order.paymentMethod === "CASH_ON_DELIVERY" && (
                  <p className="mt-2 text-sm">
                    {changeFor ? (
                      <>
                        Troco para <strong>{formatBRL(changeFor)}</strong> · levar <strong className="text-base">{formatBRL(changeFor - order.totalCents)}</strong>
                      </>
                    ) : (
                      "Não precisa de troco"
                    )}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Pagamento</p>
                <p className="mt-1 text-2xl font-bold">{paid ? "PAGO · não cobrar" : PAYMENT_STATUS_LABEL[order.paymentStatus]?.label}</p>
                <p className="mt-1 text-sm">{PAYMENT_METHOD_SHORT[order.paymentMethod]}</p>
              </>
            )}
          </div>
          <div className="rounded-xl border border-zinc-300 p-5 text-sm">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Conferência</p>
            <p className="mt-2">
              {itemCount} {itemCount === 1 ? "volume/unidade" : "volumes/unidades"}
            </p>
            <div className="mt-6 space-y-5">
              <p className="border-b border-zinc-400 pb-1 text-xs text-zinc-500">Recebido por (nome)</p>
              <p className="border-b border-zinc-400 pb-1 text-xs text-zinc-500">Assinatura e data</p>
            </div>
          </div>
        </section>

        <section className="mt-6" aria-label="Itens">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-zinc-900 text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="py-2 pr-2 font-semibold">Qtd.</th>
                <th className="py-2 pr-2 font-semibold">Item</th>
                <th className="hidden py-2 pr-2 text-right font-semibold sm:table-cell">Unitário</th>
                <th className="py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it) => (
                <tr key={it.id} className="border-b border-zinc-200 align-top">
                  <td className="py-2.5 pr-2 text-base font-bold tabular-nums">{it.quantity}×</td>
                  <td className="py-2.5 pr-2">
                    <p className="font-medium">{it.name}</p>
                    {(it.variantName || it.sku) && <p className="text-xs text-zinc-600">{[it.variantName, it.sku ? `SKU ${it.sku}` : null].filter(Boolean).join(" · ")}</p>}
                  </td>
                  <td className="hidden py-2.5 pr-2 text-right tabular-nums sm:table-cell">{formatBRL(it.unitPriceCents)}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatBRL(it.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="ml-auto mt-3 max-w-xs space-y-1 text-sm tabular-nums">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-600">Subtotal</dt>
              <dd>{formatBRL(order.subtotalCents)}</dd>
            </div>
            {order.discountCents > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-600">Cupom {order.couponCode}</dt>
                <dd>−{formatBRL(order.discountCents)}</dd>
              </div>
            )}
            {order.pixDiscountCents > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-600">Desconto Pix</dt>
                <dd>−{formatBRL(order.pixDiscountCents)}</dd>
              </div>
            )}
            {isDelivery && (
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-600">Frete</dt>
                <dd>{order.shippingCents > 0 ? formatBRL(order.shippingCents) : "Grátis"}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 border-t-2 border-zinc-900 pt-1.5 text-base font-bold">
              <dt>Total</dt>
              <dd>{formatBRL(order.totalCents)}</dd>
            </div>
          </dl>
        </section>

        {order.notes && (
          <section className="mt-6 rounded-xl border border-zinc-300 p-4 text-sm" aria-label="Observações">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">Observações do cliente</p>
            <p className="mt-1 whitespace-pre-wrap">{order.notes}</p>
          </section>
        )}

        <footer className="mt-8 border-t border-zinc-200 pt-3 text-center text-[11px] text-zinc-500">
          {store.name || "Tirvo"} · {store.tagline}
        </footer>
      </article>
    </div>
  );
}
