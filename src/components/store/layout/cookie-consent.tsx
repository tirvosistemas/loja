"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveConsent, useConsent } from "./consent";

/** Aviso de cookies (LGPD). A medição só liga depois de "Aceitar". */
export function CookieConsent() {
  const consent = useConsent();
  const show = consent === "";
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25 }}
          role="region"
          aria-label="Aviso de cookies"
          className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[55] mx-auto max-w-xl rounded-2xl border border-border-strong bg-card p-4 shadow-2xl md:inset-x-auto md:bottom-6 md:left-6 md:mx-0 md:max-w-md"
        >
          <div className="flex gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-elevated text-primary">
              <Cookie className="size-[18px]" aria-hidden />
            </span>
            <p className="text-sm text-muted-foreground">
              Usamos cookies essenciais para o carrinho e o site funcionarem e, com a sua permissão, cookies de medição para melhorar a loja.{" "}
              <Link href="/pagina/politica-de-privacidade" className="font-medium text-foreground underline underline-offset-2 hover:text-primary">
                Política de privacidade
              </Link>
            </p>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="h-10 flex-1" onClick={() => saveConsent("all")}>
              Aceitar
            </Button>
            <Button size="sm" variant="secondary" className="h-10 flex-1" onClick={() => saveConsent("essential")}>
              Só essenciais
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
