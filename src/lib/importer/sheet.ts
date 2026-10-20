import { unzipSync, strFromU8 } from "fflate";
import { normalizeKey } from "./dados";

// Importação por planilha: lê CSV ou Excel (.xlsx), acha a linha de títulos, reconhece as
// colunas pelo nome (inclusive as das planilhas exportadas do Mercado Livre e da Shopee) e
// transforma cada produto num texto no formato do dados.txt, para seguir o mesmo caminho.

export type SheetRow = string[];

// ─────────────── CSV

export function parseCsv(text: string): SheetRow[] {
  const src = text.replace(/^﻿/, "");
  const nl = src.indexOf("\n");
  const firstLine = nl < 0 ? src : src.slice(0, nl);
  const counts = [";", ",", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  const delim = counts.sort((a, b) => b[1] - a[1])[0][0];

  const rows: SheetRow[] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim()));
}

// ─────────────── Excel (.xlsx)

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");

/** Junta os trechos <t> de um item de texto (texto com formatação vem em vários). */
const textRuns = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join("");

function colIndex(ref: string) {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  return [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
}

/** Primeira aba (ou a que tiver mais linhas preenchidas, entre as primeiras). */
export function parseXlsx(data: Uint8Array): SheetRow[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, { filter: (f) => f.name.startsWith("xl/") && (f.name.endsWith(".xml") || f.name.endsWith(".rels")) });
  } catch {
    throw new Error("Não consegui abrir a planilha. Salve como .xlsx ou .csv e tente de novo.");
  }
  const read = (p: string) => (files[p] ? strFromU8(files[p]) : "");

  const shared = [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textRuns(m[1]));

  // Ordem das abas no workbook → arquivo de cada uma.
  const rels = new Map([...read("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((m) => [/Id="([^"]+)"/.exec(m[0])?.[1], /Target="([^"]+)"/.exec(m[0])?.[1]]));
  const sheets = [...read("xl/workbook.xml").matchAll(/<sheet\b[^>]*>/g)]
    .map((m) => rels.get(/r:id="([^"]+)"/.exec(m[0])?.[1]))
    .filter((t): t is string => !!t)
    .map((t) => (t.startsWith("/") ? t.slice(1) : `xl/${t}`).replace(/\/\.\//g, "/"));
  if (!sheets.length) sheets.push(...Object.keys(files).filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort());

  const parsed = sheets.slice(0, 5).map((path) => {
    const rows: SheetRow[] = [];
    for (const r of read(path).matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const row: string[] = [];
      for (const c of (r[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1];
        const body = c[2] ?? "";
        const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
        const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let value = "";
        if (type === "s") value = shared[Number(v)] ?? "";
        else if (type === "inlineStr") value = textRuns(body);
        else if (type === "b") value = v === "1" ? "sim" : "não";
        else if (v != null) value = decodeXml(v);
        const idx = ref ? colIndex(ref) : row.length;
        row[idx] = value.trim();
      }
      rows.push(Array.from(row, (x) => x ?? ""));
    }
    return rows;
  });
  // A planilha da Shopee tem abas de instruções: fica a aba com mais linhas preenchidas.
  return parsed.sort((a, b) => b.filter((r) => r.some(Boolean)).length - a.filter((r) => r.some(Boolean)).length)[0] ?? [];
}

// ─────────────── Colunas

type Column =
  | "nome"
  | "preco"
  | "preco_antigo"
  | "custo"
  | "estoque"
  | "sku"
  | "ean"
  | "descricao"
  | "resumo"
  | "marca"
  | "categoria"
  | "peso"
  | "largura"
  | "altura"
  | "profundidade"
  | "medidas"
  | "cor"
  | "modelo"
  | "voltagem"
  | "garantia"
  | "tags"
  | "video"
  | "destaque"
  | "lancamento"
  | "frete_gratis"
  | "status"
  | "fotos"
  | "variacao"
  | "grupo"
  | "especificacoes";

// Testados na ordem: o primeiro que casar com o título da coluna vence.
const COLUMN_RULES: [Column, RegExp][] = [
  ["grupo", /^(id_do_produto|id_do_anuncio|codigo_do_anuncio|numero_do_anuncio|item_id|product_id|id_produto|sku_de_referencia|sku_pai|parent_sku|produto_pai|agrupar|grupo)$/],
  ["variacao", /^(nome_da_variacao|variacao|variacoes|variation(_name)?|nome_da_opcao|opcao|integracao_da_variacao)/],
  ["fotos", /^(fotos?|imagens?|images?|pictures?|url_da_imagem|urls?_das?_(fotos|imagens)|links?_das?_(fotos|imagens)|imagem_(de_capa|principal|do_produto)|foto_(de_capa|principal|do_produto)|imagem_\d+|foto_\d+|image_\d+)/],
  ["preco_antigo", /^(preco_(antigo|de|original|cheio|riscado)|valor_antigo|de)$/],
  ["custo", /^(custo|preco_de_custo|preco_custo)$/],
  ["preco", /^(preco|precos|price|valor|preco_de_venda|preco_venda|preco_por|preco_unitario|preco_r)/],
  ["estoque", /^(estoque|quantidade|qtd|qtde|stock|quantidade_disponivel|estoque_disponivel|disponivel)/],
  ["ean", /^(ean|gtin|codigo_de_barras|cod_barras|codigo_universal|codigo_universal_de_produto|gtin_ean|ean_gtin)/],
  ["sku", /^(sku|codigo|cod|codigo_interno|sku_do_produto|sku_da_variacao|referencia|ref)$/],
  ["resumo", /^(resumo|descricao_curta|chamada|subtitulo)/],
  ["descricao", /^(descricao|description|descricao_do_produto|descricao_completa)/],
  ["nome", /^(nome|titulo|title|nome_do_produto|produto|titulo_do_anuncio|nome_do_anuncio)/],
  ["marca", /^(marca|brand|fabricante)/],
  ["categoria", /^(categoria|category|departamento)/],
  ["peso", /^(peso|weight)/],
  ["largura", /^(largura|width)/],
  ["altura", /^(altura|height)/],
  ["profundidade", /^(profundidade|comprimento|length|depth)/],
  ["medidas", /^(medidas|dimensoes)/],
  ["cor", /^(cor|color)$/],
  ["modelo", /^(modelo|model)$/],
  ["voltagem", /^(voltagem|tensao)/],
  ["garantia", /^garantia/],
  ["tags", /^(tags|palavras_chave)/],
  ["video", /^(video|link_do_video|youtube)/],
  ["destaque", /^destaque/],
  ["lancamento", /^lancamento/],
  ["frete_gratis", /^frete_gr/],
  ["status", /^(status|situacao)$/],
  ["especificacoes", /^(especificacoes|ficha_tecnica|caracteristicas)$/],
];

function classify(header: string): Column | null {
  const k = normalizeKey(header);
  if (!k) return null;
  return COLUMN_RULES.find(([, re]) => re.test(k))?.[0] ?? null;
}

export type SheetLayout = { headerRow: number; columns: Map<number, Column>; headers: string[] };

/** A linha de títulos é a que reconhece mais colunas, entre as 30 primeiras (precisa ter nome e preço). */
export function detectLayout(rows: SheetRow[]): SheetLayout | null {
  let best: SheetLayout | null = null;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const columns = new Map<number, Column>();
    rows[i].forEach((h, idx) => {
      const c = classify(h);
      // Colunas repetidas só valem para fotos (Imagem 1, Imagem 2…); nas outras fica a primeira.
      if (c && (c === "fotos" || ![...columns.values()].includes(c))) columns.set(idx, c);
    });
    const kinds = new Set(columns.values());
    if (!kinds.has("nome") || !kinds.has("preco")) continue;
    if (kinds.size > bestScore) {
      bestScore = kinds.size;
      best = { headerRow: i, columns, headers: rows[i] };
    }
  }
  return best;
}

export type SheetItem = { key: string; folder: string; dadosText: string; photoUrls: string[] };

const URL_RE = /https?:\/\/[^\s,;|"'<>]+/gi;
const oneLine = (s: string) => s.replace(/\s*[\r\n]+\s*/g, " ").trim();

/** Peso da planilha: título com "kg" ou número pequeno com decimais é quilo. */
function sheetWeight(value: string, header: string) {
  if (/[a-z]/i.test(value)) return value;
  const k = normalizeKey(header);
  if (/kg|quilo/.test(k)) return `${value} kg`;
  if (/(^|_)g$|grama/.test(k)) return `${value} g`;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 30 && /[.,]/.test(value) ? `${value} kg` : value;
}

/** Medida: título com "mm" ou "m" leva a unidade junto. */
function sheetLength(value: string, header: string) {
  if (/[a-z]/i.test(value)) return value;
  const k = normalizeKey(header);
  if (/(^|_)mm($|_)/.test(k)) return `${value} mm`;
  if (/(^|_)m($|_)/.test(k)) return `${value} m`;
  return value;
}

export function sheetToItems(rows: SheetRow[]): { items: SheetItem[]; layout: SheetLayout } {
  const layout = detectLayout(rows);
  if (!layout) throw new Error("Não achei a linha de títulos. A planilha precisa ter pelo menos as colunas “nome” e “preço”.");

  type Rec = { line: number; get: (c: Column) => string; photos: string[]; header: (c: Column) => string };
  const recs: Rec[] = [];
  for (let i = layout.headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row.some((c) => c && c.trim())) continue;
    const get = (c: Column) => {
      for (const [idx, col] of layout.columns) if (col === c && row[idx]) return row[idx].trim();
      return "";
    };
    const header = (c: Column) => {
      for (const [idx, col] of layout.columns) if (col === c) return layout.headers[idx] ?? "";
      return "";
    };
    const photos = [...layout.columns].filter(([, c]) => c === "fotos").flatMap(([idx]) => (row[idx] ?? "").match(URL_RE) ?? []);
    // Linhas de instrução das planilhas modelo: sem preço que pareça número, sem foto e sem SKU.
    const price = get("preco");
    if (!/\d/.test(price) && !photos.length && !get("sku")) continue;
    recs.push({ line: i + 1, get, photos, header });
  }

  // Variações: linhas com o mesmo produto (coluna de grupo, ou mesmo nome quando há coluna de variação).
  const hasVariation = [...layout.columns.values()].includes("variacao");
  const groups = new Map<string, Rec[]>();
  for (const r of recs) {
    const g = r.get("grupo") || (hasVariation && r.get("variacao") ? `nome:${normalizeKey(r.get("nome"))}` : "");
    const key = g ? `g:${g}` : `l:${r.line}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const items: SheetItem[] = [];
  for (const [key, list] of groups) {
    // Na Shopee e no ML a primeira linha do grupo costuma trazer os dados do anúncio.
    const first = (c: Column) => list.map((r) => r.get(c)).find(Boolean) ?? "";
    const lines: string[] = [];
    const add = (k: string, v: string) => {
      if (v) lines.push(`${k}: ${oneLine(v)}`);
    };
    add("nome", first("nome"));
    const variants = list.length > 1 || (hasVariation && list[0].get("variacao")) ? list.filter((r) => r.get("variacao")) : [];
    const prices = list.map((r) => r.get("preco")).filter(Boolean);
    add("preco", variants.length ? prices.sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")))[0] ?? "" : first("preco"));
    add("preco_antigo", first("preco_antigo"));
    add("custo", first("custo"));
    if (!variants.length) add("estoque", first("estoque"));
    if (!variants.length) add("sku", first("sku"));
    add("ean", variants.length ? "" : first("ean"));
    add("marca", first("marca"));
    add("categoria", first("categoria"));
    add("modelo", first("modelo"));
    add("cor", first("cor"));
    add("voltagem", first("voltagem"));
    add("garantia", first("garantia"));
    const peso = first("peso");
    if (peso) add("peso", sheetWeight(peso, list[0].header("peso")));
    add("medidas", first("medidas"));
    for (const c of ["largura", "altura", "profundidade"] as const) {
      const v = first(c);
      if (v) add(c, sheetLength(v, list[0].header(c)));
    }
    add("resumo", first("resumo"));
    add("tags", first("tags"));
    add("video", first("video"));
    add("destaque", first("destaque"));
    add("lancamento", first("lancamento"));
    add("frete_gratis", first("frete_gratis"));
    add("status", first("status"));
    if (variants.length) {
      lines.push("variacao: Opção", "[variacoes]");
      for (const r of variants) lines.push([r.get("variacao"), r.get("preco"), r.get("estoque"), r.get("sku")].map((s) => oneLine(s).replace(/[|;]/g, "/")).join(" | "));
    }
    const specs = first("especificacoes");
    if (specs) {
      lines.push("[especificacoes]");
      for (const part of specs.split(/[\n;]+/)) if (part.includes(":")) lines.push(oneLine(part));
    }
    const desc = first("descricao");
    if (desc) lines.push("[descricao]", desc);

    const photoUrls = [...new Set(list.flatMap((r) => r.photos))];
    items.push({ key, folder: `Linha ${list[0].line}`, dadosText: lines.join("\n"), photoUrls });
  }
  return { items, layout };
}

/** Modelo de planilha (CSV com ; abre direto no Excel em português). */
export const SHEET_TEMPLATE = [
  ["nome", "preco", "preco_antigo", "estoque", "categoria", "marca", "sku", "ean", "voltagem", "garantia", "peso", "medidas", "descricao", "fotos"],
  [
    "Fone de Ouvido Bluetooth JBL Tune 520BT Preto",
    "299,90",
    "349,90",
    "10",
    "Fones de ouvido",
    "JBL",
    "JBL-T520-PT",
    "6925281974571",
    "não se aplica",
    "12 meses",
    "250 g",
    "20 x 18 x 6 cm",
    "Som JBL Pure Bass e até 57 horas de bateria.",
    "https://exemplo.com/foto1.jpg, https://exemplo.com/foto2.jpg",
  ],
]
  .map((r) => r.map((c) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(";"))
  .join("\r\n");
