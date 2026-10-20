// Busca de produto pelo código de barras (EAN/GTIN). Primeiro no Cosmos (Bluesoft), a base
// brasileira, quando há token; senão (ou sem resultado) na UPCitemdb, gratuita e sem chave
// (100 consultas por dia). Devolve só o que a base informa; nada é inventado.

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

const TIMEOUT = 15_000;
const clean = (s: unknown) => (typeof s === "string" && s.trim() ? s.trim().replace(/\s+/g, " ") : null);
const positive = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null);

/** Título em caixa alta (comum nas bases) vira "Título Normal", mantendo siglas curtas. */
export function tidyTitle(s: string | null) {
  if (!s) return null;
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/(^|[\s/(-])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase())
    .replace(/\b(Usb|Led|Hdmi|Rgb|Lcd|Tv|Bt|Ps\d|Xbox|Fm|Am|Sd|Ssd|Hd)\b/g, (m) => m.toUpperCase());
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
  if (res.status === 429) throw new BarcodeError("Limite diário de consultas do Cosmos atingido.");
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
    brand: tidyTitle(clean(j.brand?.name)),
    model: null,
    color: null,
    description: null,
    category: clean(j.gpc?.description),
    images: j.thumbnail && /^https:\/\//.test(j.thumbnail) ? [j.thumbnail] : [],
    weightGrams: positive(j.gross_weight) ?? positive(j.net_weight),
    widthCm: positive(j.width),
    heightCm: positive(j.height),
    depthCm: positive(j.length),
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

async function upcitemdb(code: string): Promise<BarcodeResult | null> {
  let res: Response;
  try {
    res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
  } catch {
    throw new BarcodeError("Não foi possível consultar a base de códigos agora.");
  }
  if (res.status === 404) return null;
  if (res.status === 429) throw new BarcodeError("Limite diário da base gratuita atingido. Cadastre um token do Cosmos para mais consultas.");
  if (!res.ok) return null;
  const j = (await res.json()) as {
    items?: { title?: string; brand?: string; model?: string; color?: string; description?: string; category?: string; images?: string[]; weight?: string; dimension?: string }[];
  };
  const it = j.items?.[0];
  if (!it) return null;
  const dims = dimensionsToCm(clean(it.dimension));
  return {
    source: "UPCitemdb",
    ean: code,
    name: tidyTitle(clean(it.title)),
    brand: tidyTitle(clean(it.brand)),
    model: clean(it.model),
    color: clean(it.color),
    description: clean(it.description),
    category: clean(it.category),
    images: (it.images ?? []).filter((u) => /^https?:\/\//.test(u)).slice(0, 6),
    weightGrams: weightToGrams(clean(it.weight)),
    widthCm: dims?.width ?? null,
    heightCm: dims?.height ?? null,
    depthCm: dims?.depth ?? null,
  };
}

/** Procura o código nas bases. null = não encontrado em nenhuma. */
export async function lookupBarcode(raw: string, cosmosToken: string): Promise<BarcodeResult | null> {
  const code = raw.replace(/\D/g, "");
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
