"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, CopyPlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteBannerAction, duplicateBannerAction, moveBannerAction, toggleBannerAction } from "@/app/admin/(panel)/banners/actions";
import type { ActionResult } from "@/lib/action";

/** Ações de um cartão de banner: ativar, mudar a ordem, editar, duplicar e excluir. */
export function BannerActions({ id, title, active, first, last }: { id: string; title: string; active: boolean; first: boolean; last: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [on, setOn] = useState(active);

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

  return (
    <div className="flex items-center gap-1">
      <label className="relative mr-auto flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm text-muted-foreground">
        <Switch
          checked={on}
          disabled={pending}
          onChange={(c) => {
            setOn(c);
            run(() => toggleBannerAction(id, c), { onFail: () => setOn(!c) });
          }}
        />
        <span aria-hidden className="hidden sm:inline">
          {on ? "Ligado" : "Desligado"}
        </span>
        <span className="sr-only">Mostrar “{title}” na loja</span>
      </label>
      <Button variant="ghost" size="icon" disabled={first || pending} onClick={() => run(() => moveBannerAction(id, "up"), { quiet: true })} aria-label={`Mover “${title}” para antes`} title="Mover para antes">
        <ArrowUp aria-hidden />
      </Button>
      <Button variant="ghost" size="icon" disabled={last || pending} onClick={() => run(() => moveBannerAction(id, "down"), { quiet: true })} aria-label={`Mover “${title}” para depois`} title="Mover para depois">
        <ArrowDown aria-hidden />
      </Button>
      <Link href={`/admin/banners/${id}`} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={`Editar “${title}”`} title="Editar">
        <Pencil aria-hidden />
      </Link>
      <Button variant="ghost" size="icon" disabled={pending} onClick={() => run(() => duplicateBannerAction(id))} aria-label={`Duplicar “${title}”`} title="Duplicar">
        <CopyPlus aria-hidden />
      </Button>
      <ConfirmButton
        variant="danger-ghost"
        size="icon"
        aria-label={`Excluir “${title}”`}
        title="Excluir banner?"
        onConfirm={async () => {
          const r = await deleteBannerAction(id);
          if (r.ok) router.refresh();
          return r;
        }}
        successMessage="Banner excluído."
        description={`O banner “${title}” sai da loja e não pode ser recuperado.`}
      >
        <Trash2 aria-hidden />
      </ConfirmButton>
    </div>
  );
}
