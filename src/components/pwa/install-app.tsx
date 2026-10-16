"use client";

import { useState } from "react";
import { Download, Share, SquarePlus, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useInstallPrompt } from "./use-pwa";

/**
 * Botão "Baixar o app". No Android/computador abre a instalação nativa; no iPhone mostra
 * o passo a passo (Compartilhar → Adicionar à Tela de Início). Some quando já está instalado.
 */
export function InstallAppButton({
  variant = "secondary",
  size = "md",
  label = "Baixar o app",
  className,
  block,
}: {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "inverse";
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
  block?: boolean;
}) {
  const { canPrompt, installed, ios, install } = useInstallPrompt();
  const [help, setHelp] = useState(false);
  if (installed) return null;

  const onClick = async () => {
    if (canPrompt) {
      const r = await install();
      if (r === "accepted") toast.success("App instalado! Procure o ícone da Tirvo na sua tela inicial.");
      return;
    }
    setHelp(true);
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={onClick} className={className} block={block}>
        <Download /> {label}
      </Button>
      <Dialog open={help} onClose={() => setHelp(false)} title="Instale o app da Tirvo" description="Grátis, leve e sem ocupar espaço. Receba ofertas antes de todo mundo." size="sm">
        {ios ? (
          <ol className="space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-elevated"><Share className="size-4" /></span>
              <span>No Safari, toque em <b>Compartilhar</b> (o quadrado com a seta, na barra de baixo).</span>
            </li>
            <li className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-elevated"><SquarePlus className="size-4" /></span>
              <span>Escolha <b>Adicionar à Tela de Início</b> e toque em <b>Adicionar</b>.</span>
            </li>
            <li className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-elevated"><Smartphone className="size-4" /></span>
              <span>Abra a Tirvo pelo ícone novo e ative as notificações de ofertas.</span>
            </li>
          </ol>
        ) : (
          <ol className="space-y-4 text-sm">
            <li className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-elevated">1</span>
              <span>Abra o menu do navegador (os três pontinhos <b>⋮</b>).</span>
            </li>
            <li className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-elevated">2</span>
              <span>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</span>
            </li>
            <li className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-elevated">3</span>
              <span>Pronto: a Tirvo abre como um aplicativo, em tela cheia.</span>
            </li>
          </ol>
        )}
      </Dialog>
    </>
  );
}
