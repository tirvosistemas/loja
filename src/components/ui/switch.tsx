"use client";

import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  name,
  id,
  className,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
}) {
  const control = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50",
        checked ? "border-primary bg-primary" : "border-border-strong bg-muted",
      )}
    >
      <span
        className={cn(
          "inline-block size-4.5 rounded-full shadow transition-transform",
          checked ? "translate-x-[22px] bg-primary-foreground" : "translate-x-[3px] bg-foreground/80",
        )}
      />
      {name && <input type="hidden" name={name} value={checked ? "on" : ""} />}
    </button>
  );
  if (!label) return control;
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4", disabled && "cursor-not-allowed", className)}>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-muted-foreground">{description}</span>}
      </span>
      {control}
    </label>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  className,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5 text-sm", disabled && "opacity-50", className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4.5 shrink-0 cursor-pointer appearance-none rounded-md border border-border-strong bg-card bg-center bg-no-repeat transition-colors checked:border-primary checked:bg-primary checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><path d=%22M3.5 8.5l3 3 6-7%22 fill=%22none%22 stroke=%22%2309090b%22 stroke-width=%222.2%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')]"
      />
      {label && <span className="min-w-0">{label}</span>}
    </label>
  );
}
