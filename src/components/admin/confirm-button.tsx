"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/action";

/** Botão que pede confirmação antes de executar uma ação (ex.: excluir). */
export function ConfirmButton({
  onConfirm,
  title = "Tem certeza?",
  description = "Essa ação não pode ser desfeita.",
  confirmLabel = "Excluir",
  children,
  successMessage,
  ...buttonProps
}: Omit<ButtonProps, "onClick"> & {
  onConfirm: () => Promise<ActionResult<unknown> | void>;
  title?: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  successMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button {...buttonProps} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await onConfirm();
                  if (r && !r.ok) toast.error(r.error);
                  else {
                    if (successMessage) toast.success(successMessage);
                    setOpen(false);
                  }
                })
              }
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">{description}</p>
      </Dialog>
    </>
  );
}
