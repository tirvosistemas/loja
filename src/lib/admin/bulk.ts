import { normalizeKey, parseInteger, parseMoney, parseNumber, parseWeight, parseYesNo } from "@/lib/importer/dados";
import type { SheetRow } from "@/lib/importer/sheet";

// Edição em massa e planilha de exportação/atualização. Arquivo puro: usado na página de
// edição (navegador) e na rota de exportação (servidor). Uma linha por produto e, logo
// abaixo, uma por variação (com o ID do produto repetido).

export type BulkStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

export type BulkRow = {
  key: string; // "p:<id>" ou "v:<id>"
  productId: string;
  variantId: string | null;
  name: string; // nome do produto ou da variação
  sku: string;
  priceCents: number | null; // variação: null = usa o preço do produto
  compareAtCents: number | null;
  costCents: number | null; // só produto
  stock: number;
  categoryId: string;
  brandId: string;
  status: BulkStatus;
  weightGrams: number | null;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  freeShipping: boolean;
  ean: string;
  hasVariants: boolean;
  image: string | null;
};

export type BulkField = Exclude<keyof BulkRow, "key" | "productId" | "variantId" | "hasVariants" | "image">;

/** Campos que a variação tem; o resto é do produto. */
export const VARIANT_FIELDS: BulkField[] = ["name", "sku", "priceCents", "compareAtCents", "stock"];

export function editable(row: BulkRow, field: BulkField) {
  if (row.variantId) return VARIANT_FIELDS.includes(field);
  if (field === "stock") return !row.hasVariants; // com variações, o estoque é a soma delas
  return true;
}

export const STATUS_LABEL: Record<BulkStatus, string> = { ACTIVE: "Ativo", DRAFT: "Rascunho", ARCHIVED: "Arquivado" };

// ───────── Planilha

export const SHEET_COLUMNS: { field: BulkField | "productId" | "variantId"; header: string }[] = [
  { field: "productId", header: "ID" },
  { field: "variantId", header: "ID da variação" },
  { field: "name", header: "Nome" },
  { field: "sku", header: "SKU" },
  { field: "priceCents", header: "Preço" },
  { field: "compareAtCents", header: "Preço de" },
  { field: "costCents", header: "Custo" },
  { field: "stock", header: "Estoque" },
  { field: "categoryId", header: "Categoria" },
  { field: "brandId", header: "Marca" },
  { field: "status", header: "Status" },
  { field: "weightGrams", header: "Peso (g)" },
  { field: "widthCm", header: "Largura (cm)" },
  { field: "heightCm", header: "Altura (cm)" },
  { field: "depthCm", header: "Profundidade (cm)" },
  { field: "freeShipping", header: "Frete grátis" },
  { field: "ean", header: "EAN" },
];

export type SheetCell = string | number | null;
export type Lookup = { categories: { id: string; label: string }[]; brands: { id: string; name: string }[] };

/** Linhas da planilha (cabeçalho + dados). Dinheiro em reais, como número. */
export function rowsToSheet(rows: BulkRow[], lookup: Lookup): SheetCell[][] {
  const cat = new Map(lookup.categories.map((c) => [c.id, c.label]));
  const brand = new Map(lookup.brands.map((b) => [b.id, b.name]));
  const money = (c: number | null) => (c == null ? null : c / 100);
  const out: SheetCell[][] = [SHEET_COLUMNS.map((c) => c.header)];
  for (const r of rows) {
    const v = !!r.variantId;
    out.push(
      SHEET_COLUMNS.map(({ field }) => {
        if (field === "productId") return r.productId;
        if (field === "variantId") return r.variantId;
        if (v && !VARIANT_FIELDS.includes(field)) return null;
        switch (field) {
          case "priceCents":
          case "compareAtCents":
          case "costCents":
            return money(r[field]);
          case "stock":
            return !v && r.hasVariants ? null : r.stock;
          case "categoryId":
            return cat.get(r.categoryId) ?? null;
          case "brandId":
            return brand.get(r.brandId) ?? null;
          case "status":
            return STATUS_LABEL[r.status];
          case "freeShipping":
            return r.freeShipping ? "Sim" : "Não";
          default:
            return (r[field] as string | number | null) ?? null;
        }
      }),
    );
  }
  return out;
}

export function sheetToCsv(cells: SheetCell[][]): string {
  const esc = (c: SheetCell) => {
    const s = c == null ? "" : typeof c === "number" ? String(c).replace(".", ",") : c;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${cells.map((r) => r.map(esc).join(";")).join("\r\n")}\r\n`;
}

const HEADER_ALIASES: Record<string, BulkField | "productId" | "variantId"> = Object.fromEntries(SHEET_COLUMNS.map((c) => [normalizeKey(c.header), c.field]));
Object.assign(HEADER_ALIASES, {
  [normalizeKey("Produto")]: "name",
  [normalizeKey("Variação")]: "name",
  [normalizeKey("Preço de venda")]: "priceCents",
  [normalizeKey("Preço antigo")]: "compareAtCents",
  [normalizeKey("Peso")]: "weightGrams",
});

function parseStatusLabel(s: string): BulkStatus | null {
  const k = normalizeKey(s);
  if (/^(ativo|active|publicado|sim)$/.test(k)) return "ACTIVE";
  if (/^(rascunho|draft|pausado|inativo)$/.test(k)) return "DRAFT";
  if (/^(arquivado|archived)$/.test(k)) return "ARCHIVED";
  return null;
}

export type SheetApply = { rows: BulkRow[]; changed: number; notes: string[] };

/**
 * Aplica uma planilha (a exportada, editada no Excel) sobre as linhas da tela. Encontra cada
 * linha pelo ID (ou pelo SKU) e só muda as células preenchidas; célula vazia mantém o valor.
 */
export function applySheet(current: BulkRow[], sheet: SheetRow[], lookup: Lookup): SheetApply {
  const notes: string[] = [];
  const headerIndex = sheet.findIndex((r) => r.some((c) => HEADER_ALIASES[normalizeKey(c)] === "productId") || r.filter((c) => HEADER_ALIASES[normalizeKey(c)]).length >= 3);
  if (headerIndex < 0) return { rows: current, changed: 0, notes: ["Não encontrei o cabeçalho. Use a planilha exportada por esta tela."] };
  const cols = sheet[headerIndex].map((c) => HEADER_ALIASES[normalizeKey(c)] ?? null);
  const byKey = new Map(current.map((r) => [r.key, r]));
  const bySku = new Map(current.filter((r) => r.sku).map((r) => [r.sku.toLowerCase(), r]));
  const catByName = new Map(lookup.categories.flatMap((c) => [[normalizeKey(c.label), c.id], [normalizeKey(c.label.split("›").pop() ?? ""), c.id]] as [string, string][]));
  const brandByName = new Map(lookup.brands.map((b) => [normalizeKey(b.name), b.id]));
  const next = new Map<string, BulkRow>();
  let missing = 0;

  for (let i = headerIndex + 1; i < sheet.length; i++) {
    const cells = sheet[i];
    const get = (f: string) => {
      const idx = cols.indexOf(f as never);
      const v = idx >= 0 ? (cells[idx] ?? "").trim() : "";
      return v;
    };
    if (!cells.some((c) => c.trim())) continue;
    const pid = get("productId");
    const vid = get("variantId");
    const sku = get("sku");
    const base = (vid ? byKey.get(`v:${vid}`) : pid ? byKey.get(`p:${pid}`) : undefined) ?? (sku ? bySku.get(sku.toLowerCase()) : undefined);
    if (!base) {
      missing++;
      continue;
    }
    const row = { ...(next.get(base.key) ?? base) };
    const line = `Linha ${i + 1}`;
    for (const [idx, field] of cols.entries()) {
      if (!field || field === "productId" || field === "variantId") continue;
      const raw = (cells[idx] ?? "").trim();
      if (!raw || !editable(row, field)) continue;
      switch (field) {
        case "name":
          row.name = raw.slice(0, row.variantId ? 80 : 160);
          break;
        case "sku":
          row.sku = raw.slice(0, 64);
          break;
        case "ean":
          row.ean = raw.replace(/\D/g, "").slice(0, 14);
          break;
        case "priceCents":
        case "compareAtCents":
        case "costCents": {
          const c = parseMoney(raw);
          if (c == null) notes.push(`${line}: valor inválido em “${raw}”.`);
          else row[field] = c;
          break;
        }
        case "stock": {
          const n = parseInteger(raw);
          if (n == null) notes.push(`${line}: estoque inválido em “${raw}”.`);
          else row.stock = n;
          break;
        }
        case "weightGrams":
          row.weightGrams = parseWeight(raw) ?? row.weightGrams;
          break;
        case "widthCm":
        case "heightCm":
        case "depthCm":
          row[field] = parseNumber(raw) ?? row[field];
          break;
        case "freeShipping": {
          const b = parseYesNo(raw);
          if (b != null) row.freeShipping = b;
          break;
        }
        case "status": {
          const s = parseStatusLabel(raw);
          if (s) row.status = s;
          else notes.push(`${line}: status “${raw}” não reconhecido (use Ativo, Rascunho ou Arquivado).`);
          break;
        }
        case "categoryId": {
          const id = catByName.get(normalizeKey(raw));
          if (id) row.categoryId = id;
          else notes.push(`${line}: categoria “${raw}” não existe. Crie em Catálogo → Categorias.`);
          break;
        }
        case "brandId": {
          const id = brandByName.get(normalizeKey(raw));
          if (id) row.brandId = id;
          else notes.push(`${line}: marca “${raw}” não existe. Crie em Catálogo → Marcas.`);
          break;
        }
      }
    }
    next.set(base.key, row);
  }
  if (missing) notes.push(`${missing} linha(s) não correspondem a produtos desta loja (ID ou SKU não encontrado) e foram ignoradas.`);
  let changed = 0;
  const rows = current.map((r) => {
    const n = next.get(r.key);
    if (!n) return r;
    if (JSON.stringify(n) !== JSON.stringify(r)) changed++;
    return n;
  });
  return { rows, changed, notes: notes.slice(0, 50) };
}

/** Campos alterados de uma linha em relação ao original. */
export function diffRow(a: BulkRow, b: BulkRow): Partial<Record<BulkField, unknown>> {
  const out: Partial<Record<BulkField, unknown>> = {};
  for (const k of Object.keys(b) as (keyof BulkRow)[]) {
    if (k === "key" || k === "productId" || k === "variantId" || k === "hasVariants" || k === "image") continue;
    if (a[k] !== b[k]) out[k] = b[k];
  }
  return out;
}
