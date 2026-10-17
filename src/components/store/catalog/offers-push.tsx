"use client";

import { BellRing } from "lucide-react";
import { usePush } from "@/components/pwa/use-pwa";
import { PushToggleButton } from "@/components/pwa/push-optin";

/** Convite para receber as ofertas por notificação (some quando o navegador não suporta). */
export function OffersPushCta({ vapidPublicKey }: { vapidPublicKey: string }) {
  const { state } = usePush(vapidPublicKey);
  if (!vapidPublicKey || state === "unsupported" || state === "denied") return null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/60 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
        <BellRing className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span>
          {state === "subscribed" ? (
            "Você recebe as próximas ofertas por notificação."
          ) : (
            <>
              <span className="font-medium text-foreground">Receba as ofertas primeiro.</span> Avisamos no celular quando começar uma promoção.
            </>
          )}
        </span>
      </p>
      <PushToggleButton vapidPublicKey={vapidPublicKey} className="shrink-0" />
    </div>
  );
}
