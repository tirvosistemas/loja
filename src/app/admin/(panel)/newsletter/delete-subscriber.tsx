"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteSubscriberAction } from "./actions";

export function DeleteSubscriber({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      variant="danger-ghost"
      size="icon"
      aria-label={`Remover ${email}`}
      title="Remover da newsletter?"
      description={`${email} deixa de receber as novidades da loja.`}
      confirmLabel="Remover"
      successMessage="E-mail removido."
      onConfirm={async () => {
        const r = await deleteSubscriberAction(id);
        if (r.ok) router.refresh();
        return r;
      }}
    >
      <Trash2 aria-hidden />
    </ConfirmButton>
  );
}
