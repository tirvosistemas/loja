"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { isIos, isStandalone } from "@/components/pwa/use-pwa";
import { cn } from "@/lib/utils";

/** Explica por que o botão de avisos não aparece (navegador sem suporte ou iPhone sem o app). */
export function PushSupportHint({ className }: { className?: string }) {
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (supported) return;
    if (isIos() && !isStandalone()) {
      setHint("No iPhone, os avisos funcionam depois de adicionar a loja à Tela de Início. Siga os passos acima e abra pelo ícone novo.");
    } else {
      setHint("Este navegador não permite notificações. Tente pelo Chrome, Edge ou Safari atualizados.");
    }
  }, []);

  if (!hint) return null;
  return (
    <p className={cn("flex items-start gap-2 text-sm text-muted-foreground", className)}>
      <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
      {hint}
    </p>
  );
}
