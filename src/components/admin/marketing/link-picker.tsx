"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fetchProductBySlug, ProductPicker, type PickerProduct } from "./product-picker";
import { FIXED, LINK_KIND_LABEL, PREFIX, parseHref, type LinkKind } from "./links";

export type { LinkKind };

// Escolha do destino de um link (botão do banner, toque na notificação) sem digitar URL.

type Named = { slug: string; label: string };

export function LinkPicker({
  value,
  onChange,
  kinds,
  categories,
  brands = [],
  pages = [],
  id,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (href: string) => void;
  kinds: LinkKind[];
  categories: Named[];
  brands?: Named[];
  pages?: Named[];
  id?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const initial = parseHref(value);
  const [kind, setKind] = useState<LinkKind>(kinds.includes(initial.kind) ? initial.kind : "url");
  const [product, setProduct] = useState<PickerProduct | null>(null);
  const [productLoading, setProductLoading] = useState(initial.kind === "produto");
  const emitted = useRef(value);

  const emit = (href: string) => {
    emitted.current = href;
    onChange(href);
  };

  // Valor trocado de fora (ex.: desfazer alterações): recalcula o tipo.
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    const p = parseHref(value);
    setKind(kinds.includes(p.kind) ? p.kind : "url");
  }, [value, kinds]);

  // Produto já salvo: busca nome e foto pela URL amigável.
  const productSlug = kind === "produto" ? parseHref(value).slug : "";
  useEffect(() => {
    if (!productSlug || product?.slug === productSlug) {
      setProductLoading(false);
      return;
    }
    let alive = true;
    setProductLoading(true);
    fetchProductBySlug(productSlug)
      .then((p) => alive && setProduct(p))
      .catch(() => null)
      .finally(() => alive && setProductLoading(false));
    return () => {
      alive = false;
    };
  }, [productSlug, product?.slug]);

  const listFor = (k: LinkKind) => (k === "categoria" ? categories : k === "marca" ? brands : k === "pagina" ? pages : []);

  const changeKind = (k: LinkKind) => {
    setKind(k);
    if (FIXED[k] !== undefined) return emit(FIXED[k]!);
    if (k === "none" || k === "url") return emit("");
    if (k === "produto") return emit(product ? `/produto/${product.slug}` : "");
    const first = listFor(k)[0];
    emit(first ? `${PREFIX[k]}${first.slug}` : "");
  };

  const list = listFor(kind);
  const currentSlug = parseHref(value).slug;
  const preview = value && kind !== "none" ? value : null;

  return (
    <div className="space-y-2">
      <div className={cn("grid gap-2", kind !== "produto" && kind !== "none" && FIXED[kind] === undefined && "sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]")}>
        <Select id={id} value={kind} onChange={(e) => changeKind(e.target.value as LinkKind)} aria-describedby={describedBy} aria-label="Tipo de link">
          {kinds.map((k) => (
            <option key={k} value={k}>
              {LINK_KIND_LABEL[k]}
            </option>
          ))}
        </Select>

        {(kind === "categoria" || kind === "marca" || kind === "pagina") &&
          (list.length ? (
            <Select
              value={list.some((x) => x.slug === currentSlug) ? currentSlug : ""}
              onChange={(e) => emit(`${PREFIX[kind]}${e.target.value}`)}
              aria-label={LINK_KIND_LABEL[kind]}
              aria-invalid={invalid || undefined}
            >
              {!list.some((x) => x.slug === currentSlug) && <option value="">Escolha…</option>}
              {list.map((x) => (
                <option key={x.slug} value={x.slug}>
                  {x.label}
                </option>
              ))}
            </Select>
          ) : (
            <p className="flex min-h-11 items-center rounded-xl border border-dashed border-border px-3.5 text-sm text-muted-foreground">
              {kind === "categoria" ? "Nenhuma categoria cadastrada." : kind === "marca" ? "Nenhuma marca cadastrada." : "Nenhuma página cadastrada."}
            </p>
          ))}

        {kind === "url" && (
          <Input
            value={value}
            onChange={(e) => emit(e.target.value.trim())}
            placeholder="/busca?q=headset ou https://…"
            aria-label="Endereço do link"
            aria-invalid={invalid || undefined}
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            className="font-mono text-sm"
          />
        )}
      </div>

      {kind === "produto" &&
        (productLoading ? (
          <div className="h-16 animate-pulse rounded-xl border border-border bg-elevated/50" aria-label="Carregando produto" />
        ) : (
          <ProductPicker
            single
            value={product ? [product.id] : []}
            knownItems={product ? [product] : []}
            invalid={invalid}
            onChange={(_, items) => {
              const p = items[0] ?? null;
              setProduct(p);
              emit(p ? `/produto/${p.slug}` : "");
            }}
          />
        ))}

      {preview && (
        <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-subtle">
          <span className="shrink-0">Destino:</span>
          <code className="truncate font-mono text-xs text-muted-foreground">{preview}</code>
          {(preview.startsWith("/") || /^https?:\/\//i.test(preview)) && (
            <a
              href={preview}
              target="_blank"
              rel="noopener noreferrer"
              className="grid size-10 shrink-0 place-items-center rounded-md hover:bg-elevated hover:text-foreground sm:size-8"
              aria-label="Abrir o destino em nova aba"
              title="Abrir em nova aba"
            >
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </p>
      )}
    </div>
  );
}
