"use client";

import { useId, useState } from "react";
import { CheckCircle2, Loader2, MessageSquarePlus, Star } from "lucide-react";
import { Rating } from "@/components/ui/rating";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReviewDTO, ReviewsPage } from "./reviews-data";

// Avaliações: resumo (média e distribuição), lista paginada e formulário moderado.

const STAR_LABEL = ["", "Ruim", "Regular", "Bom", "Muito bom", "Excelente"];

function Summary({ summary }: { summary: ReviewsPage["summary"] }) {
  const max = Math.max(1, ...summary.distribution.map((d) => d.count));
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-end gap-3">
        <p className="tabular text-5xl font-semibold tracking-tight">{summary.average.toFixed(1).replace(".", ",")}</p>
        <div className="pb-1.5">
          <Rating value={summary.average} size="md" />
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.count} {summary.count === 1 ? "avaliação" : "avaliações"}
          </p>
        </div>
      </div>
      <ul className="mt-5 space-y-2" aria-label="Distribuição das notas">
        {summary.distribution.map((d) => (
          <li key={d.stars} className="flex items-center gap-3 text-sm">
            <span className="tabular flex w-8 shrink-0 items-center gap-1 text-muted-foreground">
              {d.stars} <Star className="size-3.5 fill-current text-primary" strokeWidth={0} aria-hidden />
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${(d.count / max) * 100}%` }} />
            </span>
            <span className="tabular w-8 shrink-0 text-right text-subtle">
              {d.count}
              <span className="sr-only"> com {d.stars} {d.stars === 1 ? "estrela" : "estrelas"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewItem({ r }: { r: ReviewDTO }) {
  return (
    <article className="border-b border-border py-5 first:pt-0 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Rating value={r.rating} />
        <time dateTime={r.createdAt} className="text-xs text-subtle">
          {formatDate(r.createdAt, { dateStyle: "long" })}
        </time>
      </div>
      {r.title && <h3 className="mt-2 font-semibold">{r.title}</h3>}
      <p className="mt-1.5 whitespace-pre-line break-words text-[15px] leading-relaxed text-muted-foreground">{r.comment}</p>
      <p className="mt-2.5 flex items-center gap-2 text-sm">
        <span className="grid size-7 place-items-center rounded-full bg-elevated font-mono text-xs uppercase text-foreground" aria-hidden>
          {r.name.slice(0, 1)}
        </span>
        <span className="font-medium">{r.name}</span>
        {r.city && <span className="text-subtle">· {r.city}</span>}
      </p>
    </article>
  );
}

function StarPicker({ value, onChange, error }: { value: number; onChange: (n: number) => void; error?: string }) {
  const [hover, setHover] = useState(0);
  const name = useId();
  const shown = hover || value;
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">
        Sua nota<span className="ml-0.5 text-primary">*</span>
      </legend>
      <div className="flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer rounded-lg p-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary" onMouseEnter={() => setHover(n)}>
              <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}: ${STAR_LABEL[n]}`} />
              <Star className={cn("size-8 transition-colors", n <= shown ? "fill-primary text-brand" : "fill-transparent text-border-strong")} strokeWidth={1.5} aria-hidden />
            </label>
          ))}
        </div>
        <span className="text-sm text-muted-foreground" aria-hidden>
          {STAR_LABEL[shown]}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function ReviewForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const id = useId();
  const [form, setForm] = useState({ name: "", city: "", rating: 0, title: "", comment: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string | number) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = "Informe seu nome.";
    if (form.rating < 1) e.rating = "Escolha uma nota de 1 a 5 estrelas.";
    if (form.comment.trim().length < 10) e.comment = "Conte um pouco mais (mínimo de 10 caracteres).";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, ...form }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };
      if (!res.ok || !data.ok) {
        setErrors(data.fieldErrors ?? {});
        setMessage(data.error ?? "Não foi possível enviar sua avaliação. Tente de novo.");
        return;
      }
      onDone();
    } catch {
      setMessage("Sem conexão. Confira sua internet e tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <StarPicker value={form.rating} onChange={(n) => set("rating", n)} error={errors.rating} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor={`${id}-name`} required error={errors.name}>
          <Input id={`${id}-name`} value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={60} autoComplete="given-name" aria-invalid={!!errors.name || undefined} />
        </Field>
        <Field label="Cidade" htmlFor={`${id}-city`} hint="Opcional" error={errors.city}>
          <Input id={`${id}-city`} value={form.city} onChange={(e) => set("city", e.target.value)} maxLength={60} autoComplete="address-level2" placeholder="Ex.: Curitiba" />
        </Field>
      </div>
      <Field label="Título" htmlFor={`${id}-title`} hint="Opcional" error={errors.title}>
        <Input id={`${id}-title`} value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={80} placeholder="Resuma sua experiência" />
      </Field>
      <Field
        label="Comentário"
        htmlFor={`${id}-comment`}
        required
        error={errors.comment}
        hint={<span className="tabular">{form.comment.trim().length}/1500</span>}
      >
        <Textarea
          id={`${id}-comment`}
          value={form.comment}
          onChange={(e) => set("comment", e.target.value)}
          maxLength={1500}
          rows={5}
          placeholder="O que você achou do produto? Conte sobre o uso, a entrega e a qualidade."
          aria-invalid={!!errors.comment || undefined}
        />
      </Field>
      {/* Campo isca para robôs: pessoas não veem nem preenchem. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`${id}-website`}>Site</label>
        <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} />
      </div>
      {message && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          {message}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] text-subtle">Sua avaliação passa por moderação antes de aparecer.</p>
        <Button type="submit" loading={busy} className="sm:min-w-44">
          Enviar avaliação
        </Button>
      </div>
    </form>
  );
}

export function ProductReviews({ productId, initial }: { productId: string; initial: ReviewsPage }) {
  const [reviews, setReviews] = useState(initial.reviews);
  const [page, setPage] = useState(initial.page);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const { summary } = initial;
  const hasMore = page < initial.pageCount;

  const loadMore = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await fetch(`/api/reviews?productId=${encodeURIComponent(productId)}&page=${page + 1}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as ReviewsPage;
      setReviews((list) => [...list, ...data.reviews.filter((r) => !list.some((x) => x.id === r.id))]);
      setPage(data.page);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const status = sent ? (
    <div role="status" className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success-soft p-5 text-sm">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
      <p className="font-semibold text-foreground">Obrigado! Sua avaliação será publicada após moderação.</p>
    </div>
  ) : formOpen ? null : (
    <Button variant="secondary" size="lg" onClick={() => setFormOpen(true)} block>
      <MessageSquarePlus aria-hidden /> Avaliar este produto
    </Button>
  );

  const form = formOpen && !sent && (
    <div className="animate-fade-in">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Sua avaliação</h3>
        <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)}>
          Cancelar
        </Button>
      </div>
      <ReviewForm
        productId={productId}
        onDone={() => {
          setSent(true);
          setFormOpen(false);
        }}
      />
    </div>
  );

  if (summary.count === 0)
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-12">
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-border-strong p-6 text-center lg:text-left">
            <div className="flex justify-center lg:justify-start" aria-hidden>
              <Rating value={0} size="md" />
            </div>
            <p className="mt-3 font-semibold">Ainda não há avaliações</p>
            <p className="mt-1 text-sm text-muted-foreground">Comprou este produto? Conte para os próximos clientes como foi.</p>
          </div>
          {status}
        </div>
        {form && <div className="min-w-0">{form}</div>}
      </div>
    );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-12">
      <div className="space-y-4 lg:sticky lg:top-36 lg:self-start">
        <Summary summary={summary} />
        {status}
      </div>
      <div className="min-w-0">
        {form && <div className="mb-8">{form}</div>}
        <div>
          {reviews.map((r) => (
            <ReviewItem key={r.id} r={r} />
          ))}
        </div>
        {hasMore && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <Button variant="outline" onClick={loadMore} disabled={loading}>
              {loading && <Loader2 className="animate-spin" aria-hidden />}
              Ver mais avaliações
            </Button>
            {loadError && (
              <p role="alert" className="text-sm text-danger">
                Não foi possível carregar. Tente de novo.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
