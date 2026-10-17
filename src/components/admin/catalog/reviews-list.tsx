"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff, ExternalLink, MapPin, Pencil, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/switch";
import { Rating } from "@/components/ui/rating";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ProductThumb } from "@/components/admin/products/product-thumb";
import { formatDateTime, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteReviews, setReviewsApproved, updateReview } from "@/app/admin/(panel)/avaliacoes/actions";
import { CharCount } from "./fields";
import { useAdminAction } from "./use-action";

export type ReviewRow = {
  id: string;
  name: string;
  city: string | null;
  rating: number;
  title: string | null;
  comment: string;
  approved: boolean;
  createdAt: string;
  product: { id: string; name: string; slug: string; image: string | null };
};

type EditState = { name: string; city: string; rating: number; title: string; comment: string };

const RATING_WORD = ["", "Péssimo", "Ruim", "Regular", "Bom", "Excelente"];

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Nota" className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={pluralize(n, "estrela", "estrelas")}
            tabIndex={value === n || (!value && n === 1) ? 0 : -1}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                e.preventDefault();
                onChange(Math.min(5, value + 1));
              } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                e.preventDefault();
                onChange(Math.max(1, value - 1));
              }
            }}
            className="grid size-10 place-items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Star className={cn("size-6 transition-colors", n <= shown ? "fill-primary text-primary" : "text-border-strong")} aria-hidden />
          </button>
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{RATING_WORD[shown]}</span>
    </div>
  );
}

function ReviewCard({ r, selected, onSelect, onEdit }: { r: ReviewRow; selected: boolean; onSelect: (on: boolean) => void; onEdit: () => void }) {
  const router = useRouter();
  const { run, pending } = useAdminAction();
  return (
    <li className={cn("rounded-2xl border bg-card p-4 transition-colors sm:p-5", selected ? "border-primary/60" : "border-border", !r.approved && "border-l-2 border-l-primary")}>
      <div className="flex items-start gap-3">
        <Checkbox checked={selected} onChange={onSelect} label={<span className="sr-only">Selecionar a avaliação de {r.name}</span>} className="mt-1 min-h-10 items-start" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Link href={`/admin/produtos/${r.product.id}`} className="group flex min-w-0 max-w-full items-center gap-2.5">
              <ProductThumb src={r.product.image} className="size-10" />
              <span className="line-clamp-2 min-w-0 text-sm font-medium group-hover:text-primary">{r.product.name}</span>
            </Link>
            <a href={`/produto/${r.product.slug}#avaliacoes`} target="_blank" rel="noopener noreferrer" className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-elevated hover:text-foreground" aria-label={`Ver ${r.product.name} na loja`} title="Ver na loja">
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Rating value={r.rating} size="md" />
            {r.approved ? <Badge tone="success">Publicada</Badge> : <Badge tone="accent">Pendente</Badge>}
          </div>
          {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
          <p className="mt-1 whitespace-pre-line break-words text-[15px] leading-relaxed text-muted-foreground">{r.comment}</p>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-subtle">
            <span className="font-medium text-foreground">{r.name}</span>
            {r.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden /> {r.city}
              </span>
            )}
            <span aria-hidden>·</span>
            <time dateTime={r.createdAt} className="tabular">
              {formatDateTime(r.createdAt)}
            </time>
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {r.approved ? (
              <Button size="sm" variant="secondary" loading={pending} onClick={() => run(() => setReviewsApproved([r.id], false))}>
                <EyeOff aria-hidden /> Ocultar
              </Button>
            ) : (
              <Button size="sm" loading={pending} onClick={() => run(() => setReviewsApproved([r.id], true))}>
                <Check aria-hidden /> Aprovar
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Pencil aria-hidden /> Editar
            </Button>
            <ConfirmButton
              size="sm"
              variant="danger-ghost"
              title={r.approved ? "Excluir avaliação?" : "Reprovar avaliação?"}
              description={r.approved ? "A avaliação sai da loja e a nota do produto é recalculada." : "A avaliação é excluída e não aparece na loja."}
              confirmLabel={r.approved ? "Excluir" : "Reprovar e excluir"}
              onConfirm={async () => {
                const res = await deleteReviews([r.id]);
                if (res.ok) {
                  toast.success(r.approved ? "Avaliação excluída." : "Avaliação reprovada.");
                  router.refresh();
                }
                return res;
              }}
            >
              {r.approved ? <Trash2 aria-hidden /> : <X aria-hidden />}
              {r.approved ? "Excluir" : "Reprovar"}
            </ConfirmButton>
          </div>
        </div>
      </div>
    </li>
  );
}

export function ReviewsList({ reviews }: { reviews: ReviewRow[] }) {
  const router = useRouter();
  const { run, pending } = useAdminAction();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<ReviewRow | null>(null);
  const [form, setForm] = useState<EditState>({ name: "", city: "", rating: 5, title: "", comment: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, startSave] = useTransition();
  const ids = useMemo(() => reviews.map((r) => r.id), [reviews]);

  useEffect(() => {
    setSelected((s) => {
      const next = new Set([...s].filter((id) => ids.includes(id)));
      return next.size === s.size ? s : next;
    });
  }, [ids]);

  const chosen = [...selected];
  const allOn = reviews.length > 0 && selected.size === reviews.length;
  const pendingSelected = reviews.filter((r) => selected.has(r.id) && !r.approved).length;
  const approvedSelected = reviews.filter((r) => selected.has(r.id) && r.approved).length;

  const openEdit = (r: ReviewRow) => {
    setEditing(r);
    setForm({ name: r.name, city: r.city ?? "", rating: r.rating, title: r.title ?? "", comment: r.comment });
    setErrors({});
  };
  const set = <K extends keyof EditState>(k: K, v: EditState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };
  const saveEdit = () =>
    startSave(async () => {
      if (!editing) return;
      try {
        const r = await updateReview(editing.id, form);
        if (!r.ok) {
          setErrors(r.fieldErrors ?? {});
          toast.error(r.error);
          return;
        }
        toast.success(r.message ?? "Avaliação atualizada.");
        setEditing(null);
        router.refresh();
      } catch {
        toast.error("Falha de conexão. Tente de novo.");
      }
    });

  return (
    <>
      <div className={cn("mb-3 flex flex-wrap items-center gap-2", selected.size > 0 && "sticky top-16 z-20 -mx-4 border-y border-border bg-background/90 px-4 py-2.5 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border")}>
        <Checkbox checked={allOn} onChange={(on) => setSelected(on ? new Set(ids) : new Set())} label={selected.size ? pluralize(selected.size, "selecionada", "selecionadas") : "Selecionar todas"} className="mr-2 min-h-10" />
        {selected.size > 0 && (
          <>
            <Button size="sm" disabled={!pendingSelected} loading={pending} onClick={() => run(() => setReviewsApproved(chosen, true), { onOk: () => setSelected(new Set()) })}>
              <Check aria-hidden /> Aprovar {pendingSelected > 0 && `(${pendingSelected})`}
            </Button>
            <Button size="sm" variant="secondary" disabled={!approvedSelected || pending} onClick={() => run(() => setReviewsApproved(chosen, false), { onOk: () => setSelected(new Set()) })}>
              <EyeOff aria-hidden /> Ocultar
            </Button>
            <ConfirmButton
              size="sm"
              variant="danger-ghost"
              disabled={pending}
              title={`Excluir ${pluralize(selected.size, "avaliação", "avaliações")}?`}
              description="As avaliações selecionadas são excluídas e a nota dos produtos é recalculada."
              onConfirm={async () => {
                const r = await deleteReviews(chosen);
                if (r.ok) {
                  toast.success(r.message ?? "Avaliações excluídas.");
                  setSelected(new Set());
                  router.refresh();
                }
                return r;
              }}
            >
              <Trash2 aria-hidden /> Excluir
            </ConfirmButton>
          </>
        )}
      </div>

      <ul className="space-y-3">
        {reviews.map((r) => (
          <ReviewCard
            key={r.id}
            r={r}
            selected={selected.has(r.id)}
            onSelect={(on) =>
              setSelected((s) => {
                const next = new Set(s);
                if (on) next.add(r.id);
                else next.delete(r.id);
                return next;
              })
            }
            onEdit={() => openEdit(r)}
          />
        ))}
      </ul>

      <Dialog
        open={!!editing}
        onClose={() => !saving && setEditing(null)}
        title="Editar avaliação"
        description={editing ? `Em ${editing.product.name}. Corrija erros de digitação sem mudar o sentido.` : undefined}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={saveEdit}>
              Salvar avaliação
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="mb-1.5 text-sm font-medium">Nota</p>
            <StarPicker value={form.rating} onChange={(n) => set("rating", n)} />
            {errors.rating && <p className="mt-1.5 text-sm text-danger">{errors.rating}</p>}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nome" htmlFor="rv-name" required error={errors.name}>
              <Input id="rv-name" value={form.name} maxLength={80} aria-invalid={!!errors.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Cidade" htmlFor="rv-city" error={errors.city}>
              <Input id="rv-city" value={form.city} maxLength={80} aria-invalid={!!errors.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
          </div>
          <Field label="Título" htmlFor="rv-title" error={errors.title}>
            <Input id="rv-title" value={form.title} maxLength={120} aria-invalid={!!errors.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <div>
            <div className="mb-1.5 flex items-end justify-between gap-3">
              <label htmlFor="rv-comment" className="text-sm font-medium">
                Comentário<span className="ml-0.5 text-primary">*</span>
              </label>
              <CharCount value={form.comment} max={3000} />
            </div>
            <Textarea id="rv-comment" rows={6} maxLength={3000} value={form.comment} aria-invalid={!!errors.comment} onChange={(e) => set("comment", e.target.value)} />
            {errors.comment && <p className="mt-1.5 text-sm text-danger">{errors.comment}</p>}
          </div>
        </div>
      </Dialog>
    </>
  );
}
