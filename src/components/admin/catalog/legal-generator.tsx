"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scale } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Switch } from "@/components/ui/switch";
import { Callout, NumberInput } from "@/components/admin/settings/form-kit";
import { generateLegalPages } from "@/app/admin/(panel)/paginas/actions";
import type { LegalPageId } from "@/lib/legal-pages";

/** Gera trocas, privacidade, termos e entregas com os dados das Configurações. */
export function LegalGenerator({ pages, existing, missing }: { pages: { id: LegalPageId; title: string; summary: string }[]; existing: string[]; missing: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ids, setIds] = useState<Set<LegalPageId>>(new Set(pages.filter((p) => !existing.includes(p.id)).map((p) => p.id)));
  const [overwrite, setOverwrite] = useState(false);
  const [returnDays, setReturnDays] = useState<number | null>(7);
  const [defectDays, setDefectDays] = useState<number | null>(90);
  const [pending, setPending] = useState(false);

  const run = async () => {
    setPending(true);
    try {
      const r = await generateLegalPages({ ids: [...ids], overwrite, returnDays: returnDays ?? 7, defectDays: defectDays ?? 90 });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Páginas geradas.");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Falha de conexão. Tente de novo.");
    } finally {
      setPending(false);
    }
  };

  const willReplace = pages.some((p) => ids.has(p.id) && existing.includes(p.id));

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Scale aria-hidden /> Gerar páginas legais
      </Button>
      <Dialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Gerar páginas legais"
        description="Textos prontos com o nome, CNPJ, endereço, frete e pagamentos da sua loja. Você pode editar depois."
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="button" onClick={run} loading={pending} disabled={!ids.size}>
              Gerar {ids.size > 0 && `(${ids.size})`}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {missing.length > 0 && (
            <Callout tone="warning" title="Faltam dados da empresa">
              Preencha {missing.join(", ")} em{" "}
              <Link href="/admin/configuracoes" className="font-medium text-foreground underline-offset-4 hover:underline">
                Configurações → Loja / Endereço
              </Link>
              . A lei (Decreto 7.962/2013) exige que a loja online mostre esses dados.
            </Callout>
          )}
          <ul className="space-y-2">
            {pages.map((p) => (
              <li key={p.id} className="rounded-xl border border-border p-3">
                <Checkbox
                  checked={ids.has(p.id)}
                  onChange={(on) =>
                    setIds((s) => {
                      const n = new Set(s);
                      if (on) n.add(p.id);
                      else n.delete(p.id);
                      return n;
                    })
                  }
                  label={
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{p.title}</span>
                      {existing.includes(p.id) && (
                        <Badge tone="neutral" size="sm">
                          já existe
                        </Badge>
                      )}
                    </span>
                  }
                />
                <p className="ml-7 mt-0.5 text-[13px] text-muted-foreground">{p.summary}</p>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="mb-1.5 block font-medium">Prazo de arrependimento</span>
              <NumberInput integer min={7} max={90} value={returnDays} onChange={setReturnDays} suffix="dias" />
            </label>
            <label className="text-sm">
              <span className="mb-1.5 block font-medium">Prazo para defeito</span>
              <NumberInput integer min={90} max={365} value={defectDays} onChange={setDefectDays} suffix="dias" />
            </label>
          </div>
          <p className="text-xs text-subtle">Mínimos da lei: 7 dias de arrependimento e 90 dias para defeito em produtos duráveis.</p>
          {willReplace && (
            <Switch checked={overwrite} onChange={setOverwrite} label="Substituir as páginas que já existem" description="Desligado, as que já existem ficam como estão." />
          )}
          <p className="text-xs text-subtle">Modelo de referência, não é consultoria jurídica. Para casos específicos, consulte um advogado.</p>
        </div>
      </Dialog>
    </>
  );
}
