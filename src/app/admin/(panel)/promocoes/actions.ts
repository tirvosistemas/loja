"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, fromZod, type ActionResult } from "@/lib/action";
import { effectivePrice, getActivePromotions, type PromoLite } from "@/lib/pricing";
import { sendPushToAll } from "@/lib/push";
import { jsonIds } from "@/lib/utils";
import { countScopeProducts, scopeData, scopeWhere } from "@/components/admin/marketing/data";
import { PUSH_BODY_MAX, PUSH_TITLE_MAX } from "@/components/admin/marketing/labels";
import { checkPeriod, checkScope, entityId, idList, optionalDate, scopeSchema, textMax } from "@/components/admin/marketing/rules";

// Promoções automáticas: mudam o preço exibido dos produtos do escopo enquanto valem.

const MAX_FIXED_CENTS = 10_000_000; // R$ 100.000,00

const discountShape = {
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.number({ error: "Informe o valor do desconto." }).int("Valor inválido."),
  scope: scopeSchema,
  categoryIds: idList,
  brandIds: idList,
  productIds: idList,
};

function checkValue(v: { type: "PERCENT" | "FIXED"; value: number }, ctx: z.RefinementCtx) {
  if (v.type === "PERCENT" && (v.value < 1 || v.value > 90)) ctx.addIssue({ code: "custom", path: ["value"], message: "Use um desconto de 1% a 90%." });
  if (v.type === "FIXED" && v.value < 1) ctx.addIssue({ code: "custom", path: ["value"], message: "Informe o valor do desconto." });
  if (v.type === "FIXED" && v.value > MAX_FIXED_CENTS) ctx.addIssue({ code: "custom", path: ["value"], message: "Valor alto demais." });
}

const promotionSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome da promoção.").max(120, "Use até 120 caracteres."),
    description: z.string().trim().max(500, "Use até 500 caracteres.").default(""),
    ...discountShape,
    badge: textMax(24, "Use até 24 caracteres.").default(""),
    flash: z.boolean(),
    priority: z.number({ error: "Informe a prioridade." }).int("Use um número inteiro.").min(0, "Use de 0 a 100.").max(100, "Use de 0 a 100."),
    startsAt: optionalDate,
    endsAt: optionalDate,
    active: z.boolean(),
    notify: z.object({
      enabled: z.boolean(),
      title: textMax(PUSH_TITLE_MAX, `Use até ${PUSH_TITLE_MAX} caracteres.`),
      body: textMax(PUSH_BODY_MAX, `Use até ${PUSH_BODY_MAX} caracteres.`),
    }),
  })
  .superRefine((v, ctx) => {
    checkValue(v, ctx);
    checkScope(v, ctx);
    checkPeriod(v, ctx);
    if (v.flash && !v.endsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "A oferta relâmpago precisa de data de fim (é ela que faz a contagem regressiva)." });
    if (v.notify.enabled && !v.notify.title) ctx.addIssue({ code: "custom", path: ["notify.title"], message: "Escreva o título da notificação." });
    if (v.notify.enabled && !v.notify.body) ctx.addIssue({ code: "custom", path: ["notify.body"], message: "Escreva a mensagem da notificação." });
  });

export type PromotionInput = z.input<typeof promotionSchema>;
export type PushResult = { sent: number; failed: number; total: number };

function refresh() {
  revalidatePath("/admin/promocoes");
  revalidatePath("/", "layout");
}

/** Envia o aviso da promoção e registra a campanha. Nunca derruba o salvamento. */
async function notifyPromotion(id: string, title: string, body: string): Promise<PushResult | { error: string }> {
  try {
    const subscribers = await db.pushSubscription.count();
    if (!subscribers) return { sent: 0, failed: 0, total: 0 };
    const url = "/ofertas";
    const r = await sendPushToAll({ title, body, url, tag: `promo-${id}` });
    await db.pushCampaign.create({ data: { title, body, url, sentCount: r.sent, failedCount: r.failed, sentAt: new Date() } });
    revalidatePath("/admin/notificacoes");
    return r;
  } catch (e) {
    console.error("[promoções] falha ao enviar notificação:", e);
    return { error: "Promoção salva, mas o envio da notificação falhou." };
  }
}

export async function savePromotionAction(id: string | null, input: PromotionInput): Promise<ActionResult<{ id: string; push?: PushResult }>> {
  await requireAdmin();
  const parsed = promotionSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;
  const data = {
    name: v.name,
    description: v.description || null,
    type: v.type,
    value: v.value,
    ...scopeData(v),
    badge: v.badge || null,
    flash: v.flash,
    priority: v.priority,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    active: v.active,
  };

  let savedId: string;
  try {
    if (id) {
      const parsedId = entityId.safeParse(id);
      if (!parsedId.success) return fail("Promoção inválida.");
      const r = await db.promotion.updateMany({ where: { id: parsedId.data }, data });
      if (!r.count) return fail("Esta promoção não existe mais.");
      savedId = parsedId.data;
    } else {
      savedId = (await db.promotion.create({ data, select: { id: true } })).id;
    }
  } catch (e) {
    console.error("[promoções] falha ao salvar:", e);
    return fail("Não foi possível salvar a promoção. Tente de novo.");
  }
  refresh();

  const base = id ? "Promoção salva." : "Promoção criada.";
  if (!v.notify.enabled) return { ok: true, data: { id: savedId }, message: base };
  const push = await notifyPromotion(savedId, v.notify.title, v.notify.body);
  if ("error" in push) return { ok: true, data: { id: savedId }, message: push.error };
  const message = push.total === 0 ? `${base} Ninguém está inscrito nas notificações ainda.` : `${base} Notificação enviada para ${push.sent.toLocaleString("pt-BR")} ${push.sent === 1 ? "pessoa" : "pessoas"}.`;
  return { ok: true, data: { id: savedId, push }, message };
}

// ───────── Prévia do impacto (quantos produtos e um exemplo de preço)

const previewSchema = z.object({ ...discountShape, value: z.number().int().min(0).max(MAX_FIXED_CENTS), excludeId: z.string().max(40).nullable().default(null) });

export type PromotionPreviewInput = z.input<typeof previewSchema>;
export type PromotionPreview = {
  count: number;
  totalActive: number;
  example: {
    name: string;
    image: string | null;
    basePriceCents: number;
    priceCents: number;
    compareAtCents: number | null;
    discountPercent: number;
    winner: string | null; // outra promoção que já dá preço menor para este produto
  } | null;
};

export async function previewPromotionAction(input: PromotionPreviewInput): Promise<ActionResult<PromotionPreview>> {
  await requireAdmin();
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  const v = parsed.data;
  try {
    const [count, totalActive] = await Promise.all([countScopeProducts(v), db.product.count({ where: { status: "ACTIVE" } })]);
    if (!count) return { ok: true, data: { count, totalActive, example: null } };
    const product = await db.product.findFirst({
      where: scopeWhere(v),
      orderBy: [{ soldCount: "desc" }, { priceCents: "desc" }],
      select: { id: true, name: true, priceCents: true, compareAtCents: true, categoryId: true, brandId: true, images: { select: { url: true }, orderBy: { sortOrder: "asc" }, take: 1 } },
    });
    if (!product) return { ok: true, data: { count, totalActive, example: null } };
    const draft: PromoLite = {
      id: "__preview__",
      name: "Esta promoção",
      type: v.type,
      value: v.value,
      scope: v.scope,
      flash: false,
      badge: null,
      priority: 0,
      endsAt: null,
      categoryIds: v.categoryIds,
      brandIds: v.brandIds,
      productIds: v.productIds,
    };
    const others = (await getActivePromotions()).filter((p) => p.id !== v.excludeId);
    const own = effectivePrice(product, null, [draft]);
    const combined = effectivePrice(product, null, [...others, draft]);
    const winner = combined.promotion && combined.promotion.id !== draft.id && combined.priceCents < own.priceCents ? combined.promotion.name : null;
    return {
      ok: true,
      data: {
        count,
        totalActive,
        example: {
          name: product.name,
          image: product.images[0]?.url ?? null,
          basePriceCents: own.basePriceCents,
          priceCents: own.priceCents,
          compareAtCents: own.compareAtCents,
          discountPercent: own.discountPercent,
          winner,
        },
      },
    };
  } catch (e) {
    console.error("[promoções] falha na prévia:", e);
    return fail("Não foi possível calcular a prévia.");
  }
}

// ───────── Ações da lista

export async function togglePromotionAction(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ id: entityId, active: z.boolean() }).safeParse({ id, active });
  if (!parsed.success) return fail("Dados inválidos.");
  try {
    const r = await db.promotion.updateMany({ where: { id: parsed.data.id }, data: { active: parsed.data.active } });
    if (!r.count) return fail("Esta promoção não existe mais.");
    refresh();
    return { ok: true, message: parsed.data.active ? "Promoção ativada." : "Promoção desativada." };
  } catch (e) {
    console.error("[promoções] falha ao ativar/desativar:", e);
    return fail("Não foi possível alterar a promoção.");
  }
}

export async function duplicatePromotionAction(id: string): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = entityId.safeParse(id);
  if (!parsed.success) return fail("Promoção inválida.");
  try {
    const p = await db.promotion.findUnique({ where: { id: parsed.data } });
    if (!p) return fail("Esta promoção não existe mais.");
    const { id: _id, createdAt: _c, updatedAt: _u, categoryIds, brandIds, productIds, ...rest } = p;
    const copy = await db.promotion.create({
      data: {
        ...rest,
        name: `${p.name} (cópia)`.slice(0, 120),
        active: false,
        ...scopeData({ scope: p.scope, categoryIds: jsonIds(categoryIds), brandIds: jsonIds(brandIds), productIds: jsonIds(productIds) }),
      },
      select: { id: true },
    });
    refresh();
    return { ok: true, data: { id: copy.id }, message: "Cópia criada (desativada)." };
  } catch (e) {
    console.error("[promoções] falha ao duplicar:", e);
    return fail("Não foi possível duplicar a promoção.");
  }
}

export async function deletePromotionAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = entityId.safeParse(id);
  if (!parsed.success) return fail("Promoção inválida.");
  try {
    const r = await db.promotion.deleteMany({ where: { id: parsed.data } });
    if (!r.count) return fail("Esta promoção já tinha sido excluída.");
    refresh();
    return { ok: true, message: "Promoção excluída. Os preços voltaram ao normal." };
  } catch (e) {
    console.error("[promoções] falha ao excluir:", e);
    return fail("Não foi possível excluir a promoção.");
  }
}
