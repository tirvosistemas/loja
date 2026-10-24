// Busca de produto pelo código de barras (EAN/GTIN). Primeiro no Cosmos (Bluesoft), a base
// brasileira, quando há token; senão (ou sem resultado) na UPCitemdb, gratuita e sem chave
// (100 consultas por dia, 6 por minuto). Devolve só o que a base informa; nada é inventado.

export type BarcodeResult = {
  source: "Cosmos" | "UPCitemdb";
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

async function cosmos(code: string, token: string): Promise<BarcodeResult | null> {
  let res: Response;
  try {
    res = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${code}.json`, {
      headers: { "X-Cosmos-Token": token, "User-Agent": "Cosmos-API-Request", "Content-Type": "application/json" },
      signal: AbortSignal.timeout(TIMEOUT),
      cache: "no-store",
    });
  } catch {
    throw new BarcodeError("Não foi possível falar com o Cosmos agora.");
  }
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) throw new BarcodeError("Token do Cosmos recusado. Confira em Configurações → Ferramentas do catálogo.");
  if (res.status === 429) {
    // Conta nova também cai aqui enquanto o Cosmos não libera a API; mostra o que ele disse.
    const said = clean(((await res.json().catch(() => null)) as { message?: unknown } | null)?.message);
    throw new BarcodeError(`O Cosmos recusou a consulta por limite${said ? ` (“${said}”)` : ""}. Confira no site do Cosmos se a conta está confirmada e quantas consultas o seu plano dá por dia.`);
  }
  if (!res.ok) throw new BarcodeError(`O Cosmos respondeu com erro (${res.status}).`);
  const j = (await res.json()) as {
    description?: string;
    thumbnail?: string;
    brand?: { name?: string };
    gross_weight?: number;
    net_weight?: number;
    width?: number;
    height?: number;
    length?: number;
    gpc?: { description?: string };
  };
  return {
    source: "Cosmos",
    ean: code,
    name: tidyTitle(clean(j.description)),
    brand: clean(j.brand?.name),
    model: null,
    color: null,
    description: null,
    category: clean(j.gpc?.description),
    images: j.thumbnail && /^https:\/\//.test(j.thumbnail) ? [j.thumbnail] : [],
    weightGrams: grams(j.gross_weight) ?? grams(j.net_weight),
    widthCm: cm(j.width),
    heightCm: cm(j.height),
    depthCm: cm(j.length),
  };
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
const DAILY_LIMIT = "Limite diário da base gratuita atingido. Cadastre um token do Cosmos para mais consultas.";
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
export async function lookupBarcode(raw: string, cosmosToken: string): Promise<BarcodeResult | null> {
  const digits = raw.replace(/\D/g, "");
  // UPC-E que não fecha como EAN-8 é buscado por extenso (UPC-A).
  const code = isValidGtin(digits) ? digits : (upcEToUpcA(digits) ?? digits);
  if (!isValidGtin(code)) throw new BarcodeError("Código de barras inválido. Confira os números (8, 12, 13 ou 14 dígitos).");
  let cosmosError: unknown = null;
  if (cosmosToken) {
    try {
      const r = await cosmos(code, cosmosToken);
      if (r?.name) return r;
    } catch (e) {
      cosmosError = e;
    }
  }
  const r = await upcitemdb(code).catch((e) => {
    throw cosmosError ?? e;
  });
  if (r) return r;
  if (cosmosError) throw cosmosError;
  return null;
}
