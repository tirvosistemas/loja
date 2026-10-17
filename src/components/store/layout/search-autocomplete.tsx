"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight, FolderOpen, Loader2, Search, X } from "lucide-react";
import { SmartImage } from "@/components/ui/smart-image";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

type Suggestions = {
  products: { slug: string; name: string; image: string | null; priceCents: number; compareAtCents: number | null; brand: string | null }[];
  categories: { name: string; slug: string }[];
};

type Option = { key: string; href: string; kind: "category" | "product" | "all" };

/** Destaca o termo buscado dentro do nome. */
function highlight(text: string, term: string): ReactNode {
  const t = term.trim();
  if (t.length < 2) return text;
  const i = text.toLocaleLowerCase("pt-BR").indexOf(t.toLocaleLowerCase("pt-BR"));
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-semibold text-primary">{text.slice(i, i + t.length)}</mark>
      {text.slice(i + t.length)}
    </>
  );
}

/** Busca com sugestões (produtos e categorias) enquanto a pessoa digita. */
export function SearchAutocomplete({ inputId, className, placeholder = "Buscar geladeira, air fryer, lavadora..." }: { inputId: string; className?: string; placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Suggestions | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(-1);
  const term = q.trim();

  // Busca com espera curta entre as teclas; cancela a anterior.
  useEffect(() => {
    if (term.length < 2) {
      setData(null);
      setLoading(false);
      setFailed(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as Suggestions;
        setData({ products: json.products ?? [], categories: json.categories ?? [] });
        setFailed(false);
        setActive(-1);
      } catch {
        if (ctrl.signal.aborted) return;
        setFailed(true);
        setData(null);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);

  // Fecha ao trocar de página; mantém o termo só na página de busca.
  useEffect(() => {
    setOpen(false);
    setActive(-1);
    if (!pathname.startsWith("/busca")) setQ("");
  }, [pathname]);

  // Fecha ao tocar fora.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const searchHref = `/busca?q=${encodeURIComponent(term)}`;
  const options = useMemo<Option[]>(() => {
    if (!data) return [];
    return [
      ...data.categories.map((c) => ({ key: `c-${c.slug}`, href: `/categoria/${c.slug}`, kind: "category" as const })),
      ...data.products.map((p) => ({ key: `p-${p.slug}`, href: `/produto/${p.slug}`, kind: "product" as const })),
      { key: "all", href: searchHref, kind: "all" as const },
    ];
  }, [data, searchHref]);

  const showPanel = open && term.length >= 2 && (loading || failed || !!data);
  const optionId = (i: number) => `${listId}-op-${i}`;

  // Mantém a opção ativa visível ao navegar pelas setas.
  useEffect(() => {
    if (active < 0) return;
    document.getElementById(`${listId}-op-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  // Fecha e tira o foco (no celular, recolhe o teclado ao abrir um resultado).
  const closeAndBlur = () => {
    setOpen(false);
    inputRef.current?.blur();
  };
  const go = (href: string) => {
    closeAndBlur();
    router.push(href);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      if (options.length) setActive((a) => (a + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (options.length) setActive((a) => (a <= 0 ? options.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      if (showPanel && active >= 0 && options[active]) {
        e.preventDefault();
        go(options[active].href);
      }
    } else if (e.key === "Escape") {
      if (showPanel) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (q) {
        e.preventDefault();
        setQ("");
      }
    }
  };

  // Índices de cada grupo dentro da lista única de opções.
  const catCount = data?.categories.length ?? 0;
  const prodCount = data?.products.length ?? 0;
  const empty = !!data && catCount === 0 && prodCount === 0;
  const keepFocus = (e: React.MouseEvent) => e.preventDefault(); // não tira o foco do campo ao clicar

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <form
        role="search"
        action="/busca"
        method="get"
        onSubmit={(e) => {
          e.preventDefault();
          if (term) go(searchHref);
          else inputRef.current?.focus();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Buscar produtos
        </label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-subtle" />
          <input
            ref={inputRef}
            id={inputId}
            name="q"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            maxLength={80}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-activedescendant={showPanel && active >= 0 ? optionId(active) : undefined}
            className="h-11 w-full rounded-xl border border-input bg-card pl-11 pr-24 text-[15px] text-foreground placeholder:text-subtle transition-colors hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
          <div className="absolute inset-y-0 right-1.5 flex items-center gap-1">
            {loading && <Loader2 aria-hidden className="size-4 animate-spin text-subtle" />}
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  inputRef.current?.focus();
                }}
                aria-label="Limpar busca"
                className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-elevated hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
            <button
              type="submit"
              aria-label="Buscar"
              className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </form>

      <div
        id={listId}
        role="listbox"
        aria-label="Sugestões de busca"
        hidden={!showPanel}
        className="absolute inset-x-0 top-[calc(100%+8px)] z-50 max-h-[min(70dvh,560px)] overflow-y-auto overscroll-contain rounded-2xl border border-border-strong bg-card p-2 shadow-2xl animate-fade-in"
      >
        {failed && <p className="px-3 py-4 text-sm text-muted-foreground">Não foi possível buscar agora. Tente de novo em instantes.</p>}
        {!data && loading && !failed && (
          <div className="space-y-2 p-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="size-12 rounded-lg bg-muted animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}
        {empty && (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            Nada encontrado para <b className="text-foreground">“{term}”</b>. Tente outro nome, marca ou modelo.
          </p>
        )}

        {catCount > 0 && (
          <div role="group" aria-labelledby={`${listId}-cats`}>
            <p id={`${listId}-cats`} className="px-3 pb-1 pt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
              Categorias
            </p>
            {data!.categories.map((c, i) => (
              <Link
                key={c.slug}
                id={optionId(i)}
                role="option"
                aria-selected={active === i}
                href={`/categoria/${c.slug}`}
                onMouseDown={keepFocus}
                onMouseEnter={() => setActive(i)}
                onClick={closeAndBlur}
                className={cn(
                  "flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm",
                  active === i ? "bg-elevated text-foreground" : "text-muted-foreground",
                )}
              >
                <FolderOpen aria-hidden className="size-4 shrink-0 text-subtle" />
                <span className="truncate">{highlight(c.name, term)}</span>
              </Link>
            ))}
          </div>
        )}

        {prodCount > 0 && (
          <div role="group" aria-labelledby={`${listId}-prods`}>
            <p id={`${listId}-prods`} className="px-3 pb-1 pt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
              Produtos
            </p>
            {data!.products.map((p, j) => {
              const i = catCount + j;
              return (
                <Link
                  key={p.slug}
                  id={optionId(i)}
                  role="option"
                  aria-selected={active === i}
                  href={`/produto/${p.slug}`}
                  onMouseDown={keepFocus}
                  onMouseEnter={() => setActive(i)}
                  onClick={closeAndBlur}
                  className={cn("flex items-center gap-3 rounded-xl px-2 py-2", active === i && "bg-elevated")}
                >
                  <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-well">
                    <SmartImage src={p.image} alt="" size="sm" sizes="48px" className="size-full object-contain p-1" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm leading-snug text-foreground">{highlight(p.name, term)}</span>
                    {p.brand && <span className="block truncate text-xs uppercase tracking-wider text-subtle">{p.brand}</span>}
                  </span>
                  <span className="tabular shrink-0 text-right">
                    {p.compareAtCents && p.compareAtCents > p.priceCents ? (
                      <s className="block text-[11px] text-subtle">{formatBRL(p.compareAtCents)}</s>
                    ) : null}
                    <span className="block text-sm font-semibold">{formatBRL(p.priceCents)}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {data && (
          <Link
            id={optionId(options.length - 1)}
            role="option"
            aria-selected={active === options.length - 1}
            href={searchHref}
            onMouseDown={keepFocus}
            onMouseEnter={() => setActive(options.length - 1)}
            onClick={closeAndBlur}
            className={cn(
              "mt-1 flex min-h-11 items-center justify-between gap-3 rounded-xl border-t border-border px-3 py-2.5 text-sm font-medium",
              active === options.length - 1 ? "bg-elevated text-primary" : "text-foreground",
            )}
          >
            <span className="truncate">Ver todos os resultados para “{term}”</span>
            <ArrowRight aria-hidden className="size-4 shrink-0" />
          </Link>
        )}
      </div>
    </div>
  );
}
