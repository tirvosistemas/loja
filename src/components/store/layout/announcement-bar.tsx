"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";

const KEY = "tirvo-aviso-fechado";

/** Faixa de aviso no topo. Fechada, some até o fim da sessão (volta se o texto mudar). */
export function AnnouncementBar({ text, href }: { text: string; href?: string }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY) === text) setHidden(true);
    } catch {}
  }, [text]);

  if (hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      sessionStorage.setItem(KEY, text);
    } catch {}
  };

  const external = !!href && /^https?:\/\//i.test(href);
  const content = (
    <>
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary animate-pulse-dot" />
      <span className="line-clamp-2 sm:line-clamp-1">{text}</span>
      {href && <ArrowRight aria-hidden className="size-3.5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />}
    </>
  );
  const cls =
    "group flex min-w-0 items-center justify-center gap-2.5 text-center font-mono text-[11px] uppercase leading-snug tracking-[0.12em] text-muted-foreground sm:text-xs sm:tracking-[0.14em]";

  return (
    <div role="region" aria-label="Aviso da loja" className="relative border-b border-border bg-card">
      {/* O respiro para o botão de fechar fica num div interno: o container-page redefine o padding lateral. */}
      <div className="container-page">
        <div className="flex min-h-10 items-center justify-center py-2 pr-9 sm:px-10">
          {href ? (
            external ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className={`${cls} -my-2 py-2 hover:text-foreground`}>
                {content}
              </a>
            ) : (
              <Link href={href} className={`${cls} -my-2 py-2 hover:text-foreground`}>
                {content}
              </Link>
            )
          ) : (
            <p className={cls}>{content}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar aviso"
        className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-subtle hover:bg-elevated hover:text-foreground sm:right-3"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
