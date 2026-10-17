"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Plus, Search, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AdminTable } from "@/components/admin/page-header";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ImageUpload } from "@/components/admin/image-uploader";
import { imageUrl } from "@/lib/images";
import { pluralize } from "@/lib/format";
import { cn, slugify } from "@/lib/utils";
import { createBrand, deleteBrand, setBrandActive, updateBrand } from "@/app/admin/(panel)/marcas/actions";
import { SlugInput } from "./fields";
import { useAdminAction } from "./use-action";

export type BrandRow = { id: string; name: string; slug: string; logo: string | null; active: boolean; productCount: number };

type FormState = { name: string; slug: string; slugAuto: boolean; logo: string | null; active: boolean };

const iconBtn =
  "grid size-10 place-items-center rounded-xl text-subtle transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

function Logo({ b }: { b: BrandRow }) {
  return (
    <span className="grid h-11 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-well">
      {b.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl(b.logo, "sm")} alt="" loading="lazy" className="size-full object-contain p-1.5" />
      ) : (
        <span className="font-mono text-sm font-semibold uppercase text-zinc-500">{b.name.slice(0, 2)}</span>
      )}
    </span>
  );
}

function ActiveSwitch({ b }: { b: BrandRow }) {
  const { run, pending } = useAdminAction();
  const [on, setOn] = useState(b.active);
  useEffect(() => setOn(b.active), [b]);
  return (
    <Switch
      checked={on}
      disabled={pending}
      onChange={(v) => {
        setOn(v);
        run(() => setBrandActive(b.id, v), { onError: () => setOn(!v) });
      }}
      label={
        <>
          <span className="text-[13px] font-normal text-muted-foreground">{on ? "Ativa" : "Oculta"}</span>
          <span className="sr-only"> · {b.name}</span>
        </>
      }
      className="flex-row-reverse items-center justify-end gap-2.5"
    />
  );
}

function Actions({ b, onEdit }: { b: BrandRow; onEdit: () => void }) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-end">
      <a href={`/marca/${b.slug}`} target="_blank" rel="noopener noreferrer" className={iconBtn} aria-label={`Ver ${b.name} na loja`} title="Ver na loja">
        <ExternalLink className="size-4" aria-hidden />
      </a>
      <button type="button" className={iconBtn} onClick={onEdit} aria-label={`Editar ${b.name}`} title="Editar">
        <Pencil className="size-4" aria-hidden />
      </button>
      <ConfirmButton
        variant="ghost"
        size="icon"
        className="text-subtle hover:bg-danger-soft hover:text-danger"
        aria-label={`Excluir ${b.name}`}
        title={`Excluir “${b.name}”?`}
        description={
          b.productCount
            ? `${pluralize(b.productCount, "produto continua", "produtos continuam")} na loja, só que sem marca.`
            : "A marca sai do filtro e da faixa de marcas da loja."
        }
        onConfirm={async () => {
          const r = await deleteBrand(b.id);
          if (r.ok) {
            toast.success(r.message ?? "Marca excluída.");
            router.refresh();
          }
          return r;
        }}
      >
        <Trash2 aria-hidden />
      </ConfirmButton>
    </div>
  );
}

export function BrandsManager({ brands }: { brands: BrandRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<BrandRow | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ name: "", slug: "", slugAuto: true, logo: null, active: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const list = useMemo(() => {
    const term = slugify(q);
    return term ? brands.filter((b) => slugify(b.name).includes(term) || b.slug.includes(term)) : brands;
  }, [brands, q]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", slug: "", slugAuto: true, logo: null, active: true });
    setErrors({});
    setOpen(true);
  };
  const openEdit = (b: BrandRow) => {
    setEditing(b);
    setForm({ name: b.name, slug: b.slug, slugAuto: false, logo: b.logo, active: b.active });
    setErrors({});
    setOpen(true);
  };

  const submit = () =>
    start(async () => {
      const input = { name: form.name, slug: form.slug, logo: form.logo, active: form.active };
      try {
        const r = editing ? await updateBrand(editing.id, input) : await createBrand(input);
        if (!r.ok) {
          setErrors(r.fieldErrors ?? {});
          toast.error(r.error);
          return;
        }
        toast.success(r.message ?? "Marca salva.");
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Falha de conexão. Tente de novo.");
      }
    });

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {brands.length > 6 ? (
          <div className="w-full sm:w-72">
            <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar marca" aria-label="Buscar marca" leading={<Search />} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{pluralize(brands.length, "marca", "marcas")}</p>
        )}
        <Button onClick={openCreate} className="self-end sm:self-auto">
          <Plus aria-hidden /> Nova marca
        </Button>
      </div>

      {brands.length === 0 ? (
        <EmptyState
          icon={<Tags />}
          title="Nenhuma marca cadastrada"
          description="Cadastre os fabricantes (Brastemp, Electrolux, Consul…) para o cliente filtrar por marca na loja."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus aria-hidden /> Cadastrar marca
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <EmptyState icon={<Search />} title="Nenhuma marca encontrada" description={`Nada com “${q}”. Confira a grafia ou cadastre a marca.`} />
      ) : (
        <>
          <AdminTable className="hidden md:block">
            <thead>
              <tr>
                <th scope="col">Marca</th>
                <th scope="col" className="!text-right">
                  Produtos
                </th>
                <th scope="col">Situação</th>
                <th scope="col" className="!text-right">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Logo b={b} />
                      <div className="min-w-0">
                        <button type="button" onClick={() => openEdit(b)} className="block max-w-full truncate text-left font-medium hover:text-primary">
                          {b.name}
                        </button>
                        <p className="truncate font-mono text-xs text-subtle">/marca/{b.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="tabular text-right text-[13px]">{b.productCount.toLocaleString("pt-BR")}</td>
                  <td>
                    <ActiveSwitch b={b} />
                  </td>
                  <td className="!pl-0">
                    <Actions b={b} onEdit={() => openEdit(b)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>

          <ul className="grid gap-2 sm:grid-cols-2 md:hidden">
            {list.map((b) => (
              <li key={b.id} className="rounded-2xl border border-border bg-card p-3.5">
                <div className="flex items-center gap-3">
                  <Logo b={b} />
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => openEdit(b)} className="block max-w-full truncate text-left font-medium">
                      {b.name}
                    </button>
                    <p className="text-xs text-subtle">{pluralize(b.productCount, "produto", "produtos")}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
                  <ActiveSwitch b={b} />
                  <Actions b={b} onEdit={() => openEdit(b)} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={editing ? "Editar marca" : "Nova marca"}
        description={editing ? editing.name : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button loading={pending} onClick={submit}>
              {editing ? "Salvar marca" : "Cadastrar marca"}
            </Button>
          </>
        }
      >
        <form
          noValidate
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="Nome" htmlFor="brand-name" required error={errors.name}>
            <Input
              id="brand-name"
              value={form.name}
              maxLength={80}
              placeholder="ex.: Electrolux"
              aria-invalid={!!errors.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({ ...f, name, ...(f.slugAuto ? { slug: slugify(name) } : {}) }));
                setErrors((er) => ({ ...er, name: "" }));
              }}
            />
          </Field>
          <Field label="URL" htmlFor="brand-slug" error={errors.slug} hint={form.slugAuto ? "Gerada a partir do nome." : undefined}>
            <SlugInput
              id="brand-slug"
              prefix="/marca/"
              value={form.slug}
              maxLength={120}
              invalid={!!errors.slug}
              onChange={(s) => {
                setForm((f) => ({ ...f, slug: s, slugAuto: false }));
                setErrors((er) => ({ ...er, slug: "" }));
              }}
              onGenerate={() => setForm((f) => ({ ...f, slug: slugify(f.name), slugAuto: !editing }))}
            />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium">Logo</p>
            <ImageUpload
              value={form.logo}
              onChange={(v) => {
                setForm((f) => ({ ...f, logo: v }));
                setErrors((er) => ({ ...er, logo: "" }));
              }}
              folder="brands"
              aspect="aspect-[3/2]"
              className="max-w-xs"
              hint="PNG com fundo transparente ou branco"
            />
            {errors.logo ? <p className="mt-1.5 text-sm text-danger">{errors.logo}</p> : <p className="mt-1.5 text-[13px] text-subtle">Aparece sobre fundo claro na faixa de marcas.</p>}
          </div>
          <div className={cn("rounded-xl border border-border")}>
            <Switch className="p-4" checked={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} label="Ativa na loja" description="Oculta, a marca sai do filtro e da faixa de marcas. Os produtos continuam à venda." />
          </div>
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      </Dialog>
    </>
  );
}
