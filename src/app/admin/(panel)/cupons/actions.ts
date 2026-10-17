"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, fromZod, isUniqueError, type ActionResult } from "@/lib/action";
import { scopeData } from "@/components/admin/marketing/data";
import { checkPeriod, checkScope, entityId, idList, optionalDate, scopeSchema } from "@/components/admin/marketing/rules";

// Cupons de desconto, aplicados pelo cliente no carrinho.

const MAX_CENTS = 10_000_000; // R$ 100.000,00
const optionalInt = (min: number, max: number, message: string) => z.number().int(message).min(min, message).max(max, message).nullable().default(null);

const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "Use pelo menos 3 caracteres.")
      .max(30, "Use até 30 caracteres.")
      .regex(/^[A-Z0-9_-]+$/, "Use só letras sem acento, números, hífen (-) ou sublinhado (_)."),
    description: z.string().trim().max(300, "Use até 300 caracteres.").default(""),
    type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]),
    value: z.number().int("Valor inválido.").min(0).max(MAX_CENTS, "Valor alto demais.").default(0),
    minSubtotalCents: optionalInt(1, MAX_CENTS, "Valor inválido."),
    maxDiscountCents: optionalInt(1, MAX_CENTS, "Valor inválido."),
    usageLimit: optionalInt(1, 1_000_000, "Use um número inteiro a partir de 1."),
    perCustomerLimit: optionalInt(1, 1000, "Use um número inteiro a partir de 1."),
    firstOrderOnly: z.boolean(),
    stackWithPromotions: z.boolean(),
    scope: scopeSchema,
    categoryIds: idList,
    brandIds: idList,
    productIds: idList,
    startsAt: optionalDate,
    endsAt: optionalDate,
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "PERCENT" && (v.value < 1 || v.value > 100)) ctx.addIssue({ code: "custom", path: ["value"], message: "Use um desconto de 1% a 100%." });
    if (v.type === "FIXED" && v.value < 1) ctx.addIssue({ code: "custom", path: ["value"], message: "Informe o valor do desconto." });
    if (v.type !== "FREE_SHIPPING") checkScope(v, ctx);
    checkPeriod(v, ctx);
  });

export type CouponInput = z.input<typeof couponSchema>;

function refresh(id?: string) {
  revalidatePath("/admin/cupons");
  if (id) revalidatePath(`/admin/cupons/${id}`);
}

export async function saveCouponAction(id: string | null, input: CouponInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  const freeShipping = v.type === "FREE_SHIPPING";
  const data = {
    code: v.code,
    description: v.description || null,
    type: v.type,
    value: freeShipping ? 0 : v.value,
    minSubtotalCents: v.minSubtotalCents,
    maxDiscountCents: v.type === "PERCENT" ? v.maxDiscountCents : null,
    usageLimit: v.usageLimit,
    perCustomerLimit: v.perCustomerLimit,
    firstOrderOnly: v.firstOrderOnly,
    stackWithPromotions: v.stackWithPromotions,
    // Frete grátis vale para o pedido inteiro.
    ...scopeData(freeShipping ? { scope: "ALL", categoryIds: [], brandIds: [], productIds: [] } : v),
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    active: v.active,
  };
  try {
    if (!id) {
      const created = await db.coupon.create({ data, select: { id: true } });
      refresh();
      return { ok: true, data: { id: created.id }, message: `Cupom ${v.code} criado.` };
    }
    const parsedId = entityId.safeParse(id);
    if (!parsedId.success) return fail("Cupom inválido.");
    const current = await db.coupon.findUnique({ where: { id: parsedId.data }, select: { id: true, usedCount: true } });
    if (!current) return fail("Este cupom não existe mais.");
    if (v.usageLimit != null && v.usageLimit < current.usedCount) {
      return fail("Confira os campos destacados.", { usageLimit: `Este cupom já foi usado ${current.usedCount} vezes. Use um limite igual ou maior.` });
    }
    await db.coupon.update({ where: { id: current.id }, data });
    refresh(current.id);
    return { ok: true, data: { id: current.id }, message: "Cupom salvo." };
  } catch (e) {
    if (isUniqueError(e, "code")) return fail("Confira os campos destacados.", { code: "Já existe um cupom com esse código." });
    console.error("[cupons] falha ao salvar:", e);
    return fail("Não foi possível salvar o cupom. Tente de novo.");
  }
}

export async function toggleCouponAction(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: entityId, active: z.boolean() }).safeParse({ id, active });
  if (!parsed.success) return fail("Dados inválidos.");
  try {
    const r = await db.coupon.updateMany({ where: { id: parsed.data.id }, data: { active: parsed.data.active } });
    if (!r.count) return fail("Este cupom não existe mais.");
    refresh(parsed.data.id);
    return { ok: true, message: parsed.data.active ? "Cupom ativado." : "Cupom desativado." };
  } catch (e) {
    console.error("[cupons] falha ao ativar/desativar:", e);
    return fail("Não foi possível alterar o cupom.");
  }
}

export async function deleteCouponAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = entityId.safeParse(id);
  if (!parsed.success) return fail("Cupom inválido.");
  try {
    const r = await db.coupon.deleteMany({ where: { id: parsed.data } });
    if (!r.count) return fail("Este cupom já tinha sido excluído.");
    refresh();
    return { ok: true, message: "Cupom excluído." };
  } catch (e) {
    console.error("[cupons] falha ao excluir:", e);
    return fail("Não foi possível excluir o cupom.");
  }
}
