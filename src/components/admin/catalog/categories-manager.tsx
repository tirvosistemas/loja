"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CornerDownRight, ExternalLink, FolderPlus, FolderTree, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CategoryIcon } from "@/components/ui/category-icon";
import { AdminTable } from "@/components/admin/page-header";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ImageUpload } from "@/components/admin/image-uploader";
import { imageUrl } from "@/lib/images";
import { pluralize } from "@/lib/format";
import { cn, slugify } from "@/lib/utils";
import { createCategory, deleteCategory, moveCategory, setCategoryFlag, updateCategory, type CategoryInput } from "@/app/admin/(panel)/categorias/actions";
import { CharCount, IconPicker, SlugInput } from "./fields";
import { useAdminAction } from "./use-action";

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  icon: string | null;
  parentId: string | null;
  parentName: string | null;
  depth: number;
  active: boolean;
  featured: boolean;
  productCount: number;
  childCount: number;
  first: boolean;
  last: boolean;
};

type FormState = {
  name: string;
  slug: string;
  slugAuto: boolean;
  description: string;
  parentId: string;
  icon: string | null;
  image: string | null;
  active: boolean;
  featured: boolean;
};

const iconBtn =
  "grid size-10 place-items-center rounded-xl text-subtle transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-30";

function Thumb({ c }: { c: CategoryRow }) {
  return (
    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-elevated text-muted-foreground">
      {c.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl(c.image, "sm")} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <CategoryIcon name={c.icon} className="size-5" />
      )}
    </span>
  );
}

function FlagSwitch({ c, flag }: { c: CategoryRow; flag: "active" | "featured" }) {
  const { run, pending } = useAdminAction();
  const [on, setOn] = useState(c[flag]);
  useEffect(() => setOn(c[flag]), [c, flag]);
  const label = flag === "active" ? "Visível" : "Na home";
  return (
    <Switch
      checked={on}
      disabled={pending}
      onChange={(v) => {
        setOn(v);
        run(() => setCategoryFlag(c.id, flag, v), { onError: () => setOn(!v) });
      }}
      label={
        <>
          <span className="text-[13px] font-normal text-muted-foreground">{label}</span>
          <span className="sr-only"> · {c.name}</span>
        </>
      }
      className="flex-row-reverse items-center justify-end gap-2.5"
    />
  );
}

function RowActions({ c, onEdit, onAddChild }: { c: CategoryRow; onEdit: () => void; onAddChild: () => void }) {
  const router = useRouter();
  const { run, pending } = useAdminAction();
  const consequences = [
    c.productCount ? `${pluralize(c.productCount, "produto fica", "produtos ficam")} sem categoria (continuam na loja).` : null,
    c.childCount ? `${pluralize(c.childCount, "subcategoria passa", "subcategorias passam")} para o primeiro nível.` : null,
  ].filter(Boolean);
  return (
    <div className="flex items-center justify-end">
      <button type="button" className={iconBtn} disabled={c.first || pending} onClick={() => run(() => moveCategory(c.id, "up"), { success: false })} aria-label={`Subir ${c.name}`} title="Subir">
        <ArrowUp className="size-4" aria-hidden />
      </button>
      <button type="button" className={iconBtn} disabled={c.last || pending} onClick={() => run(() => moveCategory(c.id, "down"), { success: false })} aria-label={`Descer ${c.name}`} title="Descer">
        <ArrowDown className="size-4" aria-hidden />
      </button>
      {c.depth === 0 && (
        <button type="button" className={cn(iconBtn, "max-sm:hidden")} onClick={onAddChild} aria-label={`Nova subcategoria em ${c.name}`} title="Nova subcategoria">
          <FolderPlus className="size-4" aria-hidden />
        </button>
      )}
      <a href={`/categoria/${c.slug}`} target="_blank" rel="noopener noreferrer" className={cn(iconBtn, "max-sm:hidden")} aria-label={`Ver ${c.name} na loja`} title="Ver na loja">
        <ExternalLink className="size-4" aria-hidden />
      </a>
      <button type="button" className={iconBtn} onClick={onEdit} aria-label={`Editar ${c.name}`} title="Editar">
        <Pencil className="size-4" aria-hidden />
      </button>
      <ConfirmButton
        variant="ghost"
        size="icon"
        className="text-subtle hover:bg-danger-soft hover:text-danger"
        aria-label={`Excluir ${c.name}`}
        title={`Excluir “${c.name}”?`}
        description={consequences.length ? consequences.join(" ") : "A categoria sai do menu da loja."}
        onConfirm={async () => {
          const r = await deleteCategory(c.id);
          if (r.ok) {
            toast.success(r.message ?? "Categoria excluída.");
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

function emptyForm(parentId = ""): FormState {
  return { name: "", slug: "", slugAuto: true, description: "", parentId, icon: null, image: null, active: true, featured: false };
}

export function CategoriesManager({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const topLevel = categories.filter((c) => c.depth === 0);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? Object.fromEntries(Object.entries(e).filter(([key]) => key !== k)) : e));
  };

  const openCreate = (parentId = "") => {
    setEditing(null);
    setForm(emptyForm(parentId));
    setErrors({});
    setOpen(true);
  };
  const openEdit = (c: CategoryRow) => {
    setEditing(c);
    setForm({
      name: c.name,
      slug: c.slug,
      slugAuto: false,
      description: c.description ?? "",
      parentId: c.parentId ?? "",
      icon: c.icon,
      image: c.image,
      active: c.active,
      featured: c.featured,
    });
    setErrors({});
    setOpen(true);
  };

  const submit = () =>
    start(async () => {
      const input: CategoryInput = {
        name: form.name,
        slug: form.slug,
        description: form.description,
        parentId: form.parentId || null,
        icon: form.icon,
        image: form.image,
        active: form.active,
        featured: form.featured,
      };
      try {
        const r = editing ? await updateCategory(editing.id, input) : await createCategory(input);
        if (!r.ok) {
          setErrors(r.fieldErrors ?? {});
          toast.error(r.error);
          return;
        }
        toast.success(r.message ?? "Categoria salva.");
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Falha de conexão. Tente de novo.");
      }
    });

  const parentOptions = topLevel.filter((c) => c.id !== editing?.id);
  const lockedParent = !!editing && editing.childCount > 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {pluralize(categories.length, "categoria", "categorias")}
          {categories.length > 0 && ` · ${pluralize(topLevel.length, "no primeiro nível", "no primeiro nível")}`}
        </p>
        <Button onClick={() => openCreate()}>
          <Plus aria-hidden /> Nova categoria
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={<FolderTree />}
          title="Nenhuma categoria ainda"
          description="Crie categorias como Headsets, Controles e Suportes de celular. Elas formam o menu da loja e ajudam o cliente a encontrar os produtos."
          action={
            <Button size="sm" onClick={() => openCreate()}>
              <Plus aria-hidden /> Criar categoria
            </Button>
          }
        />
      ) : (
        <>
          <AdminTable className="hidden md:block">
            <thead>
              <tr>
                <th scope="col">Categoria</th>
                <th scope="col" className="!text-right">
                  Produtos
                </th>
                <th scope="col">Loja</th>
                <th scope="col">Página inicial</th>
                <th scope="col" className="!text-right">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className={cn(c.depth > 0 && "bg-background/30")}>
                  <td className="max-w-[360px]">
                    <div className={cn("flex items-center gap-3", c.depth > 0 && "pl-7")}>
                      {c.depth > 0 && <CornerDownRight className="-ml-6 size-4 shrink-0 text-subtle" aria-hidden />}
                      <Thumb c={c} />
                      <div className="min-w-0">
                        <button type="button" onClick={() => openEdit(c)} className="block max-w-full truncate text-left font-medium hover:text-primary">
                          {c.name}
                        </button>
                        <p className="truncate font-mono text-xs text-subtle">/categoria/{c.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="tabular text-right text-[13px]">
                    {c.productCount.toLocaleString("pt-BR")}
                    {c.childCount > 0 && <p className="text-[11px] text-subtle">{pluralize(c.childCount, "subcategoria", "subcategorias")}</p>}
                  </td>
                  <td>
                    <FlagSwitch c={c} flag="active" />
                  </td>
                  <td>
                    <FlagSwitch c={c} flag="featured" />
                  </td>
                  <td className="!pl-0">
                    <RowActions c={c} onEdit={() => openEdit(c)} onAddChild={() => openCreate(c.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>

          <ul className="space-y-2 md:hidden">
            {categories.map((c) => (
              <li key={c.id} className={cn("rounded-2xl border border-border bg-card p-3.5", c.depth > 0 && "ml-5")}>
                <div className="flex items-center gap-3">
                  <Thumb c={c} />
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => openEdit(c)} className="block max-w-full truncate text-left font-medium">
                      {c.name}
                    </button>
                    <p className="truncate text-xs text-subtle">
                      {c.parentName ? `em ${c.parentName} · ` : ""}
                      {pluralize(c.productCount, "produto", "produtos")}
                    </p>
                  </div>
                  {c.featured && (
                    <Badge tone="accent" size="sm">
                      <Star aria-hidden /> Home
                    </Badge>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <FlagSwitch c={c} flag="active" />
                    <FlagSwitch c={c} flag="featured" />
                  </div>
                  <RowActions c={c} onEdit={() => openEdit(c)} onAddChild={() => openCreate(c.id)} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog
        open={open}
        onClose={() => !pending && setOpen(false)}
        size="lg"
        title={editing ? "Editar categoria" : form.parentId ? "Nova subcategoria" : "Nova categoria"}
        description={editing ? editing.name : "Aparece no menu da loja assim que estiver visível."}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button loading={pending} onClick={submit}>
              {editing ? "Salvar categoria" : "Criar categoria"}
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
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Nome" htmlFor="cat-name" required error={errors.name}>
              <Input
                id="cat-name"
                value={form.name}
                maxLength={80}
                placeholder="ex.: Headsets Gamer"
                aria-invalid={!!errors.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({ ...f, name, ...(f.slugAuto ? { slug: slugify(name) } : {}) }));
                  setErrors((er) => ({ ...er, name: "" }));
                }}
              />
            </Field>
            <Field label="Categoria pai" htmlFor="cat-parent" error={errors.parentId} hint={lockedParent ? "Tem subcategorias, então fica no primeiro nível." : "Deixe em branco para o primeiro nível."}>
              <Select id="cat-parent" value={form.parentId} disabled={lockedParent} aria-invalid={!!errors.parentId} onChange={(e) => set("parentId", e.target.value)}>
                <option value="">Nenhuma (primeiro nível)</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="URL" htmlFor="cat-slug" error={errors.slug} hint={form.slugAuto ? "Gerada a partir do nome." : undefined}>
            <SlugInput
              id="cat-slug"
              prefix="/categoria/"
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
            <div className="mb-1.5 flex items-end justify-between gap-3">
              <label htmlFor="cat-desc" className="text-sm font-medium">
                Descrição
              </label>
              <CharCount value={form.description} max={1000} />
            </div>
            <Textarea id="cat-desc" rows={3} maxLength={1000} value={form.description} placeholder="Texto curto exibido no topo da página da categoria." aria-invalid={!!errors.description} onChange={(e) => set("description", e.target.value)} />
            {errors.description && <p className="mt-1.5 text-sm text-danger">{errors.description}</p>}
          </div>

          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <p id="cat-icon-label" className="mb-1.5 text-sm font-medium">
                Ícone
              </p>
              <IconPicker value={form.icon} onChange={(v) => set("icon", v)} labelledBy="cat-icon-label" />
              {errors.icon && <p className="mt-1.5 text-sm text-danger">{errors.icon}</p>}
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium">Imagem</p>
              <ImageUpload value={form.image} onChange={(v) => set("image", v)} folder="categories" aspect="aspect-[4/3]" hint="Usada na grade da página inicial" />
              {errors.image && <p className="mt-1.5 text-sm text-danger">{errors.image}</p>}
            </div>
          </div>

          <div className="divide-y divide-border rounded-xl border border-border">
            <Switch className="p-4" checked={form.active} onChange={(v) => set("active", v)} label="Visível na loja" description="Desligada, some do menu e a página da categoria deixa de abrir." />
            <Switch className="p-4" checked={form.featured} onChange={(v) => set("featured", v)} label="Destaque na página inicial" description="Entra na grade de categorias da home, com a imagem ou o ícone." />
          </div>
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      </Dialog>
    </>
  );
}
