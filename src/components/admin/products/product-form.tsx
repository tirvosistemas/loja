"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, ExternalLink, FileText, Images, Layers, ListChecks, Search, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/card";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { MenuItem, MenuSeparator, MenuSlot, RowMenu, menuItemClass } from "@/components/admin/catalog/row-menu";
import { useUnsavedGuard } from "@/components/admin/catalog/use-action";
import { formatDate, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BrandOption, CategoryOption } from "@/lib/admin/catalog";
import { createProduct, deleteProduct, duplicateProduct, updateProduct } from "@/app/admin/(panel)/produtos/actions";
import type { FormApi } from "./form-kit";
import { valuesToInput, type ProductFormValues } from "./form-values";
import { InfoSection } from "./info-section";
import { MediaSection } from "./media-section";
import { PricingSection } from "./pricing-section";
import { VariantsSection } from "./variants-section";
import { SpecsSection } from "./specs-section";
import { SeoSection } from "./seo-section";

const SECTIONS = [
  { id: "informacoes", label: "Informações", icon: FileText, fields: ["name", "shortDescription", "description", "categoryId", "brandId", "status", "featured", "isNew", "freeShipping", "tags"] },
  { id: "fotos", label: "Fotos", icon: Images, fields: ["images", "videoUrl"] },
  { id: "preco", label: "Preço e estoque", icon: Tag, fields: ["priceCents", "compareAtCents", "costCents", "sku", "ean", "trackStock", "stock", "allowBackorder", "lowStockAlert"] },
  { id: "variacoes", label: "Variações", icon: Layers, fields: ["variantLabel", "variants"] },
  { id: "ficha", label: "Ficha técnica", icon: ListChecks, fields: ["voltage", "warrantyMonths", "model", "color", "weightGrams", "widthCm", "heightCm", "depthCm", "specs"] },
  { id: "seo", label: "SEO", icon: Search, fields: ["slug", "metaTitle", "metaDescription"] },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const STATUS_BADGE = {
  ACTIVE: { label: "Ativo", tone: "success" },
  DRAFT: { label: "Rascunho", tone: "neutral" },
  ARCHIVED: { label: "Arquivado", tone: "warning" },
} as const;

function sectionOf(key: string): SectionId {
  const root = key.split(".")[0];
  return SECTIONS.find((s) => (s.fields as readonly string[]).includes(root))?.id ?? "informacoes";
}

export type ProductMeta = {
  slug: string;
  createdAt: string;
  updatedAt: string;
  soldCount: number;
  viewCount: number;
  ratingAvg: number;
  ratingCount: number;
};

export function ProductForm({
  productId,
  initial,
  meta,
  categories,
  brands: initialBrands,
  storeName,
  siteHost,
}: {
  productId: string | null; // null = novo produto
  initial: ProductFormValues;
  meta: ProductMeta | null;
  categories: CategoryOption[];
  brands: BrandOption[];
  storeName: string;
  siteHost: string;
}) {
  const router = useRouter();
  const isNew = !productId;
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [brands, setBrands] = useState(initialBrands);
  const [tab, setTab] = useState<SectionId>("informacoes");
  const [visible, setVisible] = useState<SectionId>("informacoes");
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"stay" | "leave" | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);
  useUnsavedGuard(dirty && !pending);

  const clearErrors = useCallback((prefix: string) => {
    setErrors((e) => {
      const keys = Object.keys(e).filter((k) => k === prefix || k.startsWith(`${prefix}.`));
      if (!keys.length) return e;
      const next = { ...e };
      for (const k of keys) delete next[k];
      return next;
    });
  }, []);

  const form: FormApi = {
    values,
    errors,
    clearErrors,
    set: (key, value) => {
      setValues((v) => ({ ...v, [key]: value }));
      // Listas (variações, especificações) limpam os próprios erros linha a linha.
      if (!Array.isArray(value)) clearErrors(key as string);
    },
    patch: (p) => setValues((v) => ({ ...v, ...p })),
  };

  const errorCount = useMemo(() => {
    const out: Partial<Record<SectionId, number>> = {};
    for (const k of Object.keys(errors)) {
      const s = sectionOf(k);
      out[s] = (out[s] ?? 0) + 1;
    }
    return out;
  }, [errors]);

  // Abre a aba indicada no endereço (#fotos) — útil depois de salvar.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (SECTIONS.some((s) => s.id === hash)) {
      setTab(hash as SectionId);
      setVisible(hash as SectionId);
    }
  }, []);

  // Destaca no menu lateral a seção que está na tela (a última cujo topo passou da linha de leitura).
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      if (window.innerWidth < 1024) return;
      let current: SectionId = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= 140) current = s.id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = SECTIONS[SECTIONS.length - 1].id;
      setVisible(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Mantém a aba ativa visível na faixa de abas (celular).
  useEffect(() => {
    const strip = tabsRef.current;
    const btn = strip?.querySelector<HTMLElement>(`[aria-controls="${tab}"]`);
    if (strip && btn) strip.scrollTo({ left: btn.offsetLeft - strip.clientWidth / 2 + btn.clientWidth / 2, behavior: "smooth" });
  }, [tab]);

  const goTo = (id: SectionId, scroll: "section" | "top" = "section") => {
    setTab(id);
    setVisible(id);
    window.history.replaceState(null, "", `#${id}`);
    requestAnimationFrame(() => {
      if (scroll === "top") topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      else document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const focusError = (fieldErrors: Record<string, string>) => {
    const keys = Object.keys(fieldErrors);
    if (!keys.length) return;
    const order = SECTIONS.map((s) => s.id);
    const first = [...keys].sort((a, b) => order.indexOf(sectionOf(a)) - order.indexOf(sectionOf(b)))[0];
    setTab(sectionOf(first));
    // Espera a aba aparecer para levar o foco ao campo.
    setTimeout(() => {
      const box = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(first)}"]`) ?? document.getElementById(sectionOf(first));
      box?.scrollIntoView({ behavior: "smooth", block: "center" });
      box?.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), textarea, select, button")?.focus({ preventScroll: true });
    }, 60);
  };

  const save = (after: "stay" | "leave") => {
    if (pending) return;
    setBusy(after);
    start(async () => {
      try {
        const input = valuesToInput(values);
        const r = productId ? await updateProduct(productId, input) : await createProduct(input);
        if (!r.ok) {
          setErrors(r.fieldErrors ?? {});
          toast.error(r.error);
          focusError(r.fieldErrors ?? {});
          return;
        }
        setErrors({});
        setSaved(values);
        toast.success(r.message ?? "Produto salvo.");
        if (after === "leave") router.push("/admin/produtos");
        else if (!productId && r.data) router.replace(`/admin/produtos/${r.data.id}${window.location.hash}`);
        else router.refresh();
      } catch {
        toast.error("Falha de conexão. Confira a internet e tente de novo.");
      } finally {
        setBusy(null);
      }
    });
  };

  // Ctrl/Cmd + S salva sem sair.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current("stay");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cancel = () => {
    if (dirty && !window.confirm("Descartar as alterações não salvas?")) return;
    router.push("/admin/produtos");
  };

  const duplicate = () => {
    if (!productId) return;
    if (dirty && !window.confirm("A cópia é feita a partir do que está salvo. As alterações não salvas não vão junto. Continuar?")) return;
    start(async () => {
      let r: Awaited<ReturnType<typeof duplicateProduct>>;
      try {
        r = await duplicateProduct(productId);
      } catch {
        toast.error("Falha de conexão. Tente de novo.");
        return;
      }
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Cópia criada.");
      if (r.data) router.push(`/admin/produtos/${r.data.id}`);
    });
  };

  const status = STATUS_BADGE[saved.status];
  const title = values.name.trim() || (isNew ? "Novo produto" : "Produto sem nome");

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save("stay");
      }}
      aria-busy={pending || undefined}
    >
      <div ref={topRef} className="scroll-mt-20" />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href="/admin/produtos" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> Produtos
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
            {!isNew && <Badge tone={status.tone}>{status.label}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isNew
              ? "Preencha as informações e as fotos. Você pode salvar como rascunho e terminar depois."
              : meta && `Cadastrado em ${formatDate(meta.createdAt)} · atualizado em ${formatDate(meta.updatedAt)}`}
          </p>
        </div>
        {!isNew && meta && productId && (
          <div className="flex items-center gap-2">
            <a href={`/produto/${meta.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-elevated px-4 text-[15px] font-medium transition-colors hover:border-border-strong hover:bg-muted">
              <ExternalLink className="size-4" aria-hidden /> Ver na loja
            </a>
            <RowMenu label="Mais ações do produto" className="size-11 border border-border">
              <MenuItem icon={<Copy />} onSelect={duplicate}>
                Duplicar
              </MenuItem>
              <MenuSeparator />
              <MenuSlot>
                <ConfirmButton
                  role="menuitem"
                  variant="danger-ghost"
                  className={cn(menuItemClass, "justify-start text-danger [&_svg]:text-danger")}
                  title="Excluir produto?"
                  description={`“${saved.name}” sai da loja com fotos, variações e avaliações. Os pedidos já feitos continuam com nome e preço. Se quiser só tirar da vitrine, arquive.`}
                  successMessage="Produto excluído."
                  onConfirm={async () => {
                    const r = await deleteProduct(productId);
                    if (r.ok) {
                      setSaved(values);
                      router.push("/admin/produtos");
                    }
                    return r;
                  }}
                >
                  <Trash2 aria-hidden /> Excluir
                </ConfirmButton>
              </MenuSlot>
            </RowMenu>
          </div>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[220px_minmax(0,1fr)]">
        {/* Menu lateral (computador) */}
        <aside className="hidden lg:block">
          <nav aria-label="Seções do produto" className="sticky top-24 space-y-5">
            <ul className="space-y-0.5">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const n = errorCount[s.id] ?? 0;
                const current = visible === s.id;
                return (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      data-no-guard
                      aria-current={current ? "true" : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        goTo(s.id);
                      }}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
                        current ? "bg-elevated font-medium text-foreground ring-1 ring-border" : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", current ? "text-primary" : "text-subtle")} aria-hidden />
                      <span className="flex-1 truncate">{s.label}</span>
                      {n > 0 && (
                        <span className="tabular rounded-full bg-danger px-1.5 text-[11px] font-semibold leading-5 text-white" aria-label={pluralize(n, "erro", "erros")}>
                          {n}
                        </span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
            {meta && (
              <dl className="space-y-2 rounded-2xl border border-border bg-card p-4 text-[13px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-subtle">Vendidos</dt>
                  <dd className="tabular font-medium">{meta.soldCount.toLocaleString("pt-BR")}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-subtle">Visitas</dt>
                  <dd className="tabular font-medium">{meta.viewCount.toLocaleString("pt-BR")}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-subtle">Avaliação</dt>
                  <dd className="tabular font-medium">{meta.ratingCount ? `${meta.ratingAvg.toLocaleString("pt-BR", { minimumFractionDigits: 1 })} (${meta.ratingCount})` : "—"}</dd>
                </div>
              </dl>
            )}
            <p className="px-1 text-xs text-subtle">
              <Kbd>Ctrl</Kbd> + <Kbd>S</Kbd> salva sem sair.
            </p>
          </nav>
        </aside>

        <div className="min-w-0">
          {/* Abas (celular e tablet) */}
          <div className="sticky top-16 z-20 -mx-4 mb-4 border-b border-border bg-background/90 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:hidden">
            <div ref={tabsRef} role="tablist" aria-label="Seções do produto" className="no-scrollbar relative -mb-px flex gap-1 overflow-x-auto">
              {SECTIONS.map((s) => {
                const n = errorCount[s.id] ?? 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === s.id}
                    aria-controls={s.id}
                    onClick={() => goTo(s.id, "top")}
                    className={cn(
                      "relative flex h-12 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors",
                      tab === s.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s.label}
                    {n > 0 && <span aria-label={pluralize(n, "erro", "erros")} className="size-2 rounded-full bg-danger" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <InfoSection
              form={form}
              active={tab === "informacoes"}
              categories={categories}
              brands={brands}
              autoFocusName={isNew}
              onBrandCreated={(b) =>
                setBrands((list) => (list.some((x) => x.id === b.id) ? list : [...list, { id: b.id, name: b.name, active: true }].sort((a, c) => a.name.localeCompare(c.name, "pt-BR"))))
              }
            />
            <MediaSection form={form} active={tab === "fotos"} />
            <PricingSection form={form} active={tab === "preco"} />
            <VariantsSection form={form} active={tab === "variacoes"} />
            <SpecsSection form={form} active={tab === "ficha"} />
            <SeoSection form={form} active={tab === "seo"} storeName={storeName} siteHost={siteHost} isNew={isNew} />
          </div>
        </div>
      </div>

      {/* Barra de salvar */}
      <div className="safe-bottom sticky bottom-0 z-30 -mx-4 mt-6 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-2xl lg:border lg:px-5">
        <div className="flex items-center justify-between gap-2">
          <p className="hidden min-w-0 items-center gap-2 text-sm text-muted-foreground sm:flex" aria-live="polite">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dirty ? "animate-pulse-dot bg-primary" : "bg-success")} />
            <span className="truncate">{dirty ? "Alterações não salvas" : isNew ? "Produto novo" : "Tudo salvo"}</span>
          </p>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <Button type="button" variant="ghost" onClick={cancel} disabled={pending} className="max-sm:px-3" aria-label="Cancelar e voltar para a lista">
              <X aria-hidden className="sm:hidden" />
              <span className="hidden sm:inline">Cancelar</span>
            </Button>
            <Button type="button" variant="secondary" onClick={() => save("stay")} loading={busy === "stay"} disabled={pending && busy !== "stay"} className="max-sm:flex-1 max-sm:px-3">
              <span className="sm:hidden">Salvar e continuar</span>
              <span className="hidden sm:inline">Salvar e continuar editando</span>
            </Button>
            <Button type="button" onClick={() => save("leave")} loading={busy === "leave"} disabled={pending && busy !== "leave"} className="max-sm:px-4">
              Salvar
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
