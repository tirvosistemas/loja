"use client";

import { useState } from "react";
import { Check, Copy, QrCode } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

const KEY_TYPE_LABEL: Record<string, string> = {
  cnpj: "CNPJ",
  cpf: "CPF",
  email: "E-mail",
  phone: "Telefone",
  random: "Chave aleatória",
};

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Navegadores antigos ou sem permissão: cópia pela seleção.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

/** Chave Pix da loja com botão de copiar, valor e instruções do comprovante. */
export function PixInstructions({
  pixKey,
  keyType,
  holder,
  amountCents,
  hasWhatsapp,
}: {
  pixKey: string;
  keyType: string;
  holder: string;
  amountCents: number;
  hasWhatsapp: boolean;
}) {
  const [copied, setCopied] = useState<"key" | "amount" | null>(null);

  const copy = async (what: "key" | "amount") => {
    const text = what === "key" ? pixKey : (amountCents / 100).toFixed(2).replace(".", ",");
    const ok = await copyText(text);
    if (!ok) {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
      return;
    }
    setCopied(what);
    toast.success(what === "key" ? "Chave Pix copiada" : "Valor copiado");
    setTimeout(() => setCopied((c) => (c === what ? null : c)), 2500);
  };

  return (
    <section aria-labelledby="pix-titulo" className="rounded-2xl border border-primary/30 bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <QrCode className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="pix-titulo" className="text-lg font-semibold">
            Pague com Pix
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Abra o app do seu banco, escolha Pix com chave e use os dados abaixo.
          </p>
        </div>
      </div>

      {pixKey ? (
        <dl className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0 rounded-xl border border-border bg-elevated px-4 py-3">
            <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">Chave Pix · {KEY_TYPE_LABEL[keyType] ?? "Chave"}</dt>
            <dd className="mt-1 flex items-center justify-between gap-3">
              <span className="min-w-0 break-all font-mono text-[15px] font-medium">{pixKey}</span>
              <button
                type="button"
                onClick={() => copy("key")}
                className={cn(
                  "flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
                  copied === "key" ? "bg-success-soft text-success" : "bg-inverse text-inverse-foreground hover:opacity-90",
                )}
              >
                {copied === "key" ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied === "key" ? "Copiada" : "Copiar"}
              </button>
            </dd>
            {holder && <p className="mt-1.5 text-[13px] text-muted-foreground">Favorecido: {holder}</p>}
          </div>
          <div className="rounded-xl border border-border bg-elevated px-4 py-3 sm:min-w-48">
            <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">Valor</dt>
            <dd className="mt-1 flex items-center justify-between gap-3">
              <span className="tabular text-xl font-semibold">{formatBRL(amountCents)}</span>
              <button
                type="button"
                onClick={() => copy("amount")}
                aria-label="Copiar valor"
                className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {copied === "amount" ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              </button>
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
          A chave Pix da loja não está disponível agora. Peça a chave pelo WhatsApp ao enviar o pedido.
        </p>
      )}

      <ol className="mt-5 space-y-2 text-sm text-muted-foreground">
        <li className="flex gap-2.5">
          <span className="tabular font-mono text-xs text-primary">01</span> Faça o Pix de exatamente {formatBRL(amountCents)}.
        </li>
        <li className="flex gap-2.5">
          <span className="tabular font-mono text-xs text-primary">02</span>
          {hasWhatsapp ? "Envie o comprovante na conversa do pedido no WhatsApp." : "Guarde o comprovante: a loja vai pedir para confirmar."}
        </li>
        <li className="flex gap-2.5">
          <span className="tabular font-mono text-xs text-primary">03</span> Assim que confirmarmos, o status do pagamento muda aqui.
        </li>
      </ol>
    </section>
  );
}
