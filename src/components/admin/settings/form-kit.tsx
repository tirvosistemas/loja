"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Info, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field as FieldBase } from "@/components/ui/input";
import { useUnsavedGuard } from "@/components/admin/catalog/use-action";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/action";

/** Estado local de um formulário de configurações, com salvamento por server action. */
export function useSettingsForm<T extends Record<string, unknown>, R = unknown>(
  initial: T,
  save: (values: T) => Promise<ActionResult<R>>,
  opts: { onSaved?: (result: R | undefined, values: T) => T | void } = {},
) {
  const router = useRouter();
  const [values, setValues] = useState<T>(initial);
  const [saved, setSaved] = useState<T>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key as string]) return e;
      const { [key as string]: _removed, ...rest } = e;
      return rest;
    });
  }, []);

  const patch = useCallback((p: Partial<T>) => setValues((v) => ({ ...v, ...p })), []);
  /** Atualiza valores que já foram gravados por outra ação (não conta como alteração). */
  const commit = useCallback((p: Partial<T>) => {
    setValues((v) => ({ ...v, ...p }));
    setSaved((v) => ({ ...v, ...p }));
  }, []);

  // Avisa antes de sair com alterações não salvas: fechar a aba, trocar de aba das configurações ou usar o menu.
  useUnsavedGuard(dirty && !pending);

  const submit = (e?: { preventDefault(): void }) => {
    e?.preventDefault();
    start(async () => {
      let r: ActionResult<R>;
      try {
        r = await save(values);
      } catch {
        toast.error("Falha de conexão. Confira a internet e tente de novo.");
        return;
      }
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        // Leva o foco ao primeiro campo com erro.
        const first = Object.keys(r.fieldErrors ?? {})[0];
        if (first) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-field="${first}"] input, [data-field="${first}"] textarea, [data-field="${first}"] select, [data-field="${first}"] button`)?.focus());
        return;
      }
      setErrors({});
      const next = opts.onSaved?.(r.data, values) ?? values;
      setValues(next);
      setSaved(next);
      toast.success(r.message ?? "Configurações salvas.");
      router.refresh();
    });
  };

  const reset = () => {
    setValues(saved);
    setErrors({});
  };

  return { values, set, patch, commit, errors, setErrors, pending, dirty, submit, reset, saved };
}

/** Bloco de um formulário (cartão com título). */
export function Section({ title, description, children, action, className }: { title: ReactNode; description?: ReactNode; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card", className)}>
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      <div className="space-y-5 p-5">{children}</div>
    </section>
  );
}

/** Barra fixa no rodapé com “Salvar” (aparece destacada quando há alterações). */
export function SaveBar({ dirty, pending, onReset, label = "Salvar alterações" }: { dirty: boolean; pending: boolean; onReset: () => void; label?: string }) {
  return (
    <div className="safe-bottom sticky bottom-0 z-20 -mx-4 mt-6 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dirty ? "animate-pulse-dot bg-primary" : "bg-success")} />
          <span className="truncate">{dirty ? "Alterações não salvas" : "Tudo salvo"}</span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {dirty && (
            <Button type="button" variant="ghost" onClick={onReset} disabled={pending}>
              <RotateCcw aria-hidden /> <span className="hidden sm:inline">Desfazer</span>
            </Button>
          )}
          <Button type="submit" loading={pending} disabled={!dirty && !pending}>
            {label}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Callout({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "danger"; title?: ReactNode; children?: ReactNode; className?: string }) {
  const styles = {
    info: "border-info/30 bg-info-soft text-info",
    warning: "border-warning/30 bg-warning-soft text-warning",
    danger: "border-danger/30 bg-danger-soft text-danger",
  }[tone];
  const Icon = tone === "info" ? Info : AlertTriangle;
  return (
    <div role={tone === "info" ? "note" : "alert"} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", styles, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 text-foreground">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn("text-muted-foreground", title && "mt-0.5")}>{children}</div>}
      </div>
    </div>
  );
}

/** Rótulo mono pequeno com o ponto laranja da marca. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle", className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-primary" />
      {children}
    </p>
  );
}

/** Campo numérico que aceita vírgula e devolve número (ou null quando vazio e permitido). */
export function NumberInput({
  id,
  value,
  onChange,
  allowEmpty,
  min,
  max,
  step = 1,
  suffix,
  placeholder,
  integer,
  "aria-invalid": invalid,
  className,
}: {
  id?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  allowEmpty?: boolean;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  placeholder?: string;
  integer?: boolean;
  "aria-invalid"?: boolean;
  className?: string;
}) {
  const fmt = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));
  const [text, setText] = useState(fmt(value));
  useEffect(() => {
    // Mantém o que está sendo digitado (ex.: "1,") se o número for o mesmo.
    setText((t) => {
      const parsed = t.trim() === "" || t === "-" ? null : Number(t.replace(",", "."));
      return parsed === value ? t : fmt(value);
    });
  }, [value]);
  return (
    <div className="relative">
      <input
        id={id}
        inputMode={integer ? "numeric" : "decimal"}
        value={text}
        placeholder={placeholder}
        aria-invalid={invalid}
        onChange={(e) => {
          const neg = min != null && min < 0 && e.target.value.trim().startsWith("-");
          const raw = (neg ? "-" : "") + e.target.value.replace(integer ? /[^\d]/g : /[^\d.,]/g, "");
          setText(raw);
          if (raw.trim() === "" || raw === "-") {
            onChange(allowEmpty ? null : (min ?? 0));
            return;
          }
          const n = Number(raw.replace(",", "."));
          if (Number.isFinite(n)) onChange(integer ? Math.trunc(n) : n);
        }}
        onBlur={() => {
          if (value == null) return;
          let v = value;
          if (min != null && v < min) v = min;
          if (max != null && v > max) v = max;
          if (!integer && step > 0) {
            const decimals = String(step).split(".")[1]?.length ?? 0;
            v = Number((Math.round(v / step) * step).toFixed(decimals));
          }
          if (v !== value) onChange(v);
          setText(fmt(v));
        }}
        className={cn(
          "tabular h-11 w-full rounded-xl border border-input bg-card px-3.5 text-[15px] text-foreground placeholder:text-subtle hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 aria-[invalid=true]:border-danger",
          suffix && "pr-12",
          className,
        )}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-subtle">{suffix}</span>}
    </div>
  );
}

/** Field com marcação para o foco ir ao primeiro erro. */
export function SettingsField({ name, className, ...props }: { name: string } & React.ComponentProps<typeof FieldBase>) {
  return (
    <div data-field={name} className={className}>
      <FieldBase {...props} />
    </div>
  );
}

// ───────── Máscaras de digitação

/** "41999998888" → "(41) 99999-8888", aos poucos enquanto digita. */
export function maskPhone(v: string) {
  let d = v.replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function maskCnpj(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
