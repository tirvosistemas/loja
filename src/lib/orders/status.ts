import { z } from "zod";
import type { OrderStatus, PaymentStatus } from "@prisma/client";
import { db } from "../db";
import { fail, type ActionResult } from "../action";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "../constants";
import { restoreStock } from "./inventory";

// Mudanças de status do pedido (usadas pelo painel, pela Stripe e pelo próprio site).
// Cancelar devolve o estoque e o uso do cupom uma única vez.

const statusSchema = z.enum(["NEW", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "DELIVERED", "CANCELED"]);

const FINAL: OrderStatus[] = ["DELIVERED", "CANCELED"];

type Opts = { note?: string; actor?: string };

function eventNote(opts?: Opts, fallback?: string) {
  const note = opts?.note?.trim() || fallback || "";
  const actor = opts?.actor?.trim();
  return [note, actor ? `por ${actor}` : ""].filter(Boolean).join(" · ").slice(0, 2000) || null;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus, opts?: Opts): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return fail("Status inválido.");
  const next = parsed.data;

  try {
    return await db.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            couponId: true,
            items: { select: { productId: true, variantId: true, quantity: true } },
          },
        });
        if (!order) return fail("Pedido não encontrado.");
        if (order.status === next) return { ok: true, message: "O pedido já está com esse status." } as const;
        if (order.status === "CANCELED") return fail("Pedido cancelado não pode ser reaberto.");
        if (FINAL.includes(order.status)) return fail("Pedido entregue não pode mudar de status.");

        if (next === "CANCELED") {
          // Trava contra cancelamento duplo (dois cliques, webhook + painel ao mesmo tempo).
          const res = await tx.order.updateMany({
            where: { id: order.id, status: { not: "CANCELED" } },
            data: {
              status: "CANCELED",
              ...(order.paymentStatus === "PENDING" ? { paymentStatus: "EXPIRED" as const } : {}),
            },
          });
          if (res.count === 0) return { ok: true, message: "O pedido já estava cancelado." } as const;
          await restoreStock(tx, order.items);
          if (order.couponId) {
            await tx.coupon.updateMany({
              where: { id: order.couponId, usedCount: { gt: 0 } },
              data: { usedCount: { decrement: 1 } },
            });
          }
        } else {
          const res = await tx.order.updateMany({
            where: { id: order.id, status: { notIn: FINAL } },
            data: { status: next },
          });
          if (res.count === 0) return fail("O pedido foi finalizado por outra pessoa. Atualize a página.");
        }

        await tx.orderEvent.create({
          data: { orderId: order.id, type: "status", status: next, note: eventNote(opts) },
        });
        return { ok: true, message: `Pedido marcado como “${ORDER_STATUS_LABEL[next].label}”.` } as const;
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
  } catch (e) {
    console.error("[pedidos] falha ao mudar status:", e);
    return fail("Não foi possível atualizar o pedido. Tente de novo.");
  }
}

export async function markOrderPaid(
  orderId: string,
  opts?: Opts & { stripePaymentIntentId?: string },
): Promise<ActionResult> {
  try {
    return await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true, status: true, paymentStatus: true } });
      if (!order) return fail("Pedido não encontrado.");
      const res = await tx.order.updateMany({
        where: { id: order.id, paymentStatus: { not: "PAID" } },
        data: {
          paymentStatus: "PAID",
          ...(opts?.stripePaymentIntentId ? { stripePaymentIntentId: opts.stripePaymentIntentId } : {}),
        },
      });
      if (res.count === 0) return { ok: true, message: "O pagamento já estava confirmado." } as const;
      const late = order.status === "CANCELED" ? "Atenção: pagamento recebido depois do cancelamento. Avalie o estorno." : "";
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "payment",
          status: "PAID",
          note: eventNote(opts, ["Pagamento confirmado", late].filter(Boolean).join(". ")),
        },
      });
      return { ok: true, message: "Pagamento confirmado." } as const;
    });
  } catch (e) {
    console.error("[pedidos] falha ao confirmar pagamento:", e);
    return fail("Não foi possível confirmar o pagamento. Tente de novo.");
  }
}

/** Muda só o status do pagamento (falhou, expirou, reembolsado). Idempotente. */
export async function setPaymentStatus(
  orderId: string,
  paymentStatus: Exclude<PaymentStatus, "PAID">,
  opts?: Opts,
): Promise<ActionResult> {
  try {
    return await db.$transaction(async (tx) => {
      const res = await tx.order.updateMany({
        where: { id: orderId, paymentStatus: { not: paymentStatus } },
        data: { paymentStatus },
      });
      if (res.count === 0) return { ok: true } as const;
      await tx.orderEvent.create({
        data: {
          orderId,
          type: "payment",
          status: paymentStatus,
          note: eventNote(opts, `Pagamento: ${PAYMENT_STATUS_LABEL[paymentStatus]?.label.toLowerCase() ?? paymentStatus}`),
        },
      });
      return { ok: true } as const;
    });
  } catch (e) {
    console.error("[pedidos] falha ao mudar status do pagamento:", e);
    return fail("Não foi possível atualizar o pagamento.");
  }
}

/** Status "processando" (boleto/Pix online gerado e aguardando compensação). Fica só no histórico. */
export const PAYMENT_PROCESSING = "PROCESSING";

export async function markPaymentProcessing(orderId: string, note = "Pagamento iniciado na Stripe, aguardando compensação") {
  const exists = await db.orderEvent.findFirst({ where: { orderId, type: "payment", status: PAYMENT_PROCESSING }, select: { id: true } });
  if (exists) return;
  await db.orderEvent.create({ data: { orderId, type: "payment", status: PAYMENT_PROCESSING, note } });
}

export async function setAdminNotes(orderId: string, notes: string): Promise<ActionResult> {
  const parsed = z.string().max(5000, "As anotações podem ter até 5.000 caracteres.").safeParse(notes ?? "");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Anotação inválida.");
  try {
    const res = await db.order.updateMany({ where: { id: orderId }, data: { adminNotes: parsed.data.trim() || null } });
    if (res.count === 0) return fail("Pedido não encontrado.");
    return { ok: true, message: "Anotações salvas." };
  } catch (e) {
    console.error("[pedidos] falha ao salvar anotações:", e);
    return fail("Não foi possível salvar as anotações.");
  }
}

// ───────── Limpeza de pagamentos online abandonados

const STRIPE_ABANDON_MS = 2 * 60 * 60 * 1000;
let lastSweep = 0;

/**
 * Cancela pedidos novos com pagamento online pendente há mais de 2 horas (a sessão da
 * Stripe expira em 60 min). Devolve o estoque. Roda no máximo uma vez por minuto.
 */
export async function cancelExpiredStripeOrders(): Promise<number> {
  const now = Date.now();
  if (now - lastSweep < 60_000) return 0;
  lastSweep = now;
  try {
    const cutoff = new Date(now - STRIPE_ABANDON_MS);
    const stale = await db.order.findMany({
      where: {
        status: "NEW",
        paymentMethod: "ONLINE_STRIPE",
        paymentStatus: "PENDING",
        createdAt: { lt: cutoff },
        // Nova tentativa de pagamento atualiza o pedido: espera a sessão nova expirar.
        updatedAt: { lt: cutoff },
        // Boleto gerado: espera a compensação (a Stripe avisa pelo webhook).
        events: { none: { type: "payment", status: PAYMENT_PROCESSING } },
      },
      select: { id: true },
      take: 25,
      orderBy: { createdAt: "asc" },
    });
    let canceled = 0;
    for (const o of stale) {
      const r = await updateOrderStatus(o.id, "CANCELED", { note: "Pagamento online não concluído a tempo", actor: "sistema" });
      if (r.ok) canceled++;
    }
    return canceled;
  } catch (e) {
    console.error("[pedidos] falha ao cancelar pagamentos expirados:", e);
    return 0;
  }
}
