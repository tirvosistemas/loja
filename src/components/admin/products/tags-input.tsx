"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Campo de tags em “chips”: vírgula ou Enter adiciona, Backspace no campo vazio remove a última. */
export function TagsInput({
  id,
  value,
  onChange,
  max = 40,
  placeholder = "Digite e tecle Enter",
  invalid,
  describedBy,
}: {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [text, setText] = useState("");

  const add = (raw: string) => {
    const parts = raw
      .split(",")
      .map((t) => t.trim().replace(/\s+/g, " ").slice(0, 40))
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) {
      if (next.length >= max) break;
      if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    if (next.length !== value.length) onChange(next);
  };

  return (
    <div
      className={cn(
        "flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-card px-2 py-1.5 transition-colors hover:border-border-strong focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25",
        invalid && "border-danger",
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) document.getElementById(id)?.focus();
      }}
    >
      {value.map((t, i) => (
        <span key={`${t}-${i}`} className="inline-flex max-w-full items-center gap-0.5 rounded-lg border border-border bg-elevated py-0.5 pl-2.5 pr-0.5 text-[13px]">
          <span className="truncate">{t}</span>
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            aria-label={`Remover a tag ${t}`}
            className="grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={value.length >= max}
        placeholder={value.length ? "" : placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(",")) {
            add(v);
            setText("");
          } else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(text);
            setText("");
          } else if (e.key === "Backspace" && !text && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => {
          if (text.trim()) {
            add(text);
            setText("");
          }
        }}
        className="h-8 min-w-36 flex-1 bg-transparent px-1.5 text-[15px] text-foreground placeholder:text-subtle focus:outline-none disabled:cursor-not-allowed"
      />
    </div>
  );
}
