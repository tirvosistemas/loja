"use client";

import { useRef, useState } from "react";
import { Bold, Eye, Heading2, Italic, Link2, List, ListOrdered, PenLine, Quote } from "lucide-react";
import { Markdown } from "@/components/ui/markdown";
import { cn } from "@/lib/utils";

// Editor de Markdown simples: barra de formatação, contador e pré-visualização com o
// mesmo componente usado na loja. "split" mostra texto e prévia lado a lado no desktop.

type Tool = { label: string; icon: React.ReactNode; apply: (sel: string) => { text: string; select?: [number, number] }; line?: boolean };

const TOOLS: Tool[] = [
  { label: "Título", icon: <Heading2 />, line: true, apply: (s) => ({ text: `## ${s || "Título"}`, select: [3, 3 + (s || "Título").length] }) },
  { label: "Negrito", icon: <Bold />, apply: (s) => ({ text: `**${s || "texto"}**`, select: [2, 2 + (s || "texto").length] }) },
  { label: "Itálico", icon: <Italic />, apply: (s) => ({ text: `*${s || "texto"}*`, select: [1, 1 + (s || "texto").length] }) },
  {
    label: "Lista",
    icon: <List />,
    line: true,
    apply: (s) => ({ text: (s || "Item").split("\n").map((l) => `- ${l.replace(/^\s*[-*]\s+/, "")}`).join("\n") }),
  },
  {
    label: "Lista numerada",
    icon: <ListOrdered />,
    line: true,
    apply: (s) => ({ text: (s || "Item").split("\n").map((l, i) => `${i + 1}. ${l.replace(/^\s*\d+[.)]\s+/, "")}`).join("\n") }),
  },
  { label: "Link", icon: <Link2 />, apply: (s) => ({ text: `[${s || "texto do link"}](https://)`, select: [(s || "texto do link").length + 3, (s || "texto do link").length + 11] }) },
  { label: "Citação", icon: <Quote />, line: true, apply: (s) => ({ text: (s || "Destaque").split("\n").map((l) => `> ${l}`).join("\n") }) },
];

export function MarkdownEditor({
  id,
  value,
  onChange,
  rows = 12,
  layout = "toggle",
  placeholder,
  maxLength,
  invalid,
  describedBy,
  emptyPreview = "Nada para visualizar ainda.",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  layout?: "toggle" | "split";
  placeholder?: string;
  maxLength?: number;
  invalid?: boolean;
  describedBy?: string;
  emptyPreview?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");

  const apply = (tool: Tool) => {
    const el = ref.current;
    if (!el) return;
    let start = el.selectionStart;
    const end = el.selectionEnd;
    // Ferramentas de linha começam no início da linha.
    if (tool.line && start === end) start = value.lastIndexOf("\n", start - 1) + 1;
    const selected = value.slice(start, end);
    const { text, select } = tool.apply(selected);
    const needsBreak = tool.line && start > 0 && value[start - 1] !== "\n";
    const insert = (needsBreak ? "\n" : "") + text;
    const next = value.slice(0, start) + insert + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const base = start + (needsBreak ? 1 : 0);
      if (select) el.setSelectionRange(base + select[0], base + select[1]);
      else el.setSelectionRange(base + text.length, base + text.length);
    });
  };

  const split = layout === "split";
  const preview = (
    <div className={cn("min-h-full rounded-xl border border-border bg-background/40 p-4", !value.trim() && "grid place-items-center")}>
      {value.trim() ? <Markdown content={value} className="text-[15px]" /> : <p className="text-sm text-subtle">{emptyPreview}</p>}
    </div>
  );

  return (
    <div className="rounded-2xl border border-input bg-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 aria-[invalid=true]:border-danger" aria-invalid={invalid || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-1.5">
        <div role="toolbar" aria-label="Formatação" aria-controls={id} className="no-scrollbar flex min-w-0 items-center gap-0.5 overflow-x-auto">
          {TOOLS.map((t) => (
            <button
              key={t.label}
              type="button"
              title={t.label}
              aria-label={t.label}
              onClick={() => apply(t)}
              disabled={mode === "preview" && !split}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground disabled:opacity-40 [&_svg]:size-4"
            >
              {t.icon}
            </button>
          ))}
        </div>
        <div role="tablist" aria-label="Modo do editor" className={cn("flex shrink-0 rounded-lg bg-elevated p-0.5", split && "lg:hidden")}>
          {(["write", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors [&_svg]:size-3.5",
                mode === m ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "write" ? <PenLine aria-hidden /> : <Eye aria-hidden />}
              {m === "write" ? "Escrever" : "Visualizar"}
            </button>
          ))}
        </div>
      </div>

      <div className={cn(split && "lg:grid lg:grid-cols-2 lg:divide-x lg:divide-border")}>
        <div className={cn(mode === "preview" && "hidden", split && "lg:block")}>
          <textarea
            ref={ref}
            id={id}
            value={value}
            rows={rows}
            maxLength={maxLength}
            placeholder={placeholder}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value)}
            className="block min-h-40 w-full resize-y rounded-b-2xl bg-transparent px-4 py-3 font-mono text-[13.5px] leading-relaxed text-foreground placeholder:text-subtle focus:outline-none lg:rounded-br-none"
          />
        </div>
        <div className={cn("p-3", mode === "write" && "hidden", split && "lg:block lg:max-h-[640px] lg:overflow-y-auto")} aria-label="Pré-visualização">
          {split && <p className="mb-2 hidden font-mono text-[11px] uppercase tracking-[0.16em] text-subtle lg:block">Pré-visualização</p>}
          {preview}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-subtle">
        <p className="font-mono">
          **negrito** · *itálico* · ## título · - lista · [link](https://…) · &gt; citação
        </p>
        {maxLength && (
          <span className={cn("tabular", value.length > maxLength * 0.95 && "text-warning")}>
            {value.length.toLocaleString("pt-BR")}/{maxLength.toLocaleString("pt-BR")}
          </span>
        )}
      </div>
    </div>
  );
}
