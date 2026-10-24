// Busca de produto pelo código de barras (EAN/GTIN). Primeiro nas bases abertas e gratuitas
// Open Food/Beauty/Pet Food/Products Facts (sem chave nem cota diária); depois na UPCitemdb,
// gratuita e sem chave (100 consultas por dia, 6 por minuto). Devolve só o que a base informa; nada é inventado.

const OPEN_FACTS = [
  ["Open Food Facts", "world.openfoodfacts.org"],
  ["Open Beauty Facts", "world.openbeautyfacts.org"],
  ["Open Pet Food Facts", "world.openpetfoodfacts.org"],
  ["Open Products Facts", "world.openproductsfacts.org"],
] as const;

export type BarcodeResult = {
  source: (typeof OPEN_FACTS)[number][0] | "UPCitemdb";
  ean: string;
  name: string | null;
  brand: string | null;
  model: string | null;
  color: string | null;
  description: string | null;
  category: string | null;
  images: string[];
  weightGrams: number | null;
  widthCm: number | null;
  heightCm: number | null;
  depthCm: number | null;
};

export class BarcodeError extends Error {}

/** Confere o dígito verificador (EAN-8, UPC-A, EAN-13, GTIN-14). */
export function isValidGtin(code: string) {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** UPC-E (8 dígitos, começa com 0 ou 1) por extenso, como UPC-A. null se não fechar. */
export function upcEToUpcA(code: string) {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const [n, a, b, c, d, e, f, check] = code;
  const body = f <= "2" ? `${a}${b}${f}0000${c}${d}${e}` : f === "3" ? `${a}${b}${c}00000${d}${e}` : f === "4" ? `${a}${b}${c}${d}00000${e}` : `${a}${b}${c}${d}${e}0000${f}`;
  const upcA = `${n}${body}${check}`;
  return isValidGtin(upcA) ? upcA : null;
}

const TIMEOUT = 15_000;
const clean = (s: unknown) => (typeof s === "string" && s.trim() ? s.trim().replace(/\s+/g, " ") : null);
const positive = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null);
// Limites do cadastro (product-schema.ts): peso em gramas inteiras e medidas até 1000 cm.
const grams = (n: unknown) => {
  const g = Math.round(positive(n) ?? 0);
  return g > 0 && g <= 10_000_000 ? g : null;
};
const cm = (n: unknown) => {
  const v = positive(n);
  return v != null && v <= 1000 ? v : null;
};

// Siglas e marcas que ficam em maiúsculas.
const ACRONYMS = new Set("LG JBL HP AOC TCL AKG JVC TP USB HDMI LED LCD OLED QLED HD FHD UHD TV SSD HDD RGB BT FM AM SD NFC GPS PC DVD".split(" "));

/** Título em caixa alta (comum nas bases) vira "Título Normal", mantendo siglas e códigos com números (4K, 20W, 510BT). */
export function tidyTitle(s: string | null) {
  if (!s) return null;
  if (s !== s.toUpperCase()) return s;
  return s
    .split(" ")
    .map((t) => (/\d/.test(t) ? t : t.replace(/[\p{L}\p{M}]+/gu, (w) => (ACRONYMS.has(w) ? w : w[0] + w.slice(1).toLowerCase()))))
    .join(" ");
}

export type OpenFactsProduct = {
  product_name_pt?: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
  product_quantity?: number | string;
  product_quantity_unit?: string;
  image_front_url?: string;
  image_url?: string;
  categories_tags_pt?: string[];
};

/** Produto das bases Open*Facts no formato da loja. Peso só quando vem em g/kg (líquido em ml fica vazio). */
export function fromOpenFacts(code: string, source: BarcodeResult["source"], p: OpenFactsProduct): BarcodeResult | null {
  let name = clean(p.product_name_pt) ?? clean(p.product_name);
  if (!name) return null;
  const qty = clean(p.quantity);
  if (qty && !/\d/.test(name)) name = `${name} ${qty}`;
  const n = Number(p.product_quantity);
  const unit = p.product_quantity_unit?.toLowerCase();
  const image = [p.image_front_url, p.image_url].find((u) => typeof u === "string" && /^https:\/\//.test(u));
  return {
    source,
    ean: code,
    name: tidyTitle(name),
    brand: clean(p.brands?.split(",")[0]),
    model: null,
    color: null,
    description: null,
    category: clean(p.categories_tags_pt?.at(-1)),
    images: image ? [image] : [],
    weightGrams: unit === "g" ? grams(n) : unit === "kg" ? grams(n * 1000) : null,
    widthCm: null,
    heightCm: null,
    depthCm: null,
  };
}

async function openFactsAt(code: string, source: BarcodeResult["source"], host: string): Promise<BarcodeResult | null> {
  const fields = "product_name_pt,product_name,brands,quantity,product_quantity,product_quantity_unit,image_front_url,image_url,categories_tags_pt";
  try {
    const res = await fetch(`https://${host}/api/v2/product/${code}.json?fields=${fields}`, {
      // As bases pedem um User-Agent que identifique o app.
      headers: { Accept: "application/json", "User-Agent": "TirvoLoja/1.0 (+https://github.com/tirvosistemas/loja)" },
      signal: AbortSignal.timeout(TIMEOUT),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { status?: number; product?: OpenFactsProduct };
    return j.status === 1 && j.product ? fromOpenFacts(code, source, j.product) : null;
  } catch {
    return null; // fora do ar: segue para a próxima base
  }
}

/** As quatro bases ao mesmo tempo; vale a primeira da lista que achar. */
async function openFacts(code: string) {
  const found = await Promise.all(OPEN_FACTS.map(([source, host]) => openFactsAt(code, source, host)));
  return found.find(Boolean) ?? null;
}

/** "1.2 lb" / "500 g" / "3 oz" → gramas. */
export function weightToGrams(s: string | null): number | null {
  const m = s?.toLowerCase().replace(",", ".").match(/([\d.]+)\s*(kg|g|lbs?|pounds?|oz|ounces?)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const g = m[2] === "kg" ? n * 1000 : m[2] === "g" ? n : m[2].startsWith("o") ? n * 28.3495 : n * 453.592;
  return Math.round(g);
}

/** "10 X 5 X 2 inches" / "20 x 15 x 4 cm" → cm. */
export function dimensionsToCm(s: string | null): { width: number; height: number; depth: number } | null {
  const m = s?.toLowerCase().replace(/,/g, ".").match(/([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)\s*(in|inch|inches|cm|mm)?/);
  if (!m) return null;
  const k = !m[4] || m[4].startsWith("in") ? 2.54 : m[4] === "mm" ? 0.1 : 1;
  const [a, b, c] = [m[1], m[2], m[3]].map((x) => Math.round(Number(x) * k * 10) / 10);
  return a > 0 && b > 0 && c > 0 ? { width: a, height: b, depth: c } : null;
}

// Plano gratuito da UPCitemdb: 6 consultas por minuto, e passar disso prolonga o bloqueio.
// As consultas vão em fila, uma a cada 10 s (a primeira sai na hora), e as respostas ficam
// guardadas um tempo para não gastar a cota com o mesmo código.
const UPC_GAP = 10_000;
const UPC_CACHE_MAX = 500;
const UPC_CACHE_TTL = 24 * 3600_000;
const DAILY_LIMIT = "Não achei nas bases abertas, e a base internacional (UPCitemdb) atingiu o limite de hoje. Tente amanhã ou preencha à mão.";
let upcQueue: Promise<unknown> = Promise.resolve();
let upcLast = 0;
let upcBlockedUntil = 0; // cota do dia esgotada
const upcCache = new Map<string, { at: number; r: BarcodeResult | null }>();

const sleep = (ms: number) => (ms > 0 ? new Promise((ok) => setTimeout(ok, ms)) : Promise.resolve());

function cached(code: string) {
  const c = upcCache.get(code);
  return c && Date.now() - c.at < UPC_CACHE_TTL ? c : null;
}

/** Uma consulta por vez. */
function upcTurn<T>(fn: () => Promise<T>): Promise<T> {
  const run = upcQueue.then(fn);
  upcQueue = run.catch(() => null);
  return run;
}

async function upcFetch(code: string) {
  await sleep(upcLast + UPC_GAP - Date.now());
  upcLast = Date.now();
  try {
    return await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
  } catch {
    throw new BarcodeError("Não foi possível consultar a base de códigos agora.");
  }
}

async function upcitemdb(code: string): Promise<BarcodeResult | null> {
  const hit = cached(code);
  if (hit) return hit.r;
  return upcTurn(async () => {
    const again = cached(code);
    if (again) return again.r;
    if (Date.now() < upcBlockedUntil) throw new BarcodeError(DAILY_LIMIT);
    let res = await upcFetch(code);
    if (res.status === 429) {
      const limit = ((await res.json().catch(() => null)) as { code?: string } | null)?.code;
      if (limit === "EXCEED_LIMIT") {
        const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000;
        upcBlockedUntil = reset > Date.now() ? Math.min(reset, Date.now() + 24 * 3600_000) : Date.now() + 3600_000;
        throw new BarcodeError(DAILY_LIMIT);
      }
      // Rápido demais: espera e tenta mais uma vez.
      await sleep(Math.min(Math.max(Number(res.headers.get("retry-after")) || 30, 10), 60) * 1000);
      res = await upcFetch(code);
      if (res.status === 429) throw new BarcodeError("Muitas consultas seguidas na base gratuita. Espere um minuto e tente de novo.");
    }
    if (res.status === 404) return remember(code, null);
    if (!res.ok) return null;
    const j = (await res.json()) as {
      items?: { title?: string; brand?: string; model?: string; color?: string; description?: string; category?: string; images?: string[]; weight?: string; dimension?: string }[];
    };
    const it = j.items?.[0];
    if (!it) return remember(code, null);
    const dims = dimensionsToCm(clean(it.dimension));
    return remember(code, {
      source: "UPCitemdb",
      ean: code,
      name: tidyTitle(clean(it.title)),
      brand: clean(it.brand),
      model: clean(it.model),
      color: clean(it.color),
      description: clean(it.description),
      category: clean(it.category),
      images: (it.images ?? []).filter((u) => /^https?:\/\//.test(u)).slice(0, 6),
      weightGrams: grams(weightToGrams(clean(it.weight))),
      widthCm: cm(dims?.width),
      heightCm: cm(dims?.height),
      depthCm: cm(dims?.depth),
    });
  });
}

function remember(code: string, r: BarcodeResult | null) {
  upcCache.delete(code);
  if (upcCache.size >= UPC_CACHE_MAX) upcCache.delete(upcCache.keys().next().value!);
  upcCache.set(code, { at: Date.now(), r });
  return r;
}

/** Procura o código nas bases. null = não encontrado em nenhuma. */
export async function lookupBarcode(raw: string): Promise<BarcodeResult | null> {
  const digits = raw.replace(/\D/g, "");
  // UPC-E que não fecha como EAN-8 é buscado por extenso (UPC-A).
  const code = isValidGtin(digits) ? digits : (upcEToUpcA(digits) ?? digits);
  if (!isValidGtin(code)) throw new BarcodeError("Código de barras inválido. Confira os números (8, 12, 13 ou 14 dígitos).");
  return (await openFacts(code)) ?? (await upcitemdb(code));
}
