"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Copy, ExternalLink, EyeOff, Pencil, Rocket, Star, StarOff, Trash2, Undo2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Switch } from "@/components/ui/switch";
import { AdminTable } from "@/components/admin/page-header";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { MenuItem, MenuSeparator, MenuSlot, RowMenu, menuItemClass } from "@/components/admin/catalog/row-menu";
import { useAdminAction } from "@/components/admin/catalog/use-action";
import { formatBRL, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminProductRow } from "@/lib/admin/products";
import { bulkProducts, deleteProduct, duplicateProduct, setProductStatus, toggleFeatured, type BulkProductAction } from "@/app/admin/(panel)/produtos/actions";
import { standardizeProductsAction } from "@/app/admin/(panel)/produtos/tools-actions";
import { ProductThumb } from "./product-thumb";

const STATUS_LABEL = { ACTIVE: "Ativo", DRAFT: "Rascunho", ARCHIVED: "Arquivado" } as const;

function StatusToggle({ product }: { product: AdminProductRow }) {
  const { run, pending } = useAdminAction();
  const [status, setStatus] = useState(product.status);
  useEffect(() => setStatus(product.status), [product.status]);
  return (
    <Switch
      checked={status === "ACTIVE"}
      disabled={pending}
      onChange={(on) => {
        const next = on ? "ACTIVE" : "DRAFT";
        setStatus(next);
        run(() => setProductStatus(product.id, next), { onError: () => setStatus(product.status) });
      }}
      label={
        <>
          <span className={cn("text-[13px] font-normal", status === "ACTIVE" ? "text-foreground" : "text-muted-foreground")}>{STATUS_LABEL[status]}</span>
          <span className="sr-only"> · {product.name}</span>
        </>
      }
      className="flex-row-reverse items-center justify-end gap-2.5"
    />
  );
}

function FeaturedToggle({ product }: { product: AdminProductRow }) {
  const { run, pending } = useAdminAction();
  const [on, setOn] = useState(product.featured);
  useEffect(() => setOn(product.featured), [product.featured]);
  const label = on ? `Tirar “${product.name}” dos destaques` : `Destacar “${product.name}” na página inicial`;
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={on ? "Em destaque na página inicial" : "Destacar na página inicial"}
      disabled={pending}
      onClick={() => {
        setOn(!on);
        run(() => toggleFeatured(product.id, !on), { onError: () => setOn(on) });
      }}
      className="grid size-10 place-items-center rounded-xl transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
    >
      <Star className={cn("size-[18px]", on ? "fill-primary text-primary" : "text-subtle")} aria-hidden />
    </button>
  );
}

function ProductMenu({ product }: { product: AdminProductRow }) {
  const router = useRouter();
  const { run } = useAdminAction();
  return (
    <RowMenu label={`Ações de ${product.name}`}>
      <MenuItem href={`/admin/produtos/${product.id}`} icon={<Pencil />}>
        Editar
      </MenuItem>
      <MenuItem icon={<Copy />} onSelect={() => run(() => duplicateProduct(product.id), { onOk: (d) => d && router.push(`/admin/produtos/${d.id}`) })}>
        Duplicar
      </MenuItem>
      <MenuItem href={`/produto/${product.slug}`} external icon={<ExternalLink />}>
        Ver na loja
      </MenuItem>
      <MenuSeparator />
      <MenuSlot>
        <ConfirmButton
          role="menuitem"
          variant="danger-ghost"
          className={cn(menuItemClass, "justify-start text-danger [&_svg]:text-danger")}
          title="Excluir produto?"
          description={`“${product.name}” sai da loja com fotos, variações e avaliações. Os pedidos já feitos continuam com nome e preço. Se quiser só tirar da vitrine, arquive.`}
          onConfirm={async () => {
            const r = await deleteProduct(product.id);
            if (r.ok) router.refresh();
            return r;
          }}
          successMessage="Produto excluído."
        >
          <Trash2 aria-hidden /> Excluir
        </ConfirmButton>
      </MenuSlot>
    </RowMenu>
  );
}

function PriceCell({ p, align = "right" }: { p: AdminProductRow; align?: "right" | "left" }) {
  return (
    <div className={cn("space-y-0.5", align === "right" && "text-right")}>
      <p className={cn("tabular whitespace-nowrap font-medium", p.promotion && "text-primary")}>{formatBRL(p.priceCents)}</p>
      {p.compareAtCents && (
        <p className="tabular whitespace-nowrap text-xs text-subtle">
          de <s>{formatBRL(p.compareAtCents)}</s>
        </p>
      )}
      {p.promotion && (
        <Badge tone="accent" size="sm" title={p.promotion.name}>
          Em promoção
        </Badge>
      )}
      {p.variantPrices && (
        <p className="tabular whitespace-nowrap text-[11px] text-subtle">
          {formatBRL(p.variantPrices.min)} a {formatBRL(p.variantPrices.max)}
        </p>
      )}
    </div>
  );
}

function StockCell({ p }: { p: AdminProductRow }) {
  const { state, total, zeroVariants } = p.stock;
  if (state === "untracked") return <span className="text-[13px] text-subtle">Sem controle</span>;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="tabular whitespace-nowrap text-[13px]">{pluralize(total, "un.", "un.")}</span>
        {state === "out" && <Badge tone="danger" size="sm">Zerado</Badge>}
        {state === "low" && <Badge tone="warning" size="sm">Baixo</Badge>}
      </div>
      {zeroVariants > 0 && state !== "out" && <p className="text-[11px] text-warning">{pluralize(zeroVariants, "variação zerada", "variações zeradas")}</p>}
    </div>
  );
}

function NameCell({ p }: { p: AdminProductRow }) {
  return (
    <div className="min-w-0">
      <Link href={`/admin/produtos/${p.id}`} className="line-clamp-2 font-medium text-foreground hover:text-primary">
        {p.name}
      </Link>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-subtle">
        {p.sku && <span className="font-mono">{p.sku}</span>}
        {p.sku && p.variantCount > 0 && <span aria-hidden>·</span>}
        {p.variantCount > 0 && <span>{pluralize(p.variantCount, "variação", "variações")}</span>}
        {p.isNew && <Badge tone="info" size="sm">Lançamento</Badge>}
      </p>
    </div>
  );
}

const BULK: { action: BulkProductAction; label: string; icon: React.ReactNode }[] = [
  { action: "activate", label: "Ativar", icon: <Rocket /> },
  { action: "draft", label: "Rascunho", icon: <EyeOff /> },
  { action: "archive", label: "Arquivar", icon: <Archive /> },
  { action: "feature", label: "Destacar", icon: <Star /> },
  { action: "unfeature", label: "Tirar destaque", icon: <StarOff /> },
];

function BulkBar({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const { run, pending } = useAdminAction();
  return (
    <div className="sticky top-16 z-20 -mx-4 mb-3 border-y border-border bg-background/90 px-4 py-2.5 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-1 flex items-center gap-2 text-sm font-medium" aria-live="polite">
          <span aria-hidden className="size-2 rounded-full bg-primary" />
          {pluralize(ids.length, "selecionado", "selecionados")}
        </p>
        <div className="no-scrollbar -mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1">
          {BULK.map((b) => (
            <Button key={b.action} size="sm" variant="secondary" disabled={pending} onClick={() => run(() => bulkProducts(ids, b.action), { onOk: onDone })}>
              {b.icon} {b.label}
            </Button>
          ))}
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => standardizeProductsAction(ids, false), { onOk: onDone })} title="Fundo, formato e marca d'água das Configurações">
            <Wand2 /> Padronizar fotos
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => standardizeProductsAction(ids, true), { onOk: onDone })} title="Volta às fotos originais">
            <Undo2 /> Fotos originais
          </Button>
          <ConfirmButton
            size="sm"
            variant="danger-ghost"
            disabled={pending}
            title={`Excluir ${pluralize(ids.length, "produto", "produtos")}?`}
            description="Os produtos selecionados saem da loja com fotos, variações e avaliações. Os pedidos já feitos continuam com nome e preço. Para manter o histórico, prefira arquivar."
            onConfirm={async () => {
              const r = await bulkProducts(ids, "delete");
              if (r.ok) {
                toast.success(r.message ?? "Produtos excluídos.");
                onDone();
              }
              return r;
            }}
          >
            <Trash2 aria-hidden /> Excluir
          </ConfirmButton>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={onDone} aria-label="Limpar seleção" title="Limpar seleção" className="size-9">
          <X aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** Lista de produtos: tabela no computador, cartões no celular, com seleção para ações em massa. */
export function ProductsTable({ products }: { products: AdminProductRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const ids = useMemo(() => products.map((p) => p.id), [products]);

  // Ao trocar de página ou filtro, mantém só o que continua na tela.
  useEffect(() => {
    setSelected((s) => {
      const next = new Set([...s].filter((id) => ids.includes(id)));
      return next.size === s.size ? s : next;
    });
  }, [ids]);

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const allOn = products.length > 0 && selected.size === products.length;
  const clear = () => {
    setSelected(new Set());
    router.refresh();
  };

  return (
    <>
      {selected.size > 0 && <BulkBar ids={[...selected]} onDone={clear} />}

      <AdminTable className="hidden lg:block">
        <thead>
          <tr>
            <th scope="col" className="w-10 !pr-0">
              <Checkbox
                checked={allOn}
                onChange={(on) => setSelected(on ? new Set(ids) : new Set())}
                label={<span className="sr-only">{allOn ? "Desmarcar todos" : "Selecionar todos desta página"}</span>}
              />
            </th>
            <th scope="col">Produto</th>
            <th scope="col">Categoria</th>
            <th scope="col" className="!text-right">
              Preço
            </th>
            <th scope="col">Estoque</th>
            <th scope="col">Status</th>
            <th scope="col" className="w-12 !px-1 text-center">
              <span className="sr-only">Destaque</span>
              <Star className="mx-auto size-3.5" aria-hidden />
            </th>
            <th scope="col" className="w-14">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className={cn(selected.has(p.id) && "bg-primary-soft/40")}>
              <td className="!pr-0">
                <Checkbox checked={selected.has(p.id)} onChange={(on) => toggle(p.id, on)} label={<span className="sr-only">Selecionar {p.name}</span>} />
              </td>
              <td className="max-w-[360px]">
                <div className="flex items-center gap-3">
                  <ProductThumb src={p.image} />
                  <NameCell p={p} />
                </div>
              </td>
              <td className="max-w-[200px]">
                <p className="truncate text-[13px] text-muted-foreground">{p.categoryLabel ?? <span className="text-subtle">Sem categoria</span>}</p>
                {p.brandName && <p className="truncate text-xs text-subtle">{p.brandName}</p>}
              </td>
              <td>
                <PriceCell p={p} />
              </td>
              <td>
                <StockCell p={p} />
              </td>
              <td>
                <StatusToggle product={p} />
              </td>
              <td className="!px-1 text-center">
                <FeaturedToggle product={p} />
              </td>
              <td className="!pl-0 text-right">
                <ProductMenu product={p} />
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>

      <div className="mb-2 flex items-center justify-between px-1 lg:hidden">
        <Checkbox checked={allOn} onChange={(on) => setSelected(on ? new Set(ids) : new Set())} label="Selecionar todos" className="min-h-10" />
      </div>
      <ul className="space-y-2.5 lg:hidden">
        {products.map((p) => (
          <li key={p.id} className={cn("rounded-2xl border bg-card p-3.5", selected.has(p.id) ? "border-primary/60" : "border-border")}>
            <div className="flex items-start gap-3">
              <Checkbox checked={selected.has(p.id)} onChange={(on) => toggle(p.id, on)} label={<span className="sr-only">Selecionar {p.name}</span>} className="mt-0.5 min-h-10 items-start" />
              <ProductThumb src={p.image} className="size-16" />
              <div className="min-w-0 flex-1">
                <NameCell p={p} />
                <p className="mt-1 truncate text-xs text-muted-foreground">{p.categoryLabel ?? "Sem categoria"}</p>
              </div>
              <ProductMenu product={p} />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3 border-t border-border pt-3">
              <PriceCell p={p} align="left" />
              <StockCell p={p} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <StatusToggle product={p} />
              <FeaturedToggle product={p} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
