"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, BellOff, BellRing, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePush } from "./use-pwa";

/** Botão para ativar/desativar as notificações de ofertas. */
export function PushToggleButton({ vapidPublicKey, className }: { vapidPublicKey: string; className?: string }) {
  const { state, busy, subscribe, unsubscribe } = usePush(vapidPublicKey);
  if (state === "unsupported" || !vapidPublicKey) return null;
  if (state === "denied")
    return (
      <p className="text-sm text-muted-foreground">
        <BellOff className="mr-1 inline size-4" aria-hidden /> Notificações bloqueadas. Libere nas configurações do navegador.
      </p>
    );
  if (state === "subscribed")
    return (
      <Button variant="outline" className={className} loading={busy} onClick={() => unsubscribe().then(() => toast("Notificações desativadas."))}>
        <BellRing aria-hidden /> Notificações ativas
      </Button>
    );
  return (
    <Button
      variant="primary"
      className={className}
      loading={busy}
      onClick={async () => {
        const ok = await subscribe();
        if (ok) toast.success("Pronto! Você vai receber as melhores ofertas primeiro.");
      }}
    >
      <Bell aria-hidden /> Ativar avisos de ofertas
    </Button>
  );
}

/**
 * Convite discreto (canto da tela) para ativar as notificações, depois de alguns segundos
 * de navegação. Não aparece de novo por 14 dias se a pessoa fechar.
 */
export function PushPrompt({ vapidPublicKey, delaySeconds = 25, enabled = true }: { vapidPublicKey: string; delaySeconds?: number; enabled?: boolean }) {
  const { state, busy, subscribe } = usePush(vapidPublicKey);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!enabled || !vapidPublicKey || state !== "default") return;
    let dismissedAt = 0;
    try {
      dismissedAt = Number(localStorage.getItem("tirvo-push-dismissed") || 0);
    } catch {}
    if (Date.now() - dismissedAt < 14 * 864e5) return;
    const t = setTimeout(() => setShow(true), delaySeconds * 1000);
    return () => clearTimeout(t);
  }, [enabled, vapidPublicKey, state, delaySeconds]);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem("tirvo-push-dismissed", String(Date.now()));
    } catch {}
  };

  return (
    <AnimatePresence>
      {show && state === "default" && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          // No celular fica acima do botão do WhatsApp e das barras fixas de compra (não cobre nenhum deles).
          className="fixed bottom-[8.75rem] left-4 right-4 z-[60] mx-auto max-w-sm rounded-2xl border border-border bg-card p-4 shadow-2xl sm:bottom-6 sm:left-6 sm:right-auto"
          role="dialog"
          aria-label="Ativar notificações"
        >
          <button type="button" onClick={dismiss} aria-label="Fechar" className="absolute right-1.5 top-1.5 grid size-10 place-items-center rounded-lg text-subtle hover:bg-elevated hover:text-foreground">
            <X className="size-4" aria-hidden />
          </button>
          <div className="flex gap-3 pr-8">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
              <BellRing className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold">Quer saber das promoções primeiro?</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Avisamos ofertas relâmpago e cupons. Sem spam.</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="h-10 flex-1"
              loading={busy}
              onClick={async () => {
                const ok = await subscribe();
                setShow(false);
                if (ok) toast.success("Notificações ativadas!");
              }}
            >
              Ativar avisos
            </Button>
            <Button size="sm" variant="ghost" className="h-10" onClick={dismiss}>
              Agora não
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
