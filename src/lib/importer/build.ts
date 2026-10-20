import { onlyDigits } from "@/lib/utils";
import {
  parseDados,
  parseInteger,
  parseLength,
  parseMeasures,
  parseMoney,
  parseStatus,
  parseVoltage,
  parseWarranty,
  parseWeight,
  parseYesNo,
  type ParsedDados,
} from "./dados";

// Transforma o dados.txt já lido nos campos do cadastro de produto, apontando o que faltou
// ou não foi entendido. Categoria e marca saem como texto: quem resolve é o servidor.

export type ImportDraft = {
  name: string;
  priceCents: number | null;
  compareAtCents: number | null;
  costCents: number | null;
  stock: number;
  category: string | null;
  brand: string | null;
  sku: string | null;
  ean: string | null;
  voltage: "V110" | "V220" | "BIVOLT" | "NA" | null;
  warrantyMonths: number | null;
  weightGrams: number | null;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
  color: string | null;
  model: string | null;
  shortDescription: string | null;
  description: string | null;
  tags: string[];
  videoUrl: string | null;
  featured: boolean;
  isNew: boolean;
  freeShipping: boolean;
  status: "ACTIVE" | "DRAFT" | null;
  variantLabel: string | null;
  variants: { name: string; sku: string | null; priceCents: number | null; stock: number; active: boolean }[];
  specs: { label: string; value: string }[];
  metaTitle: string | null;
  metaDescription: string | null;
};

export type BuildResult = { draft: ImportDraft; errors: string[]; warnings: string[]; nameFromFolder: boolean };

/** Nome da pasta vira nome do produto: "03 - Fone JBL_Tune" → "Fone JBL Tune". */
export function nameFromFolder(folder: string) {
  return folder
    .replace(/^\s*\d+\s*[-_.)]\s*/, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildDraft(folder: string, dadosText: string | null): BuildResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const p: ParsedDados = dadosText != null ? parseDados(dadosText) : { fields: {}, specs: [], variants: [], description: null, ignored: [] };
  const f = p.fields;

  if (dadosText == null) errors.push("Falta o arquivo dados.txt com o preço.");

  const name = (f.nome ?? nameFromFolder(folder)).slice(0, 160);
  if (name.length < 2) errors.push("Informe o nome (linha “nome:”).");

  // Campo preenchido mas não entendido vira aviso (o produto entra sem ele).
  const read = <T,>(label: string, raw: string | undefined, parse: (s: string) => T | null): T | null => {
    if (!raw) return null;
    const v = parse(raw);
    if (v == null) warnings.push(`Não entendi ${label}: “${raw}”.`);
    return v;
  };

  const priceCents = read("o preço", f.preco, parseMoney);
  if (dadosText != null && !f.preco) errors.push("Falta o preço (linha “preco:”).");
  else if (priceCents === 0) errors.push("O preço precisa ser maior que zero.");
  else if (f.preco && priceCents == null) errors.push(`Preço inválido: “${f.preco}”.`);

  let compareAtCents = read("o preço antigo", f.precoAntigo, parseMoney);
  if (compareAtCents != null && priceCents != null && compareAtCents <= priceCents) {
    warnings.push("O preço antigo não é maior que o preço; foi ignorado.");
    compareAtCents = null;
  }

  const measures = read("as medidas (use 20 x 15 x 8 cm)", f.medidas, parseMeasures);
  let ean = f.ean ? onlyDigits(f.ean) : null;
  if (ean && (ean.length < 8 || ean.length > 14)) {
    warnings.push(`EAN inválido: “${f.ean}” (precisa de 8 a 14 números).`);
    ean = null;
  }
  let sku = f.sku?.trim().slice(0, 64) || null;
  if (sku && !/^[\w\-./ ]*$/.test(sku)) {
    warnings.push(`SKU com caracteres inválidos: “${sku}” (use letras, números, hífen, ponto ou barra).`);
    sku = null;
  }
  let videoUrl = f.video ?? null;
  if (videoUrl && !/^https?:\/\/[^\s"'<>]+$/i.test(videoUrl)) {
    warnings.push("O link do vídeo precisa começar com https://.");
    videoUrl = null;
  }

  const variants = p.variants.map((v, i) => {
    const price = v.price ? parseMoney(v.price) : null;
    if (v.price && price == null) warnings.push(`Variação ${i + 1}: preço “${v.price}” não entendido; usa o preço do produto.`);
    const stock = v.stock ? parseInteger(v.stock) : 0;
    if (v.stock && stock == null) warnings.push(`Variação ${i + 1}: estoque “${v.stock}” não entendido; ficou 0.`);
    return { name: v.name.slice(0, 80), sku: v.sku.slice(0, 64) || null, priceCents: price || null, stock: stock ?? 0, active: true };
  });
  const variantLabel = variants.length ? (f.variacao?.slice(0, 40) ?? "Opção") : null;
  if (variants.length && !f.variacao) warnings.push("As variações ficaram com o título “Opção” (linha “variacao:” não informada).");

  if (p.ignored.length) warnings.push(`Linhas ignoradas no dados.txt: ${p.ignored.slice(0, 3).map((l) => `“${l.slice(0, 40)}”`).join(", ")}${p.ignored.length > 3 ? "…" : ""}`);

  const yes = (label: string, raw: string | undefined) => read(label, raw, parseYesNo) ?? false;

  const draft: ImportDraft = {
    name,
    priceCents,
    compareAtCents,
    costCents: read("o custo", f.custo, parseMoney),
    stock: read("o estoque", f.estoque, parseInteger) ?? 0,
    category: f.categoria ?? null,
    brand: f.marca?.slice(0, 80) ?? null,
    sku,
    ean,
    voltage: read("a voltagem (use 110, 220, bivolt ou não se aplica)", f.voltagem, parseVoltage),
    warrantyMonths: read("a garantia", f.garantia, parseWarranty),
    weightGrams: read("o peso", f.peso, parseWeight),
    widthCm: measures?.width ?? read("a largura", f.largura, parseLength),
    heightCm: measures?.height ?? read("a altura", f.altura, parseLength),
    depthCm: measures?.depth ?? read("a profundidade", f.profundidade, parseLength),
    color: f.cor?.slice(0, 60) ?? null,
    model: f.modelo?.slice(0, 80) ?? null,
    shortDescription: f.resumo?.slice(0, 500) ?? null,
    description: p.description?.slice(0, 20000) ?? null,
    tags: (f.tags ?? "")
      .split(/[,;]/)
      .map((t) => t.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 40),
    videoUrl,
    featured: yes("“destaque”", f.destaque),
    isNew: yes("“lançamento”", f.lancamento),
    freeShipping: yes("“frete grátis”", f.freteGratis),
    status: read("o status (use ativo ou rascunho)", f.status, parseStatus),
    variantLabel,
    variants,
    specs: p.specs.map((s) => ({ label: s.label.slice(0, 60), value: s.value.slice(0, 300) })).slice(0, 60),
    metaTitle: f.tituloSeo?.slice(0, 120) ?? null,
    metaDescription: f.descricaoSeo?.slice(0, 320) ?? null,
  };
  return { draft, errors, warnings, nameFromFolder: !f.nome };
}
