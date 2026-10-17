"use client";

import { usePathname } from "next/navigation";
import { whatsappLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { WhatsAppIcon } from "./social-icons";

const GREETING = "Olá! Vim pelo site da Tirvo e queria tirar uma dúvida.";

/** Botão flutuante do WhatsApp (fica acima da barra inferior no celular). */
export function WhatsAppFloat({ phone }: { phone: string }) {
  const pathname = usePathname();
  if (!phone || pathname.startsWith("/checkout")) return null;
  // No produto e no carrinho, no celular/tablet, a barra fixa de compra ocupa esse canto.
  const hideBelowLg = pathname.startsWith("/produto/") || pathname === "/carrinho";
  return (
    <a
      href={whatsappLink(phone, GREETING)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar com a Tirvo no WhatsApp"
      className={cn(
        "group fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 md:bottom-6 md:right-6",
        hideBelowLg && "max-lg:hidden",
      )}
    >
      <span className="pointer-events-none hidden translate-x-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground opacity-0 shadow-card transition-all group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 md:block">
        Fale com a gente
      </span>
      <span className="grid size-13 place-items-center rounded-full bg-whatsapp text-[#04210f] shadow-[0_10px_30px_-8px_rgb(37_211_102/0.6)] transition-transform group-hover:scale-105 group-active:scale-95 md:size-14">
        <WhatsAppIcon className="size-6 md:size-7" />
      </span>
    </a>
  );
}
