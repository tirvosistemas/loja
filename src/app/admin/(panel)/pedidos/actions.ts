"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, type ActionResult } from "@/lib/action";
import { markOrderPaid, setAdminNotes, updateOrderStatus } from "@/lib/orders/status";

const idSchema = z.string({ error: "Pedido inválido." }).trim().min(1, "Pedido inválido.").max(40, "Pedido inválido.");
const statusSchema = z.enum(["NEW", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "DELIVERED", "CANCELED"], { error: "Status inválido." });
const noteSchema = z.string().trim().max(500, "A observação pode ter até 500 caracteres.").optional();

function refresh(orderId: string) {
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
}

export async function changeOrderStatusAction(orderId: string, status: string, note?: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = z.object({ orderId: idSchema, status: statusSchema, note: noteSchema }).safeParse({ orderId, status, note });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const r = await updateOrderStatus(parsed.data.orderId, parsed.data.status, { note: parsed.data.note, actor: session.name });
  if (r.ok) refresh(parsed.data.orderId);
  return r;
}

export async function cancelOrderAction(orderId: string, reason?: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = z.object({ orderId: idSchema, reason: noteSchema }).safeParse({ orderId, reason });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const r = await updateOrderStatus(parsed.data.orderId, "CANCELED", {
    note: parsed.data.reason || "Pedido cancelado pelo painel",
    actor: session.name,
  });
  if (r.ok) refresh(parsed.data.orderId);
  return r;
}

export async function markOrderPaidAction(orderId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = idSchema.safeParse(orderId);
  if (!parsed.success) return fail("Pedido inválido.");
  const order = await db.order.findUnique({ where: { id: parsed.data }, select: { paymentMethod: true } });
  if (!order) return fail("Pedido não encontrado.");
  // Pagamento online é confirmado sozinho pela Stripe (webhook).
  if (order.paymentMethod === "ONLINE_STRIPE") return fail("Pagamentos online são confirmados automaticamente pela Stripe.");
  const r = await markOrderPaid(parsed.data, { note: "Pagamento confirmado manualmente", actor: session.name });
  if (r.ok) refresh(parsed.data);
  return r;
}

export async function saveAdminNotesAction(orderId: string, notes: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ orderId: idSchema, notes: z.string().max(5000, "As anotações podem ter até 5.000 caracteres.") })
    .safeParse({ orderId, notes });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const r = await setAdminNotes(parsed.data.orderId, parsed.data.notes);
  if (r.ok) revalidatePath(`/admin/pedidos/${parsed.data.orderId}`);
  return r;
}
