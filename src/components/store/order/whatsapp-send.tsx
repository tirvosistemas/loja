"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/store/layout/social-icons";
import { cn } from "@/lib/utils";

// Botão "Enviar pedido pelo WhatsApp". Logo depois de finalizar a compra, abre o WhatsApp
// sozinho uma única vez por pedido (marca na sessão do navegador); o botão fica de reserva.

export function WhatsAppSend({
  code,
  href,
  autoOpen = false,
  label = "Enviar pedido pelo WhatsApp",
  variant = "whatsapp",
  size = "xl",
  className,
}: {
  code: string;
  href: string;
  autoOpen?: boolean;
  label?: string;
  variant?: "whatsapp" | "outline" | "secondary";
  size?: "md" | "lg" | "xl";
  className?: string;
}) {
  const [opening, setOpening] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flag = `tirvo-wa-${code}`;

  useEffect(() => {
    if (!autoOpen) return;
    let already = false;
    try {
      already = !!sessionStorage.getItem(flag);
    } catch {
      return;
    }
    if (already) return;
    setOpening(true);
    timer.current = setTimeout(() => {
      try {
        sessionStorage.setItem(flag, "1");
      } catch {}
      window.location.href = href;
    }, 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      setOpening(false);
    };
  }, [autoOpen, flag, href]);

  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    try {
      sessionStorage.setItem(flag, "1");
    } catch {}
    setOpening(false);
  };

  return (
    <div className={cn("flex flex-col items-stretch gap-2 sm:items-start", className)}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          try {
            sessionStorage.setItem(flag, "1");
          } catch {}
          cancel();
        }}
        className={buttonVariants({ variant, size, className: "w-full sm:w-auto" })}
      >
        <WhatsAppIcon aria-hidden />
        {label}
      </a>
      <div aria-live="polite" className="min-h-0">
        {opening && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Abrindo o WhatsApp…
            <button type="button" onClick={cancel} className="min-h-9 font-medium text-foreground underline-offset-4 hover:underline">
              Agora não
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
