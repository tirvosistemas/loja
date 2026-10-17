"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { NumberInput } from "@/components/admin/settings/form-kit";
import { formatDate } from "@/lib/format";
import { cn, slugify } from "@/lib/utils";
import { createPage, deletePage, updatePage } from "@/app/admin/(panel)/paginas/actions";
import { CharCount, SlugInput } from "./fields";
import { MarkdownEditor } from "./markdown-editor";
import { useUnsavedGuard } from "./use-action";

export type PageFormValues = {
  title: string;
  slug: string;
  slugAuto: boolean;
  content: string;
  published: boolean;
  showInFooter: boolean;
  sortOrder: number;
};

const MAX_CONTENT = 30000;

/** Cadastro e edição de página institucional, com prévia lado a lado no computador. */
export function PageForm({
  pageId,
  initial,
  meta,
  siteHost,
}: {
  pageId: string | null;
  initial: PageFormValues;
  meta: { slug: string; createdAt: string; updatedAt: string } | null;
  siteHost: string;
}) {
  const router = useRouter();
  const isNew = !pageId;
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"stay" | "leave" | null>(null);
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);
  useUnsavedGuard(dirty && !pending);

  const set = <K extends keyof PageFormValues>(k: K, v: PageFormValues[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: "" } : e));
  };

  const save = (after: "stay" | "leave") => {
    if (pending) return;
    setBusy(after);
    start(async () => {
      try {
        const r = pageId ? await updatePage(pageId, values) : await createPage(values);
        if (!r.ok) {
          setErrors(r.fieldErrors ?? {});
          toast.error(r.error);
          const first = Object.keys(r.fieldErrors ?? {})[0];
          if (first) document.getElementById(`pg-${first}`)?.focus();
          return;
        }
        setErrors({});
        setSaved(values);
        toast.success(r.message ?? "Página salva.");
        if (after === "leave") router.push("/admin/paginas");
        else if (!pageId && r.data) router.replace(`/admin/paginas/${r.data.id}`);
        else router.refresh();
      } catch {
        toast.error("Falha de conexão. Confira a internet e tente de novo.");
      } finally {
        setBusy(null);
      }
    });
  };

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
    router.push("/admin/paginas");
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save("stay");
      }}
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href="/admin/paginas" className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden /> Páginas
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-[28px]">{values.title.trim() || (isNew ? "Nova página" : "Página sem título")}</h1>
            {!isNew && (saved.published ? <Badge tone="success">Publicada</Badge> : <Badge>Rascunho</Badge>)}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {meta ? `Criada em ${formatDate(meta.createdAt)} · atualizada em ${formatDate(meta.updatedAt)}` : "Escreva em Markdown simples: a prévia mostra exatamente como fica na loja."}
          </p>
        </div>
        {meta && pageId && (
          <div className="flex items-center gap-2">
            <a href={`/pagina/${meta.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-elevated px-4 text-[15px] font-medium transition-colors hover:border-border-strong hover:bg-muted">
              <ExternalLink className="size-4" aria-hidden /> Ver na loja
            </a>
            <ConfirmButton
              variant="ghost"
              size="icon"
              className="size-11 border border-border text-subtle hover:bg-danger-soft hover:text-danger"
              aria-label="Excluir página"
              title={`Excluir “${saved.title}”?`}
              description="A página sai do rodapé e o link dela deixa de abrir."
              successMessage="Página excluída."
              onConfirm={async () => {
                const r = await deletePage(pageId);
                if (r.ok) router.push("/admin/paginas");
                return r;
              }}
            >
              <Trash2 aria-hidden />
            </ConfirmButton>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <div className="mb-1.5 flex items-end justify-between gap-3">
                <label htmlFor="pg-title" className="text-sm font-medium">
                  Título<span className="ml-0.5 text-primary">*</span>
                </label>
                <CharCount value={values.title} max={120} />
              </div>
              <Input
                id="pg-title"
                value={values.title}
                maxLength={120}
                autoFocus={isNew}
                placeholder="ex.: Trocas e devoluções"
                aria-invalid={!!errors.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setValues((s) => ({ ...s, title, ...(s.slugAuto ? { slug: slugify(title) } : {}) }));
                  setErrors((er) => ({ ...er, title: "" }));
                }}
              />
              {errors.title && <p className="mt-1.5 text-sm text-danger">{errors.title}</p>}
            </div>
            <div>
              <label htmlFor="pg-slug" className="mb-1.5 block text-sm font-medium">
                URL
              </label>
              <SlugInput
                id="pg-slug"
                prefix="/pagina/"
                value={values.slug}
                maxLength={120}
                invalid={!!errors.slug}
                placeholder="trocas-e-devolucoes"
                onChange={(s) => {
                  setValues((v) => ({ ...v, slug: s, slugAuto: false }));
                  setErrors((er) => ({ ...er, slug: "" }));
                }}
                onGenerate={() => setValues((v) => ({ ...v, slug: slugify(v.title), slugAuto: isNew }))}
              />
              {errors.slug ? (
                <p className="mt-1.5 text-sm text-danger">{errors.slug}</p>
              ) : (
                <p className="mt-1.5 truncate text-[13px] text-subtle">
                  {siteHost}/pagina/{values.slug || slugify(values.title) || "…"}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px] sm:items-start">
            <Switch checked={values.published} onChange={(v) => set("published", v)} label="Publicada" description="Desligada, o link da página deixa de abrir na loja." />
            <Switch checked={values.showInFooter} onChange={(v) => set("showInFooter", v)} label="Mostrar no rodapé" description="Entra na lista de links do rodapé da loja." />
            <div>
              <label htmlFor="pg-sortOrder" className="mb-1.5 block text-sm font-medium">
                Ordem
              </label>
              <NumberInput id="pg-sortOrder" integer min={0} max={999} value={values.sortOrder} onChange={(n) => set("sortOrder", Math.max(0, n ?? 0))} aria-invalid={!!errors.sortOrder} />
              {errors.sortOrder ? <p className="mt-1.5 text-sm text-danger">{errors.sortOrder}</p> : <p className="mt-1.5 text-[13px] text-subtle">Menor aparece primeiro.</p>}
            </div>
          </div>
        </section>

        <div>
          <label htmlFor="pg-content" className="mb-1.5 block text-sm font-medium">
            Conteúdo<span className="ml-0.5 text-primary">*</span>
          </label>
          <MarkdownEditor
            id="pg-content"
            layout="split"
            rows={22}
            value={values.content}
            maxLength={MAX_CONTENT}
            invalid={!!errors.content}
            onChange={(t) => set("content", t)}
            placeholder={"## Prazo para troca\nVocê tem 7 dias após o recebimento para pedir a troca ou devolução.\n\n## Como pedir\n1. Chame a loja no WhatsApp\n2. Informe o número do pedido"}
            emptyPreview="A prévia aparece aqui enquanto você escreve."
          />
          {errors.content && <p className="mt-1.5 text-sm text-danger">{errors.content}</p>}
        </div>
      </div>

      <div className="safe-bottom sticky bottom-0 z-30 -mx-4 mt-6 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-2xl lg:border lg:px-5">
        <div className="flex items-center justify-between gap-2">
          <p className="hidden min-w-0 items-center gap-2 text-sm text-muted-foreground sm:flex" aria-live="polite">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dirty ? "animate-pulse-dot bg-primary" : "bg-success")} />
            <span className="truncate">{dirty ? "Alterações não salvas" : isNew ? "Página nova" : "Tudo salvo"}</span>
            <span className="hidden text-xs text-subtle xl:inline">
              · <Kbd>Ctrl</Kbd> + <Kbd>S</Kbd> salva
            </span>
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
