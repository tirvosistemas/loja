"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Undo2 } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Campo de chave secreta. A chave salva nunca volta para o navegador: mostramos só a
 * prévia mascarada. Vazio mantém a atual; “Remover” apaga ao salvar.
 */
export function SecretInput({
  id,
  value,
  onChange,
  preview,
  cleared,
  onClearChange,
  placeholder = "Cole a chave aqui",
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  preview: string;
  cleared: boolean;
  onClearChange: (v: boolean) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [show, setShow] = useState(false);

  if (cleared) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-danger/40 bg-danger-soft px-3.5 py-2 text-sm">
        <span>A chave será removida ao salvar.</span>
        <button type="button" onClick={() => onClearChange(false)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 font-medium hover:bg-card">
          <Undo2 className="size-4" aria-hidden /> Desfazer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Input
            id={id}
            type={show ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value.trim())}
            placeholder={preview ? `${preview} · deixe em branco para manter` : placeholder}
            aria-invalid={invalid}
            className="font-mono text-sm"
            leading={<KeyRound />}
            trailing={
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Ocultar chave" : "Mostrar chave"}
                className="grid size-9 place-items-center rounded-lg text-subtle hover:bg-elevated hover:text-foreground"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
        </div>
        {preview && !value && (
          <button type="button" onClick={() => onClearChange(true)} className="h-11 shrink-0 rounded-xl px-3 text-sm font-medium text-danger transition-colors hover:bg-danger-soft">
            Remover
          </button>
        )}
      </div>
      {preview && (
        <p className="text-[13px] text-subtle">
          Salva: <span className="font-mono">{preview}</span>
        </p>
      )}
    </div>
  );
}
