"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CopyPlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmButton } from "@/components/admin/confirm-button";
import type { ActionResult } from "@/lib/action";

/** Executa uma ação da lista com aviso e atualiza a página. */
export function useListAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult<unknown>>, opts: { quiet?: boolean; onFail?: () => void } = {}) =>
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) {
          toast.error(r.error);
          opts.onFail?.();
          return;
        }
        if (!opts.quiet && r.message) toast.success(r.message);
        router.refresh();
      } catch {
        toast.error("Falha de conexão. Tente de novo.");
        opts.onFail?.();
      }
    });
  return { pending, run };
}

/** Chave liga/desliga com atualização otimista. */
export function ActiveToggle({
  id,
  label,
  active,
  action,
  feminine,
}: {
  id: string;
  label: string;
  active: boolean;
  action: (id: string, active: boolean) => Promise<ActionResult>;
  feminine?: boolean;
}) {
  const { pending, run } = useListAction();
  const [on, setOn] = useState(active);
  useEffect(() => setOn(active), [active]);
  return (
    <label className="relative inline-flex min-h-10 cursor-pointer items-center">
      <Switch
        checked={on}
        disabled={pending}
        onChange={(c) => {
          setOn(c);
          run(() => action(id, c), { onFail: () => setOn(!c) });
        }}
      />
      <span aria-hidden className="ml-2.5 text-sm text-muted-foreground xl:hidden">
        {on ? (feminine ? "Ligada" : "Ligado") : feminine ? "Desligada" : "Desligado"}
      </span>
      <span className="sr-only">Ativo: {label}</span>
    </label>
  );
}

/** Editar, duplicar e excluir (promoções e cupons). */
export function RowActions({
  editHref,
  name,
  noun,
  onDuplicate,
  onDelete,
  deleteDescription,
}: {
  editHref: string;
  name: string;
  noun: string;
  onDuplicate?: () => Promise<ActionResult<unknown>>;
  onDelete: () => Promise<ActionResult<unknown>>;
  deleteDescription: string;
}) {
  const router = useRouter();
  const { pending, run } = useListAction();
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Link href={editHref} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={`Editar ${name}`} title="Editar">
        <Pencil aria-hidden />
      </Link>
      {onDuplicate && (
        <Button variant="ghost" size="icon" disabled={pending} onClick={() => run(onDuplicate)} aria-label={`Duplicar ${name}`} title="Duplicar">
          <CopyPlus aria-hidden />
        </Button>
      )}
      <ConfirmButton
        variant="danger-ghost"
        size="icon"
        aria-label={`Excluir ${name}`}
        title={`Excluir ${noun}?`}
        description={deleteDescription}
        onConfirm={async () => {
          const r = await onDelete();
          if (r.ok) {
            if (r.message) toast.success(r.message);
            router.refresh();
          }
          return r;
        }}
      >
        <Trash2 aria-hidden />
      </ConfirmButton>
    </div>
  );
}
