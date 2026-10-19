"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { quickCreateBrand } from "@/app/admin/(panel)/marcas/actions";

/** Cadastro rápido de marca sem sair do formulário de produto. */
export function BrandQuickCreate({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (brand: { id: string; name: string }) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const close = () => {
    setError(undefined);
    onClose();
  };

  const submit = () =>
    start(async () => {
      let r: Awaited<ReturnType<typeof quickCreateBrand>>;
      try {
        r = await quickCreateBrand(name);
      } catch {
        setError("Falha de conexão. Tente de novo.");
        return;
      }
      if (!r.ok) {
        setError(r.fieldErrors?.name ?? r.error);
        return;
      }
      if (r.data) onCreated(r.data);
      toast.success(r.message ?? "Marca cadastrada.");
      setName("");
      close();
    });

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Nova marca"
      description="Cadastro rápido. O logo você adiciona depois em Marcas."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button loading={pending} onClick={submit}>
            Cadastrar marca
          </Button>
        </>
      }
    >
      <Field label="Nome da marca" htmlFor="quick-brand-name" required error={error}>
        <Input
          id="quick-brand-name"
          value={name}
          maxLength={80}
          autoComplete="off"
          placeholder="ex.: JBL"
          aria-invalid={!!error}
          onChange={(e) => {
            setName(e.target.value);
            setError(undefined);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
      </Field>
    </Dialog>
  );
}
