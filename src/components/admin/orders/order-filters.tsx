"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { PAYMENT_METHOD_SHORT, PAYMENT_STATUS_LABEL } from "@/lib/constants";
import { PAYMENT_METHODS, PAYMENT_STATUSES, PERIODS } from "./filters";

// A busca (?q=) fica com o SearchBox, que guarda o texto digitado.
const FILTER_KEYS = ["pagamento", "forma", "periodo", "de", "ate"];

/** Filtros de pagamento, forma e período. Atualizam a URL (a página recarrega no servidor). */
export function OrderFiltersBar() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    const qs = next.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  const period = sp.get("periodo") ?? "";
  const active = FILTER_KEYS.some((k) => sp.get(k));

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
        <Select
          aria-label="Status do pagamento"
          value={sp.get("pagamento") ?? ""}
          onChange={(e) => set({ pagamento: e.target.value || null })}
          className="sm:w-52"
        >
          <option value="">Todos os pagamentos</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PAYMENT_STATUS_LABEL[s].label}
            </option>
          ))}
        </Select>
        <Select aria-label="Forma de pagamento" value={sp.get("forma") ?? ""} onChange={(e) => set({ forma: e.target.value || null })} className="sm:w-52">
          <option value="">Todas as formas</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_SHORT[m]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Período"
          value={period}
          onChange={(e) => {
            const v = e.target.value;
            set({ periodo: v || null, ...(v !== "personalizado" ? { de: null, ate: null } : {}) });
          }}
          className="col-span-2 sm:col-span-1 sm:w-48"
        >
          <option value="">Qualquer data</option>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>

      {period === "personalizado" && (
        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:items-center">
          <label className="min-w-0">
            <span className="sr-only">De</span>
            <Input type="date" aria-label="Data inicial" value={sp.get("de") ?? ""} max={sp.get("ate") ?? undefined} onChange={(e) => set({ de: e.target.value || null })} className="sm:w-44" />
          </label>
          <label className="min-w-0">
            <span className="sr-only">Até</span>
            <Input type="date" aria-label="Data final" value={sp.get("ate") ?? ""} min={sp.get("de") ?? undefined} onChange={(e) => set({ ate: e.target.value || null })} className="sm:w-44" />
          </label>
        </div>
      )}

      <div className="flex items-center gap-2">
        {active && (
          <button
            type="button"
            onClick={() => set(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
          >
            <X className="size-4" aria-hidden /> Limpar filtros
          </button>
        )}
        {pending && <Loader2 className="size-4 animate-spin text-subtle" aria-label="Carregando" />}
      </div>
    </div>
  );
}
