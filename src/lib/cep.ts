import { db } from "./db";
import { onlyDigits } from "./utils";

export type CepInfo = {
  cep: string; // só dígitos
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
};

const TIMEOUT = 6000;

async function viaCep(cep: string): Promise<CepInfo | null> {
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
  if (!res.ok) return null;
  const j = (await res.json()) as Record<string, string | boolean>;
  if (j.erro) return null;
  return {
    cep,
    street: String(j.logradouro ?? ""),
    neighborhood: String(j.bairro ?? ""),
    city: String(j.localidade ?? ""),
    state: String(j.uf ?? ""),
    lat: null,
    lng: null,
  };
}

async function brasilApi(cep: string): Promise<CepInfo | null> {
  const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, { signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
  if (!res.ok) return null;
  const j = (await res.json()) as {
    street?: string; neighborhood?: string; city?: string; state?: string;
    location?: { coordinates?: { latitude?: string; longitude?: string } };
  };
  const lat = Number(j.location?.coordinates?.latitude);
  const lng = Number(j.location?.coordinates?.longitude);
  return {
    cep,
    street: j.street ?? "",
    neighborhood: j.neighborhood ?? "",
    city: j.city ?? "",
    state: j.state ?? "",
    lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
    lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
  };
}

/** Busca o endereço de um CEP (ViaCEP, com BrasilAPI como reserva). Resultado fica em cache. */
export async function lookupCep(raw: string): Promise<CepInfo | null> {
  const cep = onlyDigits(raw);
  if (cep.length !== 8) return null;
  const key = `cep:${cep}`;
  const cached = await db.geoCache.findUnique({ where: { key } }).catch(() => null);
  if (cached?.label) {
    try {
      return JSON.parse(cached.label) as CepInfo;
    } catch {}
  }
  let info: CepInfo | null = null;
  try {
    info = await viaCep(cep);
  } catch {}
  try {
    const b = await brasilApi(cep);
    if (b) info = info ? { ...info, lat: b.lat, lng: b.lng, street: info.street || b.street, neighborhood: info.neighborhood || b.neighborhood } : b;
  } catch {}
  if (info) {
    const label = JSON.stringify(info).slice(0, 400);
    await db.geoCache
      .upsert({ where: { key }, create: { key, label, lat: info.lat, lng: info.lng }, update: { label, lat: info.lat, lng: info.lng } })
      .catch(() => null);
  }
  return info;
}
