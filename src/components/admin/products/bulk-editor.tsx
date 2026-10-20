"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, Download, FileSpreadsheet, RotateCcw, Save, Search, Upload, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Checkbox } from "@/components/ui/switch";
import { NumberInput } from "@/components/admin/settings/form-kit";
import { useUnsavedGuard } from "@/components/admin/catalog/use-action";
import { formatBRL, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { adjustPrice, suggestPrice, type PriceCalcConfig } from "@/lib/price-calc";
import { applySheet, diffRow, editable, STATUS_LABEL, type BulkField, type BulkRow, type BulkStatus, type Lookup } from "@/lib/admin/bulk";
import { parseCsv, parseXlsx } from "@/lib/importer/sheet";
import { readText } from "./import-files";
import { ProductThumb } from "./product-thumb";
import { saveBulkEdit, type BulkChange } from "@/app/admin/(panel)/produtos/editar-em-massa/actions";

const PAGE = 60; // produtos por página (as variações vêm junto)

type Action = "adjust" | "calc" | "compare" | "category" | "brand" | "status" | "stockSet" | "stockAdd" | "measures" | "freeShipping";

const ACTIONS: { value: Action; label: string }[] = [
  { value: "adjust", label: "Reajustar preço em %" },
  { value: "calc", label: "Preço pela calculadora (custo + margem)" },
  { value: "compare", label: "Preço “de” (riscado)" },
  { value: "category", label: "Mudar categoria" },
  { value: "brand", label: "Mudar marca" },
  { value: "status", label: "Mudar status" },
  { value: "stockSet", label: "Definir estoque" },
  { value: "stockAdd", label: "Somar ao estoque" },
  { value: "measures", label: "Peso e medidas" },
  { value: "freeShipping", label: "Frete grátis" },
];

function Cell({ changed, children, className }: { changed?: boolean; children: React.ReactNode; className?: string }) {
  return <td className={cn("!px-1.5 !py-1.5 align-middle", changed && "bg-primary-soft", className)}>{children}</td>;
}

const small = "h-9 rounded-lg px-2.5 text-sm";
// Dinheiro: mantém o espaço do "R$" à esquerda.
const smallMoney = "h-9 rounded-lg pl-9 pr-2 text-sm";

export function BulkEditor({ initial, lookup, price, truncated }: { initial: BulkRow[]; lookup: Lookup; price: PriceCalcConfig; truncated: boolean }) {
  const [rows, setRows] = useState(initial);
  const [original, setOriginal] = useState(() => new Map(initial.map((r) => [r.key, r])));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [notes, setNotes] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [page, setPage] = useState(0);
  const [action, setAction] = useState<Action>("adjust");
  const [param, setParam] = useState<{ n: number | null; id: string; m: (number | null)[]; flag: boolean }>({ n: 10, id: "", m: [null, null, null, null], flag: true });
  const [saving, startSave] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const changedKeys = useMemo(() => new Set(rows.filter((r) => JSON.stringify(r) !== JSON.stringify(original.get(r.key))).map((r) => r.key)), [rows, original]);
  const dirty = changedKeys.size > 0;
  useUnsavedGuard(dirty && !saving);

  // Agrupa produto + variações.
  const groups = useMemo(() => {
    const out: { product: BulkRow; variants: BulkRow[] }[] = [];
    for (const r of rows) {
      if (!r.variantId) out.push({ product: r, variants: [] });
      else out[out.length - 1]?.variants.push(r);
    }
    return out;
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return groups.filter(({ product: p, variants }) => {
      if (cat && p.categoryId !== cat) return false;
      if (status && p.status !== status) return false;
      if (onlyChanged && !changedKeys.has(p.key) && !variants.some((v) => changedKeys.has(v.key)) && !errors.has(p.key) && !variants.some((v) => errors.has(v.key))) return false;
      if (term && !`${p.name} ${p.sku} ${p.ean} ${variants.map((v) => `${v.name} ${v.sku}`).join(" ")}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [groups, q, cat, status, onlyChanged, changedKeys, errors]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pageCount - 1);
  const visible = filtered.slice(current * PAGE, current * PAGE + PAGE);
  const allFilteredSelected = filtered.length > 0 && filtered.every((g) => selected.has(g.product.productId));

  const update = (key: string, patch: Partial<BulkRow>) => {
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    if (errors.has(key))
      setErrors((e) => {
        const n = new Map(e);
        n.delete(key);
        return n;
      });
  };

  const isChanged = (r: BulkRow, f: BulkField) => original.get(r.key)?.[f] !== r[f];

  // ───────── Ações em lote

  const apply = () => {
    if (!selected.size) return;
    let skipped = 0;
    let touched = 0;
    const next = rows.map((r) => {
      if (!selected.has(r.productId)) return r;
      const n = { ...r };
      const isVariant = !!r.variantId;
      switch (action) {
        case "adjust":
          if (param.n == null) return r;
          if (n.priceCents != null) n.priceCents = adjustPrice(n.priceCents, param.n, price.priceEnding);
          break;
        case "calc": {
          if (isVariant) return r;
          const s = n.costCents ? suggestPrice(n.costCents, price, param.n ?? price.targetMarginPercent) : null;
          if (!s) {
            skipped++;
            return r;
          }
          n.priceCents = s;
          if (n.compareAtCents != null && n.compareAtCents <= s) n.compareAtCents = null;
          break;
        }
        case "compare":
          if (n.priceCents == null) return r;
          n.compareAtCents = param.n ? adjustPrice(n.priceCents, param.n, price.priceEnding) : null;
          break;
        case "category":
          if (isVariant) return r;
          n.categoryId = param.id;
          break;
        case "brand":
          if (isVariant) return r;
          n.brandId = param.id;
          break;
        case "status":
          if (isVariant || !param.id) return r;
          n.status = param.id as BulkStatus;
          break;
        case "stockSet":
        case "stockAdd":
          if (param.n == null || !editable(n, "stock")) return r;
          n.stock = Math.max(0, Math.round(action === "stockSet" ? param.n : n.stock + param.n));
          break;
        case "measures":
          if (isVariant) return r;
          if (param.m[0] != null) n.weightGrams = Math.round(param.m[0]);
          if (param.m[1] != null) n.widthCm = param.m[1];
          if (param.m[2] != null) n.heightCm = param.m[2];
          if (param.m[3] != null) n.depthCm = param.m[3];
          break;
        case "freeShipping":
          if (isVariant) return r;
          n.freeShipping = param.flag;
          break;
      }
      if (JSON.stringify(n) !== JSON.stringify(r)) touched++;
      return n;
    });
    setRows(next);
    if (action === "calc" && skipped) toast.info(`${pluralize(skipped, "produto sem custo ficou", "produtos sem custo ficaram")} como estava.`);
    toast.success(touched ? `${pluralize(touched, "linha alterada", "linhas alteradas")}. Revise e clique em Salvar.` : "Nada mudou com essa ação.");
  };

  // ───────── Planilha

  const loadSheet = async (file: File) => {
    try {
      const sheet = /\.xlsx$/i.test(file.name) ? parseXlsx(new Uint8Array(await file.arrayBuffer())) : parseCsv(await readText(file));
      const r = applySheet(rows, sheet, lookup);
      setRows(r.rows);
      setNotes(r.notes);
      setOnlyChanged(r.changed > 0);
      setPage(0);
      if (r.changed) toast.success(`${pluralize(r.changed, "linha mudou", "linhas mudaram")} pela planilha. Confira os campos destacados e salve.`);
      else toast.info("A planilha não trouxe mudanças.");
    } catch {
      toast.error("Não consegui ler a planilha. Use .xlsx ou .csv.");
    }
  };

  // ───────── Salvar

  const save = () =>
    startSave(async () => {
      const changes: BulkChange[] = rows
        .filter((r) => changedKeys.has(r.key))
        .map((r) => ({ key: r.key, productId: r.productId, variantId: r.variantId, fields: diffRow(original.get(r.key)!, r) as BulkChange["fields"] }));
      const errs = new Map<string, string>();
      let saved = 0;
      // Lotes por produto, para cada produto ir inteiro num pedido.
      const byProduct = new Map<string, BulkChange[]>();
      for (const c of changes) byProduct.set(c.productId, [...(byProduct.get(c.productId) ?? []), c]);
      const batches: BulkChange[][] = [];
      let batch: BulkChange[] = [];
      for (const list of byProduct.values()) {
        if (batch.length + list.length > 300 && batch.length) {
          batches.push(batch);
          batch = [];
        }
        batch.push(...list);
      }
      if (batch.length) batches.push(batch);
      for (const b of batches) {
        try {
          const r = await saveBulkEdit(b);
          if (!r.ok) {
            b.forEach((c) => errs.set(c.key, r.error));
            continue;
          }
          saved += r.data?.saved ?? 0;
          r.data?.errors.forEach((e) => errs.set(e.key, e.message));
        } catch {
          b.forEach((c) => errs.set(c.key, "Falha de conexão."));
        }
      }
      // Produto com erro fica todo como alterado; o resto vira o novo "original".
      const failedProducts = new Set(rows.filter((r) => errs.has(r.key)).map((r) => r.productId));
      setOriginal((o) => {
        const n = new Map(o);
        for (const r of rows) if (changedKeys.has(r.key) && !failedProducts.has(r.productId)) n.set(r.key, r);
        return n;
      });
      setErrors(errs);
      if (errs.size) {
        setOnlyChanged(true);
        toast.error(`${pluralize(saved, "produto salvo", "produtos salvos")}; ${pluralize(errs.size, "linha com erro", "linhas com erro")}. Veja em vermelho.`);
      } else toast.success(`${pluralize(saved, "produto salvo", "produtos salvos")}.`);
    });

  const undoAll = () => {
    if (!window.confirm("Desfazer todas as alterações não salvas?")) return;
    setRows((list) => list.map((r) => original.get(r.key) ?? r));
    setErrors(new Map());
    setNotes([]);
  };

  const toggleProduct = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const renderRow = (r: BulkRow) => {
    const v = !!r.variantId;
    const err = errors.get(r.key);
    const dis = (f: BulkField) => !editable(r, f);
    const label = `${r.name}${v ? " (variação)" : ""}`;
    return (
      <tr key={r.key} className={cn(v && "bg-elevated/30", err && "!bg-danger-soft")}>
        <td className="!px-2 !py-1.5">
          {!v && <Checkbox checked={selected.has(r.productId)} onChange={(on) => toggleProduct(r.productId, on)} label={<span className="sr-only">Selecionar {r.name}</span>} />}
        </td>
        <Cell changed={isChanged(r, "name")} className="sticky left-0 z-10 min-w-[260px] bg-card">
          <div className={cn("flex items-center gap-2", v && "pl-8")}>
            {!v && <ProductThumb src={r.image} className="size-9" />}
            <div className="min-w-0 flex-1">
              <Input aria-label={`Nome · ${label}`} value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} className={small} />
              {err && (
                <p className="mt-1 flex items-center gap-1 text-xs text-danger">
                  <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> {err}
                </p>
              )}
            </div>
          </div>
        </Cell>
        <Cell changed={isChanged(r, "sku")} className="min-w-[130px]">
          <Input aria-label={`SKU · ${label}`} value={r.sku} onChange={(e) => update(r.key, { sku: e.target.value })} className={cn(small, "font-mono")} />
        </Cell>
        <Cell changed={isChanged(r, "priceCents")} className="min-w-[110px]">
          <MoneyInput
            aria-invalid={!v && !r.priceCents}
            value={r.priceCents}
            allowEmpty={v}
            placeholder={v ? "do produto" : "0,00"}
            onChange={(c) => update(r.key, { priceCents: c })}
            className={smallMoney}
          />
        </Cell>
        <Cell changed={isChanged(r, "compareAtCents")} className="min-w-[110px]">
          <MoneyInput value={r.compareAtCents} allowEmpty onChange={(c) => update(r.key, { compareAtCents: c })} className={smallMoney} />
        </Cell>
        <Cell changed={isChanged(r, "costCents")} className="min-w-[110px]">
          {dis("costCents") ? <span className="px-2 text-xs text-subtle">—</span> : <MoneyInput value={r.costCents} allowEmpty onChange={(c) => update(r.key, { costCents: c })} className={smallMoney} />}
        </Cell>
        <Cell changed={isChanged(r, "stock")} className="min-w-[84px]">
          {dis("stock") ? (
            <span className="tabular px-2 text-xs text-subtle" title="Soma das variações">
              Σ {r.stock}
            </span>
          ) : (
            <NumberInput integer min={0} value={r.stock} onChange={(n) => update(r.key, { stock: Math.max(0, n ?? 0) })} className={small} />
          )}
        </Cell>
        {v ? (
          <td colSpan={7} className="!py-1.5 text-xs text-subtle">
            Demais campos vêm do produto.
          </td>
        ) : (
          <>
            <Cell changed={isChanged(r, "categoryId")} className="min-w-[180px]">
              <Select aria-label={`Categoria · ${label}`} value={r.categoryId} onChange={(e) => update(r.key, { categoryId: e.target.value })} className={small}>
                <option value="">Sem categoria</option>
                {lookup.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Cell>
            <Cell changed={isChanged(r, "brandId")} className="min-w-[140px]">
              <Select aria-label={`Marca · ${label}`} value={r.brandId} onChange={(e) => update(r.key, { brandId: e.target.value })} className={small}>
                <option value="">Sem marca</option>
                {lookup.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Cell>
            <Cell changed={isChanged(r, "status")} className="min-w-[120px]">
              <Select aria-label={`Status · ${label}`} value={r.status} onChange={(e) => update(r.key, { status: e.target.value as BulkStatus })} className={small}>
                {(Object.keys(STATUS_LABEL) as BulkStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Cell>
            <Cell changed={isChanged(r, "weightGrams")} className="min-w-[90px]">
              <NumberInput integer allowEmpty min={0} value={r.weightGrams} onChange={(n) => update(r.key, { weightGrams: n })} className={small} suffix="g" />
            </Cell>
            <Cell changed={isChanged(r, "widthCm") || isChanged(r, "heightCm") || isChanged(r, "depthCm")} className="min-w-[210px]">
              <div className="flex items-center gap-1">
                {(["widthCm", "heightCm", "depthCm"] as const).map((f, i) => (
                  <span key={f} className="flex items-center gap-1">
                    {i > 0 && <span className="text-subtle">×</span>}
                    <NumberInput allowEmpty min={0} value={r[f]} onChange={(n) => update(r.key, { [f]: n })} className={cn(small, "w-[58px] px-1.5 text-center")} />
                  </span>
                ))}
              </div>
            </Cell>
            <Cell changed={isChanged(r, "freeShipping")} className="text-center">
              <Checkbox checked={r.freeShipping} onChange={(on) => update(r.key, { freeShipping: on })} label={<span className="sr-only">Frete grátis · {label}</span>} />
            </Cell>
            <Cell changed={isChanged(r, "ean")} className="min-w-[150px]">
              <Input
                aria-label={`EAN · ${label}`}
                inputMode="numeric"
                value={r.ean}
                onChange={(e) => update(r.key, { ean: e.target.value.replace(/\D/g, "").slice(0, 14) })}
                className={cn(small, "font-mono")}
              />
            </Cell>
          </>
        )}
      </tr>
    );
  };

  const needsNumber = action === "adjust" || action === "calc" || action === "compare" || action === "stockSet" || action === "stockAdd";

  return (
    <div className="space-y-4">
      {truncated && (
        <p className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm">Mostrando os 3.000 produtos mais recentes. Use a exportação por planilha para o restante.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <a href="/api/admin/produtos/exportar" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          <Download aria-hidden /> Exportar planilha (.xlsx)
        </a>
        <a href="/api/admin/produtos/exportar?formato=csv" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <FileSpreadsheet aria-hidden /> CSV
        </a>
        <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload aria-hidden /> Atualizar pela planilha
        </Button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept=".xlsx,.csv,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) loadSheet(f);
            e.target.value = "";
          }}
        />
        <span className="text-[13px] text-subtle">Baixe, edite no Excel e envie de volta: as mudanças aparecem destacadas para você revisar antes de salvar.</span>
      </div>

      {notes.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">Avisos da planilha</p>
            <button type="button" onClick={() => setNotes([])} className="text-subtle hover:text-foreground" aria-label="Fechar avisos">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-muted-foreground">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <Input
          leading={<Search />}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder="Buscar por nome, SKU ou EAN"
          className="lg:w-72"
          aria-label="Buscar produtos"
        />
        <Select
          value={cat}
          onChange={(e) => {
            setCat(e.target.value);
            setPage(0);
          }}
          className="lg:w-64"
          aria-label="Filtrar por categoria"
        >
          <option value="">Todas as categorias</option>
          {lookup.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
          className="lg:w-44"
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          {(Object.keys(STATUS_LABEL) as BulkStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Checkbox checked={onlyChanged} onChange={setOnlyChanged} label="Só alterados" className="min-h-11" />
      </div>

      {/* Ação em lote */}
      <div className="rounded-2xl border border-border bg-card p-3.5">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-end">
          <div className="flex items-center gap-2 text-sm font-medium xl:min-w-[170px] xl:pb-2.5">
            <Wand2 className="size-4 text-primary" aria-hidden />
            {selected.size ? `${pluralize(selected.size, "produto selecionado", "produtos selecionados")}` : "Selecione produtos"}
          </div>
          <Select value={action} onChange={(e) => setAction(e.target.value as Action)} className="xl:w-72" aria-label="Ação em lote">
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </Select>
          {needsNumber && (
            <div className="xl:w-44">
              <NumberInput
                value={param.n}
                onChange={(n) => setParam((p) => ({ ...p, n }))}
                allowEmpty
                min={action === "adjust" || action === "stockAdd" ? -100_000 : 0}
                integer={action === "stockSet" || action === "stockAdd"}
                suffix={action === "stockSet" || action === "stockAdd" ? "un." : "%"}
                placeholder={action === "calc" ? `${price.targetMarginPercent}` : action === "compare" ? "vazio = remover" : undefined}
                aria-invalid={false}
              />
            </div>
          )}
          {(action === "category" || action === "brand" || action === "status") && (
            <Select value={param.id} onChange={(e) => setParam((p) => ({ ...p, id: e.target.value }))} className="xl:w-64" aria-label="Valor">
              {action === "status" ? (
                <>
                  <option value="">Escolha o status</option>
                  {(Object.keys(STATUS_LABEL) as BulkStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </>
              ) : (
                <>
                  <option value="">{action === "category" ? "Sem categoria" : "Sem marca"}</option>
                  {(action === "category" ? lookup.categories.map((c) => ({ id: c.id, name: c.label })) : lookup.brands).map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </>
              )}
            </Select>
          )}
          {action === "measures" && (
            <div className="grid grid-cols-4 gap-1.5 xl:w-[360px]">
              {["Peso g", "Larg. cm", "Alt. cm", "Prof. cm"].map((l, i) => (
                <NumberInput key={l} allowEmpty min={0} integer={i === 0} placeholder={l} value={param.m[i]} onChange={(n) => setParam((p) => ({ ...p, m: p.m.map((x, j) => (j === i ? n : x)) }))} />
              ))}
            </div>
          )}
          {action === "freeShipping" && (
            <Select value={param.flag ? "1" : "0"} onChange={(e) => setParam((p) => ({ ...p, flag: e.target.value === "1" }))} className="xl:w-44" aria-label="Frete grátis">
              <option value="1">Ligar</option>
              <option value="0">Desligar</option>
            </Select>
          )}
          <Button type="button" variant="secondary" disabled={!selected.size} onClick={apply}>
            Aplicar
          </Button>
        </div>
        <p className="mt-2 text-xs text-subtle">
          {action === "adjust" && `Ex.: 10 sobe 10%, -5 baixa 5%. Arredonda para o final ${price.priceEnding === "none" ? "exato" : `,${price.priceEnding}`} das Configurações. Vale também para variações com preço próprio.`}
          {action === "calc" && `Usa o custo de cada produto, as taxas das Configurações e a margem informada (vazio = ${price.targetMarginPercent}%). Exemplo: custo R$ 50,00 → ${formatBRL(suggestPrice(5000, price) ?? 0)}.`}
          {action === "compare" && "Preço riscado = preço atual + a porcentagem. Deixe vazio para remover o preço riscado."}
          {(action === "stockSet" || action === "stockAdd") && "Em produtos com variações, vale para cada variação."}
          {action === "measures" && "Campos vazios ficam como estão."}
        </p>
      </div>

      {/* Tabela */}
      {/* relative: os textos só para leitor de tela (sr-only) ficam presos à rolagem da tabela. */}
      <div className="relative overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[1500px] text-sm [&_th]:px-2 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-subtle [&_thead]:border-b [&_thead]:border-border [&_tbody_tr]:border-b [&_tbody_tr]:border-border">
          <thead>
            <tr>
              <th className="w-10">
                <Checkbox
                  checked={allFilteredSelected}
                  onChange={(on) => setSelected(on ? new Set(filtered.map((g) => g.product.productId)) : new Set())}
                  label={<span className="sr-only">{allFilteredSelected ? "Desmarcar todos" : "Selecionar todos os filtrados"}</span>}
                />
              </th>
              <th className="sticky left-0 z-10 bg-card">Produto</th>
              <th>SKU</th>
              <th>Preço</th>
              <th>Preço “de”</th>
              <th>Custo</th>
              <th>Estoque</th>
              <th>Categoria</th>
              <th>Marca</th>
              <th>Status</th>
              <th>Peso</th>
              <th>L × A × P (cm)</th>
              <th>Frete grátis</th>
              <th>EAN</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((g) => [renderRow(g.product), ...g.variants.map(renderRow)])}
            {!visible.length && (
              <tr>
                <td colSpan={14} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Button type="button" size="sm" variant="ghost" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Anterior
          </Button>
          <span className="tabular text-muted-foreground">
            Página {current + 1} de {pageCount} · {pluralize(filtered.length, "produto", "produtos")}
          </span>
          <Button type="button" size="sm" variant="ghost" disabled={current >= pageCount - 1} onClick={() => setPage(current + 1)}>
            Próxima
          </Button>
        </div>
      )}

      {/* Barra de salvar */}
      <div className="safe-bottom sticky bottom-0 z-30 -mx-4 border-t border-border bg-background/90 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dirty ? "animate-pulse-dot bg-primary" : "bg-success")} />
            {dirty ? `${pluralize(changedKeys.size, "linha alterada", "linhas alteradas")}` : "Tudo salvo"}
            {errors.size > 0 && <Badge tone="danger" size="sm">{pluralize(errors.size, "erro", "erros")}</Badge>}
          </p>
          <div className="flex items-center gap-2">
            {dirty && (
              <Button type="button" variant="ghost" onClick={undoAll} disabled={saving}>
                <RotateCcw aria-hidden /> <span className="hidden sm:inline">Desfazer</span>
              </Button>
            )}
            <Button type="button" onClick={save} loading={saving} disabled={!dirty}>
              <Save aria-hidden /> Salvar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
