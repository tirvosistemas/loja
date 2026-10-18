"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { saveAdminNotesAction } from "@/app/admin/(panel)/pedidos/actions";

/** Anotações internas do pedido (o cliente não vê). */
export function AdminNotes({ orderId, initial }: { orderId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = value.trim() !== saved.trim();

  return (
    <form
      className="space-y-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          let r: Awaited<ReturnType<typeof saveAdminNotesAction>>;
          try {
            r = await saveAdminNotesAction(orderId, value);
          } catch {
            toast.error("Falha de conexão. Tente de novo.");
            return;
          }
          if (r.ok) {
            setSaved(value);
            toast.success(r.message ?? "Anotações salvas.");
          } else toast.error(r.error);
        });
      }}
    >
      <label htmlFor="admin-notes" className="sr-only">
        Anotações internas
      </label>
      <Textarea
        id="admin-notes"
        rows={4}
        maxLength={5000}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ex.: cliente pediu para ligar antes de sair, entregar após as 14h…"
        className="text-sm"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-subtle">{dirty ? "Alterações não salvas" : "Só a equipe vê estas anotações."}</span>
        <Button type="submit" size="sm" variant={dirty ? "primary" : "secondary"} disabled={!dirty} loading={pending}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
