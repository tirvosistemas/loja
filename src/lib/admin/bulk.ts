import { normalizeKey, parseInteger, parseMoney, parseNumber, parseWeight, parseYesNo } from "@/lib/importer/dados";
import type { SheetRow } from "@/lib/importer/sheet";
import { isValidGtin } from "@/lib/barcode";

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

type SheetField = BulkField | "productId" | "variantId" | "stockBase";

export const SHEET_COLUMNS: { field: SheetField; header: string }[] = [
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
  // Na volta, só a diferença entre "Estoque" e esta coluna é aplicada: vendas feitas depois da exportação não se perdem.
  { field: "stockBase", header: "Estoque na exportação (não editar)" },
];

export type SheetCell = string | number | null;
export type Lookup = { categories: { id: string; label: string }[]; brands: { id: string; name: string }[] };

/** Linhas da planilha (aviso opcional + cabeçalho + dados). Dinheiro em reais, como número. */
export function rowsToSheet(rows: BulkRow[], lookup: Lookup, note?: string): SheetCell[][] {
  const cat = new Map(lookup.categories.map((c) => [c.id, c.label]));
  const brand = new Map(lookup.brands.map((b) => [b.id, b.name]));
  const money = (c: number | null) => (c == null ? null : c / 100);
  const out: SheetCell[][] = [SHEET_COLUMNS.map((c) => c.header)];
  if (note) out.unshift(SHEET_COLUMNS.map((_, i) => (i ? null : note)));
  for (const r of rows) {
    const v = !!r.variantId;
    out.push(
      SHEET_COLUMNS.map(({ field }) => {
        if (field === "productId") return r.productId;
        if (field === "variantId") return r.variantId;
        if (field === "stock" || field === "stockBase") return !v && r.hasVariants ? null : r.stock;
        if (v && !VARIANT_FIELDS.includes(field)) return null;
        switch (field) {
          case "priceCents":
          case "compareAtCents":
          case "costCents":
            return money(r[field]);
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
    let s = c == null ? "" : typeof c === "number" ? String(c).replace(".", ",") : c;
    // Texto que começa com = + - @ vira fórmula no Excel; o apóstrofo o mantém como texto.
    if (typeof c === "string" && /^[=+\-@\t\r]/.test(c)) s = `'${c}`;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${cells.map((r) => r.map(esc).join(";")).join("\r\n")}\r\n`;
}

const HEADER_ALIASES: Record<string, SheetField> = Object.fromEntries(SHEET_COLUMNS.map((c) => [normalizeKey(c.header), c.field]));
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

/** Tira o apóstrofo que o CSV exportado põe antes de = + - @ (nome, SKU, marca…). */
const unformula = (s: string) => (/^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s);

// Célula numérica do .xlsx: o ponto é sempre decimal ("21.989" = 21,989), nunca milhar.
const xlsxNumber = (raw: string) => {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const readMoney = (raw: string, num: boolean) => {
  if (!num) return parseMoney(raw);
  const n = xlsxNumber(raw);
  return n == null ? null : Math.round(n * 100);
};
const readInt = (raw: string, num: boolean) => {
  const n = num ? xlsxNumber(raw) : parseInteger(raw);
  return n != null && Number.isInteger(n) ? n : null;
};

const leafKey = (label: string) => normalizeKey(label.split("›").pop() ?? "");

export type SheetApply = { rows: BulkRow[]; changed: number; notes: string[] };

/**
 * Aplica uma planilha (a exportada, editada no Excel) sobre as linhas da tela. Encontra cada
 * linha pelo ID (ou pelo SKU) e só muda as células preenchidas; célula vazia mantém o valor.
 * `numeric` (de readXlsx) marca as células que o .xlsx guardou como número.
 */
export function applySheet(current: BulkRow[], sheet: SheetRow[], lookup: Lookup, opts: { numeric?: boolean[][] } = {}): SheetApply {
  const notes: string[] = [];
  const headerIndex = sheet.findIndex((r) => r.some((c) => HEADER_ALIASES[normalizeKey(c)] === "productId") || r.filter((c) => HEADER_ALIASES[normalizeKey(c)]).length >= 3);
  if (headerIndex < 0) return { rows: current, changed: 0, notes: ["Não encontrei o cabeçalho. Use a planilha exportada por esta tela."] };
  const cols = sheet[headerIndex].map((c) => HEADER_ALIASES[normalizeKey(c)] ?? null);
  const byKey = new Map(current.map((r) => [r.key, r]));
  const bySku = new Map(current.filter((r) => r.sku).map((r) => [r.sku.toLowerCase(), r]));
  const catByLabel = new Map(lookup.categories.map((c) => [normalizeKey(c.label), c.id]));
  // Nome curto ("Fones") também vale; null quando mais de uma categoria tem esse nome.
  const catByLeaf = new Map<string, string | null>();
  for (const c of lookup.categories) catByLeaf.set(leafKey(c.label), catByLeaf.has(leafKey(c.label)) ? null : c.id);
  const brandByName = new Map(lookup.brands.map((b) => [normalizeKey(b.name), b.id]));
  const next = new Map<string, BulkRow>();
  const exportedIdx = cols.indexOf("stockBase");
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
    const sku = unformula(get("sku"));
    const base = (vid ? byKey.get(`v:${vid}`) : pid ? byKey.get(`p:${pid}`) : undefined) ?? (sku ? bySku.get(sku.toLowerCase()) : undefined);
    if (!base) {
      missing++;
      continue;
    }
    const row = { ...(next.get(base.key) ?? base) };
    const line = `Linha ${i + 1}`;
    for (const [idx, field] of cols.entries()) {
      if (!field || field === "productId" || field === "variantId" || field === "stockBase") continue;
      const raw = unformula((cells[idx] ?? "").trim());
      if (!raw || !editable(row, field)) continue;
      const num = !!opts.numeric?.[i]?.[idx];
      switch (field) {
        case "name":
          row.name = raw.slice(0, row.variantId ? 80 : 160);
          break;
        case "sku": {
          const s = raw.slice(0, 64);
          // O Excel tira zeros à esquerda e escreve números longos como 1,23E+12.
          if (s !== row.sku && (/^\d+([.,]\d+)?e[+-]?\d+$/i.test(s) || (/^0+\d/.test(row.sku) && s === row.sku.replace(/^0+/, ""))))
            notes.push(`${line}: SKU “${raw}” parece ter sido alterado pelo Excel; mantive “${row.sku}”. Formate a coluna como Texto ou use o .xlsx.`);
          else row.sku = s;
          break;
        }
        case "ean": {
          const ean = raw.replace(/\s/g, "");
          if (ean === row.ean) break;
          if (isValidGtin(ean)) row.ean = ean;
          else notes.push(`${line}: EAN “${raw}” inválido, mantive o atual. Se o Excel mostrou o código como 7,89E+12 (notação científica), formate a coluna como Texto ou use o .xlsx.`);
          break;
        }
        case "priceCents":
        case "compareAtCents":
        case "costCents": {
          const c = readMoney(raw, num);
          if (c == null) notes.push(`${line}: valor inválido em “${raw}”.`);
          else row[field] = c;
          break;
        }
        case "stock": {
          const n = readInt(raw, num);
          if (n == null) {
            notes.push(`${line}: estoque inválido em “${raw}”.`);
            break;
          }
          const exportedRaw = exportedIdx >= 0 ? (cells[exportedIdx] ?? "").trim() : "";
          const exported = exportedRaw ? readInt(exportedRaw, !!opts.numeric?.[i]?.[exportedIdx]) : null;
          if (exported == null) row.stock = n; // planilha sem a coluna (antiga): valor absoluto
          // Estoque já igual ao da planilha: ela já foi aplicada (mesmo arquivo enviado de novo).
          else if (n !== exported && n !== base.stock) {
            row.stock = Math.max(0, base.stock + n - exported);
            if (base.stock !== exported) notes.push(`${line}: o estoque mudou de ${exported} para ${base.stock} desde a exportação; apliquei só a mudança da planilha (${n > exported ? "+" : ""}${n - exported}) e ficou ${row.stock}.`);
          }
          break;
        }
        case "weightGrams": {
          // "1.200" é mil e duzentos gramas, como no preço e no estoque.
          const g = num ? xlsxNumber(raw) : parseWeight(/^\d{1,3}(\.\d{3})+(\s*g)?$/i.test(raw) ? raw.replace(/\./g, "") : raw);
          if (g != null) row.weightGrams = Math.round(g);
          break;
        }
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
          const k = normalizeKey(raw);
          const id = catByLabel.get(k) ?? catByLeaf.get(k);
          if (id) row.categoryId = id;
          else if (id === null)
            notes.push(`${line}: há mais de uma categoria “${raw}”; use o caminho completo (${lookup.categories.filter((c) => leafKey(c.label) === k).map((c) => c.label).join(" ou ")}).`);
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
