"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { FieldError } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ProductFormValues } from "./form-values";

// Peças do formulário de produto: API de estado, seção com âncora e campo com rótulo.

export type FormApi = {
  values: ProductFormValues;
  set: <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => void;
  patch: (p: Partial<ProductFormValues>) => void;
  errors: Record<string, string>;
  clearErrors: (prefix: string) => void;
};

/** Cartão de uma seção. No celular só a aba ativa aparece; no computador, todas. */
export function FormSection({
  id,
  title,
  description,
  active,
  action,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  active: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-24 rounded-2xl border border-border bg-card", !active && "max-lg:hidden")}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-[15px] font-semibold">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      <div className="space-y-5 p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Campo com rótulo, contador opcional à direita, dica e erro. `name` liga o erro do servidor ao campo. */
export function FormField({
  name,
  label,
  htmlFor,
  hint,
  error,
  required,
  aside,
  className,
  children,
}: {
  name: string;
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div data-field={name} className={cn("min-w-0", className)}>
      {(label || aside) && (
        <div className="mb-1.5 flex items-end justify-between gap-3">
          {label && (
            <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
              {label}
              {required && <span className="ml-0.5 text-primary">*</span>}
            </label>
          )}
          {aside}
        </div>
      )}
      {children}
      {hint && !error && <p className="mt-1.5 text-[13px] text-subtle">{hint}</p>}
      <FieldError>{error}</FieldError>
    </div>
  );
}

/** Botões de subir, descer e remover uma linha da lista. */
export function RowControls({
  index,
  count,
  onMove,
  onRemove,
  label,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
  label: string;
}) {
  const btn =
    "grid size-10 place-items-center rounded-xl text-subtle transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className="flex shrink-0 items-center">
      <button type="button" className={btn} disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label={`Subir ${label}`} title="Subir">
        <ArrowUp className="size-4" aria-hidden />
      </button>
      <button type="button" className={btn} disabled={index === count - 1} onClick={() => onMove(index, index + 1)} aria-label={`Descer ${label}`} title="Descer">
        <ArrowDown className="size-4" aria-hidden />
      </button>
      <button type="button" className={cn(btn, "hover:bg-danger-soft hover:text-danger")} onClick={onRemove} aria-label={`Remover ${label}`} title="Remover">
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
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
