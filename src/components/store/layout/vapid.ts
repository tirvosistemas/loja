import { cache } from "react";
import { getPublicSettings } from "@/lib/settings";
import { getVapidPublicKey } from "@/lib/push";

/**
 * Chave pública das notificações. Se a loja ainda não tem chaves, elas são geradas no
 * primeiro acesso (uma vez por requisição, compartilhada entre layout e páginas).
 */
export const getStoreVapidKey = cache(async (): Promise<string> => {
  const s = await getPublicSettings();
  if (s.push.vapidPublicKey) return s.push.vapidPublicKey;
  try {
    return await getVapidPublicKey();
  } catch {
    return "";
  }
});
