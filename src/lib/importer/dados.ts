// Importador de produtos: leitura do arquivo dados.txt de cada pasta de produto e escolha
// das fotos. Sem dependências do servidor (roda no navegador e no servidor, e nos testes).
//
// Formato do dados.txt: uma informação por linha ("chave: valor") e, depois, seções
// opcionais [especificacoes], [variacoes] e [descricao]. Linhas começando com # são ignoradas.

export const MAX_IMPORT_PHOTOS = 12;

const IMAGE_EXT = /\.(jpe?g|png|webp|avif|gif|heic|heif|tiff?)$/i;
// Fotos de apoio (caixa, manual, etiqueta): servem de consulta e não vão para o anúncio.
const INFO_PREFIX = /^(info|caixa|manual|etiqueta)/i;

export type ImportField =
  | "nome"
  | "preco"
  | "precoAntigo"
  | "custo"
  | "estoque"
  | "categoria"
  | "marca"
  | "sku"
  | "ean"
  | "voltagem"
  | "garantia"
  | "peso"
  | "medidas"
  | "largura"
  | "altura"
  | "profundidade"
  | "cor"
  | "modelo"
  | "resumo"
  | "tags"
  | "video"
  | "destaque"
  | "lancamento"
  | "freteGratis"
  | "status"
  | "variacao"
  | "tituloSeo"
  | "descricaoSeo";

// Nomes aceitos para cada campo, já sem acento, em minúsculas e com _ no lugar de espaço.
const ALIASES: Record<ImportField, string[]> = {
  nome: ["nome", "titulo", "produto", "nome_do_produto"],
  preco: ["preco", "valor", "preco_venda", "preco_de_venda", "preco_por", "por"],
  precoAntigo: ["preco_antigo", "preco_de", "de", "valor_antigo"],
  custo: ["custo", "preco_custo", "preco_de_custo"],
  estoque: ["estoque", "quantidade", "qtd", "qtde"],
  categoria: ["categoria"],
  marca: ["marca", "fabricante"],
  sku: ["sku", "codigo", "cod", "codigo_interno"],
  ean: ["ean", "gtin", "codigo_de_barras", "cod_barras"],
  voltagem: ["voltagem", "tensao", "voltagem_tensao"],
  garantia: ["garantia"],
  peso: ["peso", "peso_embalagem"],
  medidas: ["medidas", "dimensoes", "tamanho_embalagem", "embalagem"],
  largura: ["largura"],
  altura: ["altura"],
  profundidade: ["profundidade", "comprimento"],
  cor: ["cor"],
  modelo: ["modelo"],
  resumo: ["resumo", "descricao_curta", "chamada"],
  tags: ["tags", "palavras_chave", "etiquetas"],
  video: ["video", "link_do_video", "youtube"],
  destaque: ["destaque", "em_destaque"],
  lancamento: ["lancamento", "novo", "novidade"],
  freteGratis: ["frete_gratis", "frete_gratuito"],
  status: ["status", "situacao"],
  variacao: ["variacao", "tipo_de_variacao", "nome_da_variacao", "titulo_das_variacoes"],
  tituloSeo: ["titulo_seo", "seo_titulo", "titulo_google"],
  descricaoSeo: ["descricao_seo", "seo_descricao", "descricao_google"],
};

const FIELD_BY_ALIAS = new Map<string, ImportField>(
  (Object.entries(ALIASES) as [ImportField, string[]][]).flatMap(([field, names]) => names.map((n) => [n, field] as const)),
);

type Section = "campos" | "especificacoes" | "variacoes" | "descricao";

const SECTION_BY_NAME: Record<string, Section> = {
  especificacoes: "especificacoes",
  especificacao: "especificacoes",
  ficha_tecnica: "especificacoes",
  caracteristicas: "especificacoes",
  variacoes: "variacoes",
  variacao: "variacoes",
  descricao: "descricao",
  descricao_completa: "descricao",
};

/** "Preço de Venda" → "preco_de_venda". */
export function normalizeKey(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export type RawVariant = { name: string; price: string; stock: string; sku: string };

export type ParsedDados = {
  fields: Partial<Record<ImportField, string>>;
  specs: { label: string; value: string }[];
  variants: RawVariant[];
  description: string | null;
  /** Linhas que não foram entendidas (chave desconhecida ou sem "chave: valor"). */
  ignored: string[];
};

export function parseDados(text: string): ParsedDados {
  const out: ParsedDados = { fields: {}, specs: [], variants: [], description: null, ignored: [] };
  const description: string[] = [];
  let section: Section = "campos";

  for (const rawLine of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    const header = /^\[(.+)\]$/.exec(line);
    if (header) {
      const next = SECTION_BY_NAME[normalizeKey(header[1])];
      if (next) {
        section = next;
        continue;
      }
    }
    if (section === "descricao") {
      description.push(rawLine.trimEnd());
      continue;
    }
    if (!line || line.startsWith("#")) continue;

    if (section === "variacoes") {
      const [name = "", price = "", stock = "", sku = ""] = line.split(/\s*[|;]\s*/).map((s) => s.trim());
      if (name) out.variants.push({ name, price, stock, sku });
      continue;
    }

    const sep = line.indexOf(":");
    if (sep <= 0) {
      out.ignored.push(line);
      continue;
    }
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim();
    if (section === "especificacoes") {
      if (value) out.specs.push({ label: key, value });
      continue;
    }
    const field = FIELD_BY_ALIAS.get(normalizeKey(key));
    if (!field) out.ignored.push(line);
    else if (value) out.fields[field] = value;
  }

  const desc = description.join("\n").trim();
  out.description = desc || null;
  return out;
}

// ─────────────── Conversões dos valores digitados

/** "R$ 1.299,90", "1299.90", "129" → centavos. null se não for número. */
export function parseMoney(input: string | undefined): number | null {
  if (!input) return null;
  let s = input.replace(/r\$|\s/gi, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{3}$/.test(s) || (s.match(/\./g)?.length ?? 0) > 1) s = s.replace(/\./g, ""); // 1.299 = mil e duzentos
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Número com vírgula ou ponto decimal: "12,5" → 12.5. */
export function parseNumber(input: string | undefined): number | null {
  if (!input) return null;
  const m = /\d+(?:[.,]\d+)?/.exec(input.replace(/\s/g, ""));
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function parseInteger(input: string | undefined): number | null {
  // "10", "1.200", "10 unidades"
  const m = /^\s*(\d[\d.]*)(\s*[a-zç]*)?\s*$/i.exec(input ?? "");
  return m ? Number(m[1].replace(/\./g, "")) : null;
}

/** "250", "250 g", "1,2 kg" → gramas. Número sem unidade é grama. */
export function parseWeight(input: string | undefined): number | null {
  const n = parseNumber(input);
  if (n == null) return null;
  return Math.round(/kg|quilo/i.test(input ?? "") ? n * 1000 : n);
}

/** Centímetros; aceita "mm" e "m". */
export function parseLength(input: string | undefined): number | null {
  const n = parseNumber(input);
  if (n == null) return null;
  const unit = /\d\s*(mm|cm|m)\b/i.exec(input ?? "")?.[1]?.toLowerCase();
  const cm = unit === "mm" ? n / 10 : unit === "m" ? n * 100 : n;
  return Math.round(cm * 10) / 10;
}

/** "20 x 15 x 8" (largura x altura x profundidade, em cm). */
export function parseMeasures(input: string | undefined): { width: number; height: number; depth: number } | null {
  if (!input) return null;
  const parts = input.split(/\s*[x×*]\s*/i);
  if (parts.length !== 3) return null;
  const unit = /(mm|cm|m)\s*$/i.exec(input)?.[1] ?? "";
  const [width, height, depth] = parts.map((p) => parseLength(/[a-z]/i.test(p) ? p : `${p}${unit}`));
  if (width == null || height == null || depth == null) return null;
  return { width, height, depth };
}

/** Meses de garantia: "12", "12 meses", "1 ano", "90 dias". */
export function parseWarranty(input: string | undefined): number | null {
  const n = parseNumber(input);
  if (n == null) return null;
  if (/ano/i.test(input ?? "")) return Math.round(n * 12);
  if (/dia/i.test(input ?? "")) return Math.max(1, Math.round(n / 30));
  return Math.round(n);
}

export function parseVoltage(input: string | undefined): "V110" | "V220" | "BIVOLT" | "NA" | null {
  if (!input) return null;
  const s = normalizeKey(input);
  if (/bivolt|110_220|127_220|automatic/.test(s)) return "BIVOLT";
  if (/^(110|127)/.test(s)) return "V110";
  if (/^(220|230)/.test(s)) return "V220";
  if (/^(nao_se_aplica|na|n_a|nenhuma|pilha|bateria|usb|recarregavel)/.test(s)) return "NA";
  return null;
}

/** sim/não. null quando não reconhece. */
export function parseYesNo(input: string | undefined): boolean | null {
  if (!input) return null;
  const s = normalizeKey(input);
  if (["sim", "s", "yes", "x", "1", "true", "verdadeiro"].includes(s)) return true;
  if (["nao", "n", "no", "0", "false", "falso"].includes(s)) return false;
  return null;
}

export function parseStatus(input: string | undefined): "ACTIVE" | "DRAFT" | null {
  if (!input) return null;
  const s = normalizeKey(input);
  if (/^(ativo|publicado|publicar|no_ar|active)$/.test(s)) return "ACTIVE";
  if (/^(rascunho|draft|oculto|pausado|inativo|finalizado|inactive|paused)$/.test(s)) return "DRAFT";
  return null;
}

// ─────────────── Fotos

export function isImageName(name: string) {
  return IMAGE_EXT.test(name);
}

export function isInfoPhoto(name: string) {
  return INFO_PREFIX.test(name);
}

/** Ordem "natural": 2.jpg antes de 10.jpg. */
export function naturalCompare(a: string, b: string) {
  return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
}

/**
 * Separa as fotos do anúncio (na ordem do nome, a primeira é a capa) das fotos de apoio.
 * Recebe só os arquivos da raiz da pasta do produto.
 */
export function pickPhotos(names: string[]) {
  const images = names.filter(isImageName).sort(naturalCompare);
  const listing = images.filter((n) => !isInfoPhoto(n));
  return {
    photos: listing.slice(0, MAX_IMPORT_PHOTOS),
    extra: Math.max(0, listing.length - MAX_IMPORT_PHOTOS),
    info: images.length - listing.length,
  };
}

/** Arquivo de dados da pasta: dados.txt (ou "dados" sem extensão / documento do Google). */
export function isDadosName(name: string) {
  return /^dados(\.txt)?$/i.test(name.trim());
}

export const DADOS_TEMPLATE = `# Modelo do arquivo dados.txt (um por pasta de produto).
# Linhas com # são ignoradas. Só "preco" é obrigatório; sem "nome", vale o nome da pasta.
# Fotos: coloque na pasta 01.jpg, 02.jpg… (a 01 é a capa, até ${MAX_IMPORT_PHOTOS}).
# Fotos que começam com info, caixa, manual ou etiqueta não vão para o anúncio.

nome: Fone de Ouvido Bluetooth JBL Tune 520BT Preto
preco: 299,90
preco_antigo: 349,90
custo: 180,00
estoque: 10
categoria: Fones de ouvido
marca: JBL
modelo: Tune 520BT
cor: Preto
sku: JBL-T520-PT
ean: 6925281974571
voltagem: não se aplica
garantia: 12 meses
peso: 250 g
medidas: 20 x 18 x 6 cm
resumo: Som JBL Pure Bass, até 57 horas de bateria e conexão multiponto.
tags: fone, bluetooth, jbl, sem fio
destaque: não
lancamento: sim
frete_gratis: não

# Para variações (ex.: cores), descomente as linhas abaixo:
# variacao: Cor
# [variacoes]
# Preto | 299,90 | 5 | JBL-T520-PT
# Azul  | 299,90 | 3 | JBL-T520-AZ

[especificacoes]
Conexão: Bluetooth 5.3
Bateria: até 57 horas
Recarga: USB-C

[descricao]
Escreva aqui a descrição completa, com quantas linhas quiser.

Pode usar parágrafos e listas:
- Item 1
- Item 2
`;
