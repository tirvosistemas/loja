"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { AdminTable } from "@/components/admin/page-header";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { formatDateTime } from "@/lib/format";
import { deletePage, setPageFlag } from "@/app/admin/(panel)/paginas/actions";
import { useAdminAction } from "./use-action";

export type PageRow = { id: string; title: string; slug: string; published: boolean; showInFooter: boolean; sortOrder: number; updatedAt: string };

const iconBtn =
  "grid size-10 place-items-center rounded-xl text-subtle transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

function FlagSwitch({ p, flag }: { p: PageRow; flag: "published" | "showInFooter" }) {
  const { run, pending } = useAdminAction();
  const [on, setOn] = useState(p[flag]);
  useEffect(() => setOn(p[flag]), [p, flag]);
  const text = flag === "published" ? (on ? "Publicada" : "Rascunho") : on ? "No rodapé" : "Fora do rodapé";
  return (
    <Switch
      checked={on}
      disabled={pending}
      onChange={(v) => {
        setOn(v);
        run(() => setPageFlag(p.id, flag, v), { onError: () => setOn(!v) });
      }}
      label={
        <>
          <span className="text-[13px] font-normal text-muted-foreground">{text}</span>
          <span className="sr-only"> · {p.title}</span>
        </>
      }
      className="flex-row-reverse items-center justify-end gap-2.5"
    />
  );
}

function Actions({ p }: { p: PageRow }) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-end">
      <a href={`/pagina/${p.slug}`} target="_blank" rel="noopener noreferrer" className={iconBtn} aria-label={`Ver ${p.title} na loja`} title="Ver na loja">
        <ExternalLink className="size-4" aria-hidden />
      </a>
      <Link href={`/admin/paginas/${p.id}`} className={iconBtn} aria-label={`Editar ${p.title}`} title="Editar">
        <Pencil className="size-4" aria-hidden />
      </Link>
      <ConfirmButton
        variant="ghost"
        size="icon"
        className="text-subtle hover:bg-danger-soft hover:text-danger"
        aria-label={`Excluir ${p.title}`}
        title={`Excluir “${p.title}”?`}
        description="A página sai do rodapé e o link dela deixa de abrir. Links para ela em outros textos param de funcionar."
        onConfirm={async () => {
          const r = await deletePage(p.id);
          if (r.ok) {
            toast.success(r.message ?? "Página excluída.");
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

export function PagesTable({ pages }: { pages: PageRow[] }) {
  return (
    <>
      <AdminTable className="hidden md:block">
        <thead>
          <tr>
            <th scope="col">Página</th>
            <th scope="col">Situação</th>
            <th scope="col">Rodapé</th>
            <th scope="col" className="!text-right">
              Ordem
            </th>
            <th scope="col">Atualizada em</th>
            <th scope="col" className="!text-right">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {pages.map((p) => (
            <tr key={p.id}>
              <td className="max-w-[320px]">
                <Link href={`/admin/paginas/${p.id}`} className="block truncate font-medium hover:text-primary">
                  {p.title}
                </Link>
                <p className="truncate font-mono text-xs text-subtle">/pagina/{p.slug}</p>
              </td>
              <td>
                <FlagSwitch p={p} flag="published" />
              </td>
              <td>
                <FlagSwitch p={p} flag="showInFooter" />
              </td>
              <td className="tabular text-right text-[13px] text-muted-foreground">{p.sortOrder}</td>
              <td className="tabular whitespace-nowrap text-[13px] text-muted-foreground">{formatDateTime(p.updatedAt)}</td>
              <td className="!pl-0">
                <Actions p={p} />
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>

      <ul className="space-y-2.5 md:hidden">
        {pages.map((p) => (
          <li key={p.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/admin/paginas/${p.id}`} className="block truncate font-medium">
                  {p.title}
                </Link>
                <p className="truncate font-mono text-xs text-subtle">/pagina/{p.slug}</p>
              </div>
              <span className="tabular shrink-0 rounded-md border border-border px-1.5 font-mono text-[11px] text-subtle" title="Ordem no rodapé">
                #{p.sortOrder}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              <FlagSwitch p={p} flag="published" />
              <FlagSwitch p={p} flag="showInFooter" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
              <p className="tabular text-xs text-subtle">Atualizada em {formatDateTime(p.updatedAt)}</p>
              <Actions p={p} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
