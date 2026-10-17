"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fail, fromZod, type ActionResult } from "@/lib/action";
import { sendPushToAll } from "@/lib/push";
import { rateLimit } from "@/lib/rate-limit";
import { imageUrl } from "@/lib/images";
import { absoluteUrl } from "@/lib/utils";
import { PUSH_BODY_MAX, PUSH_TITLE_MAX } from "@/components/admin/marketing/labels";
import { hrefSchema, imageKeySchema, textMax } from "@/components/admin/marketing/rules";

// Notificações push para quem instalou o app ou permitiu avisos no site.

const campaignSchema = z.object({
  title: textMax(PUSH_TITLE_MAX, `Use até ${PUSH_TITLE_MAX} caracteres.`).refine((s) => s.length > 0, "Escreva o título."),
  body: textMax(PUSH_BODY_MAX, `Use até ${PUSH_BODY_MAX} caracteres.`).refine((s) => s.length > 0, "Escreva a mensagem."),
  url: hrefSchema,
  image: imageKeySchema.nullable().default(null),
});

export type CampaignInput = z.input<typeof campaignSchema>;
export type CampaignResult = { sent: number; failed: number; total: number };

export async function sendCampaignAction(input: CampaignInput): Promise<ActionResult<CampaignResult>> {
  const session = await requireAdmin();
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const v = parsed.data;

  // Evita envio em dobro por clique repetido.
  if (!rateLimit(`push-campaign:${session.sub}`, 3, 60_000).ok) return fail("Aguarde um minuto antes de enviar outra notificação.");

  const subscribers = await db.pushSubscription.count();
  if (!subscribers) return fail("Ainda não há ninguém inscrito para receber notificações.");

  const url = v.url ?? "/";
  try {
    const result = await sendPushToAll({
      title: v.title,
      body: v.body,
      url,
      image: v.image ? (/^https:\/\//i.test(v.image) ? v.image : absoluteUrl(imageUrl(v.image, "md"))) : undefined,
      tag: `campanha-${Date.now()}`,
    });
    await db.pushCampaign.create({
      data: { title: v.title, body: v.body, url, image: v.image, sentCount: result.sent, failedCount: result.failed, sentAt: new Date() },
    });
    revalidatePath("/admin/notificacoes");
    if (result.sent === 0) return fail("Nenhum aparelho recebeu a notificação. As inscrições inválidas foram removidas.");
    const message = `Enviado para ${result.sent.toLocaleString("pt-BR")} ${result.sent === 1 ? "pessoa" : "pessoas"}.`;
    return { ok: true, data: result, message };
  } catch (e) {
    console.error("[notificações] falha ao enviar:", e);
    return fail("Não foi possível enviar agora. Confira a configuração em Configurações → App e notificações.");
  }
}
