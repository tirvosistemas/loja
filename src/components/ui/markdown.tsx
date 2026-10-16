import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Markdown simples e seguro (sem HTML embutido): títulos (#, ##, ###), listas (- e 1.),
// negrito (**), itálico (*), links [texto](url), citações (>) e parágrafos.
// Usado na descrição dos produtos e nas páginas institucionais.

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("[")) {
      const mm = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      const href = mm?.[2] ?? "#";
      const safe = /^(https?:\/\/|\/|mailto:|tel:|#)/i.test(href) ? href : "#";
      const external = /^https?:\/\//i.test(safe);
      out.push(
        <a key={k} href={safe} className="font-medium text-primary underline-offset-4 hover:underline" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {mm?.[1]}
        </a>,
      );
    } else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ content, className }: { content: string | null | undefined; className?: string }) {
  if (!content?.trim()) return null;
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  const flush = () => {
    const k = `b${blocks.length}`;
    if (para.length) {
      blocks.push(<p key={k}>{inline(para.join(" "), k)}</p>);
      para = [];
    }
    if (list) {
      const Tag = list.ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={`${k}l`} className={cn("space-y-1.5 pl-5", list.ordered ? "list-decimal" : "list-disc marker:text-primary")}>
          {list.items.map((it, i) => (
            <li key={i}>{inline(it, `${k}-${i}`)}</li>
          ))}
        </Tag>,
      );
      list = null;
    }
    if (quote.length) {
      blocks.push(
        <blockquote key={`${k}q`} className="border-l-2 border-primary pl-4 text-muted-foreground">
          {inline(quote.join(" "), `${k}q`)}
        </blockquote>,
      );
      quote = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const q = line.match(/^>\s?(.*)$/);
    if (!line.trim()) {
      flush();
      continue;
    }
    if (h) {
      flush();
      const level = h[1].length;
      const k = `h${blocks.length}`;
      const cls = level === 1 ? "text-2xl font-semibold" : level === 2 ? "text-xl font-semibold" : "text-lg font-semibold";
      const Tag = level === 1 ? "h2" : level === 2 ? "h3" : "h4";
      blocks.push(<Tag key={k} className={cn("pt-2 text-foreground", cls)}>{inline(h[2], k)}</Tag>);
      continue;
    }
    if (ul || ol) {
      if (para.length || quote.length) {
        const keep = list;
        list = null;
        flush();
        list = keep;
      }
      const ordered = !!ol;
      if (list && list.ordered !== ordered) flush();
      if (!list) list = { ordered, items: [] };
      list.items.push((ul?.[1] ?? ol?.[1] ?? "").trim());
      continue;
    }
    if (q) {
      if (para.length || list) flush();
      quote.push(q[1]);
      continue;
    }
    if (list || quote.length) flush();
    para.push(line.trim());
  }
  flush();
  return <div className={cn("space-y-4 leading-relaxed text-muted-foreground", className)}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
