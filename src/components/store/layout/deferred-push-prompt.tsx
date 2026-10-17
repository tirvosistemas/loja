"use client";

import { usePathname } from "next/navigation";
import { PushPrompt } from "@/components/pwa/push-optin";
import { useConsent } from "./consent";

/**
 * Convite das notificações só depois da escolha dos cookies (para não empilhar avisos) e
 * fora do checkout. O invólucro sobe o convite acima da barra inferior do celular.
 */
export function DeferredPushPrompt({ vapidPublicKey, delaySeconds, enabled }: { vapidPublicKey: string; delaySeconds: number; enabled: boolean }) {
  const consent = useConsent();
  const pathname = usePathname();
  if (!enabled || !vapidPublicKey || consent === "" || consent === "pending" || pathname.startsWith("/checkout")) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] h-0 [transform:translateY(calc(-1*env(safe-area-inset-bottom)))] sm:[transform:translateY(calc(-4rem-env(safe-area-inset-bottom)))] md:[transform:none]">
      <PushPrompt vapidPublicKey={vapidPublicKey} delaySeconds={delaySeconds} enabled={enabled} />
    </div>
  );
}
