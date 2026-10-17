"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/tabs";
import { CopyButton } from "./copy-button";

/** A mensagem do pedido que chegou no WhatsApp da loja (e a versão atualizada, se mudou). */
export function WhatsappMessage({ received, current }: { received: string; current: string | null }) {
  const [view, setView] = useState<"received" | "current">("received");
  const text = view === "current" && current ? current : received;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {current ? (
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "received", label: "Recebida" },
              { value: "current", label: "Atualizada" },
            ]}
          />
        ) : (
          <span className="text-[13px] text-subtle">Exatamente como chegou no WhatsApp da loja.</span>
        )}
        <CopyButton text={text} label="Copiar mensagem" toastMessage="Mensagem copiada." />
      </div>
      {view === "current" && current && <p className="text-[13px] text-subtle">Remontada com os dados atuais do pedido (ex.: pagamento confirmado).</p>}
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-elevated/50 p-4 font-mono text-[12.5px] leading-relaxed text-foreground">
        {text}
      </pre>
    </div>
  );
}
