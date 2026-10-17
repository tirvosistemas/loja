import webpush from "web-push";
import { db } from "./db";
import { getSettings, saveSettingsGroup } from "./settings";
import { isPushEndpoint } from "./validators";

// Notificações push do app (PWA). As chaves VAPID são geradas sozinhas no primeiro uso e
// ficam em Configurações → App e notificações.

export type PushPayload = { title: string; body: string; url?: string; image?: string; tag?: string };

// Geração em andamento: várias páginas abertas ao mesmo tempo no primeiro uso não podem
// criar pares de chaves diferentes (inscrições feitas com a chave descartada nunca recebem nada).
let generating: Promise<{ publicKey: string; privateKey: string }> | null = null;

export async function ensureVapidKeys() {
  const s = await getSettings();
  if (s.push.vapidPublicKey && s.push.vapidPrivateKey) {
    return { publicKey: s.push.vapidPublicKey, privateKey: s.push.vapidPrivateKey, subject: s.push.subject };
  }
  generating ??= (async () => {
    const keys = webpush.generateVAPIDKeys();
    await saveSettingsGroup("push", { vapidPublicKey: keys.publicKey, vapidPrivateKey: keys.privateKey });
    return keys;
  })().finally(() => {
    generating = null;
  });
  const keys = await generating;
  return { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: s.push.subject };
}

export async function getVapidPublicKey() {
  return (await ensureVapidKeys()).publicKey;
}

/** Envia para todos os inscritos. Remove inscrições expiradas (404/410) ou que falham demais. */
export async function sendPushToAll(payload: PushPayload) {
  const vapid = await ensureVapidKeys();
  const subject = vapid.subject.startsWith("mailto:") || vapid.subject.startsWith("https://") ? vapid.subject : `mailto:${vapid.subject}`;
  const subs = await db.pushSubscription.findMany();
  const body = JSON.stringify({ ...payload, icon: "/icon-192.png", badge: "/favicon-32.png" });
  let sent = 0;
  let failed = 0;
  const BATCH = 50;
  for (let i = 0; i < subs.length; i += BATCH) {
    await Promise.all(
      subs.slice(i, i + BATCH).map(async (s) => {
        // Endereço que não é de um serviço de push (gravado antes da validação): descarta.
        if (!isPushEndpoint(s.endpoint)) {
          failed++;
          await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => null);
          return;
        }
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { vapidDetails: { subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey }, TTL: 60 * 60 * 24, timeout: 15_000 },
          );
          sent++;
          await db.pushSubscription.update({ where: { id: s.id }, data: { lastSentAt: new Date(), failures: 0 } }).catch(() => null);
        } catch (e) {
          failed++;
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410 || s.failures >= 4) {
            await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => null);
          } else {
            await db.pushSubscription.update({ where: { id: s.id }, data: { failures: { increment: 1 } } }).catch(() => null);
          }
        }
      }),
    );
  }
  return { sent, failed, total: subs.length };
}
