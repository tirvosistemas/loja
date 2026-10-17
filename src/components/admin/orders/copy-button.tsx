"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  // Navegadores sem a API (ou fora de HTTPS): copia por um campo temporário.
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("copy");
}

/** Botão que copia um texto e mostra “Copiado”. */
export function CopyButton({
  text,
  label = "Copiar",
  copiedLabel = "Copiado",
  toastMessage = "Copiado para a área de transferência.",
  iconOnly,
  variant = "secondary",
  size = "sm",
  ...rest
}: Omit<ButtonProps, "onClick" | "children"> & { text: string; label?: string; copiedLabel?: string; toastMessage?: string; iconOnly?: boolean }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <Button
      variant={variant}
      size={iconOnly ? "icon-sm" : size}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      onClick={async () => {
        try {
          await writeClipboard(text);
          setCopied(true);
          if (toastMessage) toast.success(toastMessage);
        } catch {
          toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
        }
      }}
      {...rest}
    >
      {copied ? <Check aria-hidden className="text-success" /> : <Copy aria-hidden />}
      {!iconOnly && (copied ? copiedLabel : label)}
    </Button>
  );
}
