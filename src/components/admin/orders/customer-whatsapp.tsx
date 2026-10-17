"use client";

import { useEffect, useId, useState } from "react";
import { MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { whatsappLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import type { CustomerTemplate, CustomerTemplateKey } from "./templates";

/** Escolhe uma mensagem pronta, permite editar e abre a conversa com o cliente. */
export function CustomerWhatsapp({ phone, templates, defaultKey }: { phone: string; templates: CustomerTemplate[]; defaultKey: CustomerTemplateKey }) {
  const id = useId();
  const initial = templates.find((t) => t.key === defaultKey) ?? templates[0];
  const [key, setKey] = useState<string>(initial?.key ?? "");
  const [text, setText] = useState(initial?.text ?? "");

  // Quando o pedido muda (página atualizada), sugere a mensagem nova.
  const signature = `${defaultKey}|${templates.map((t) => t.text).join("|")}`;
  useEffect(() => {
    const t = templates.find((x) => x.key === defaultKey) ?? templates[0];
    if (t) {
      setKey(t.key);
      setText(t.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <div className="space-y-2.5">
      <div>
        <label htmlFor={`${id}-tpl`} className="mb-1.5 block text-sm font-medium">
          Mensagem pronta
        </label>
        <Select
          id={`${id}-tpl`}
          value={key}
          onChange={(e) => {
            const t = templates.find((x) => x.key === e.target.value);
            setKey(e.target.value);
            setText(t?.text ?? "");
          }}
        >
          {templates.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
          <option value="livre">Mensagem em branco</option>
        </Select>
      </div>
      <div>
        <label htmlFor={`${id}-text`} className="sr-only">
          Texto da mensagem
        </label>
        <Textarea id={`${id}-text`} rows={6} value={text} onChange={(e) => setText(e.target.value)} className="text-sm" placeholder="Escreva a mensagem para o cliente" />
      </div>
      <a href={whatsappLink(phone, text.trim() || undefined)} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "whatsapp", block: true }))}>
        <MessageCircle aria-hidden /> Falar no WhatsApp
      </a>
    </div>
  );
}
