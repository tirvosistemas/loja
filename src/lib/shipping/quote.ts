import { db } from "../db";
import { lookupCep } from "../cep";
import { getSettings, saveSettingsGroup, type Settings, type ShippingSettings } from "../settings";
import { onlyDigits } from "../utils";
import { haversineKm, normalizeCity, type LatLng } from "./geo";
import { geocodeWith, routeMetersWith, type AddressQuery, type MapsProvider } from "./providers";

// Frete por motoboy: sai do endereço da loja (Configurações → Endereço) até o endereço do
// cliente. Preço = taxa de saída + km × preço por km (+ adicional por item), com mínimo,
// arredondamento, raio máximo e frete grátis por valor de pedido.

export type FeeInput = {
  distanceKm: number;
  subtotalCents?: number;
  itemCount?: number;
  freeShippingCoupon?: boolean;
  allItemsFreeShipping?: boolean;
};

export type FeeResult = {
  available: boolean;
  reason?: string;
  feeCents: number;
  originalFeeCents: number;
  free: boolean;
  freeReason?: "threshold" | "coupon" | "product";
  /** Quanto falta no carrinho para ganhar frete grátis (quando aplicável). */
  missingForFreeCents?: number;
};

/** Cálculo puro do valor (testável). */
export function computeShippingFee(cfg: ShippingSettings, input: FeeInput): FeeResult {
  const km = Math.max(0, Math.round(input.distanceKm * 10) / 10);
  if (cfg.maxDistanceKm > 0 && km > cfg.maxDistanceKm) {
    return {
      available: false,
      reason: `Entregamos até ${cfg.maxDistanceKm.toLocaleString("pt-BR")} km da loja. Seu endereço fica a ${km.toLocaleString("pt-BR")} km.`,
      feeCents: 0,
      originalFeeCents: 0,
      free: false,
    };
  }
  const items = Math.max(1, input.itemCount ?? 1);
  let fee = cfg.baseFeeCents + Math.round(km * cfg.pricePerKmCents) + cfg.extraPerItemCents * (items - 1);
  fee = Math.max(fee, cfg.minFeeCents);
  if (cfg.roundToCents > 1) fee = Math.ceil(fee / cfg.roundToCents) * cfg.roundToCents;

  const subtotal = input.subtotalCents ?? 0;
  const withinFreeRadius = cfg.freeShippingMaxKm == null || km <= cfg.freeShippingMaxKm;
  let freeReason: FeeResult["freeReason"];
  if (input.freeShippingCoupon) freeReason = "coupon";
  else if (input.allItemsFreeShipping) freeReason = "product";
  else if (cfg.freeShippingAboveCents != null && subtotal >= cfg.freeShippingAboveCents && withinFreeRadius) freeReason = "threshold";

  const missing =
    !freeReason && cfg.freeShippingAboveCents != null && withinFreeRadius && subtotal < cfg.freeShippingAboveCents
      ? cfg.freeShippingAboveCents - subtotal
      : undefined;

  return {
    available: true,
    feeCents: freeReason ? 0 : fee,
    originalFeeCents: fee,
    free: !!freeReason,
    freeReason,
    missingForFreeCents: missing,
  };
}

export function cityIsAllowed(cfg: ShippingSettings, city: string) {
  if (!cfg.restrictToAllowedCities) return true;
  const c = normalizeCity(city);
  return cfg.allowedCities.some((a) => normalizeCity(a) === c);
}

// ───────── Coordenadas e distância com cache

async function cachedGeocode(provider: MapsProvider, apiKey: string, a: AddressQuery, near: LatLng | null) {
  const norm = [a.street, a.number, a.neighborhood, a.city, a.state].map((s) => normalizeCity(s ?? "")).join("|");
  const key = `geo:${provider}:${norm}`.slice(0, 191);
  const hit = await db.geoCache.findUnique({ where: { key } }).catch(() => null);
  if (hit?.lat != null && hit.lng != null) return { lat: hit.lat, lng: hit.lng };
  let point: LatLng | null = null;
  try {
    point = await geocodeWith(provider, apiKey, a, near);
  } catch (e) {
    console.warn("[frete] geocodificação falhou:", (e as Error).message);
    if (provider !== "osm") point = await geocodeWith("osm", "", a, near).catch(() => null);
  }
  if (point) {
    await db.geoCache
      .upsert({ where: { key }, create: { key, lat: point.lat, lng: point.lng }, update: { lat: point.lat, lng: point.lng } })
      .catch(() => null);
  }
  return point;
}

async function cachedRouteKm(provider: MapsProvider, apiKey: string, from: LatLng, to: LatLng) {
  const r = (n: number) => n.toFixed(4);
  const key = `route:${provider}:${r(from.lat)},${r(from.lng)}:${r(to.lat)},${r(to.lng)}`;
  const hit = await db.geoCache.findUnique({ where: { key } }).catch(() => null);
  if (hit?.meters != null) return hit.meters / 1000;
  let meters: number | null = null;
  try {
    meters = await routeMetersWith(provider, apiKey, from, to);
  } catch (e) {
    console.warn("[frete] rota falhou:", (e as Error).message);
    if (provider !== "osm") meters = await routeMetersWith("osm", "", from, to).catch(() => null);
  }
  if (meters == null) return null;
  await db.geoCache.upsert({ where: { key }, create: { key, meters }, update: { meters } }).catch(() => null);
  return meters / 1000;
}

/** Coordenadas da loja. Se ainda não existirem, localiza pelo endereço e salva. */
export async function getStoreOrigin(settings?: Settings): Promise<LatLng | null> {
  const s = settings ?? (await getSettings());
  const a = s.address;
  if (a.lat != null && a.lng != null) return { lat: a.lat, lng: a.lng };
  if (!a.city) return null;
  const point = await locateStoreAddress(s);
  return point;
}

/** Localiza o endereço da loja e grava lat/lng nas configurações. Usado pelo painel. */
export async function locateStoreAddress(settings?: Settings): Promise<LatLng | null> {
  const s = settings ?? (await getSettings());
  const a = s.address;
  let point = await cachedGeocode(
    s.integrations.mapsProvider,
    s.integrations.mapsApiKey,
    { street: a.street, number: a.number, neighborhood: a.neighborhood, city: a.city, state: a.state, cep: a.cep },
    null,
  );
  if (!point && a.cep) {
    const info = await lookupCep(a.cep);
    if (info?.lat != null && info.lng != null) point = { lat: info.lat, lng: info.lng };
  }
  if (point) await saveSettingsGroup("address", { lat: point.lat, lng: point.lng });
  return point;
}

// ───────── Cotação completa

export type ShippingQuoteInput = {
  cep: string;
  number?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  subtotalCents?: number;
  itemCount?: number;
  freeShippingCoupon?: boolean;
  allItemsFreeShipping?: boolean;
};

export type ShippingQuote = FeeResult & {
  ok: boolean;
  distanceKm: number;
  method: "route" | "straight";
  etaText: string;
  address: { cep: string; street: string; number: string; neighborhood: string; city: string; state: string };
  destination: LatLng | null;
};

function fail(reason: string, partial: Partial<ShippingQuote> = {}): ShippingQuote {
  return {
    ok: false,
    available: false,
    reason,
    feeCents: 0,
    originalFeeCents: 0,
    free: false,
    distanceKm: 0,
    method: "straight",
    etaText: "",
    address: { cep: "", street: "", number: "", neighborhood: "", city: "", state: "" },
    destination: null,
    ...partial,
  };
}

export async function quoteShipping(input: ShippingQuoteInput, settings?: Settings): Promise<ShippingQuote> {
  const s = settings ?? (await getSettings());
  const cfg = s.shipping;
  if (!cfg.enabled) return fail("A entrega está desativada no momento. Escolha retirar na loja.");

  const cep = onlyDigits(input.cep);
  if (cep.length !== 8) return fail("Informe um CEP válido com 8 números.");
  const info = await lookupCep(cep);
  if (!info && !input.city) return fail("Não encontramos esse CEP. Confira os números.");

  const address = {
    cep,
    street: (input.street || info?.street || "").trim(),
    number: (input.number || "").trim(),
    neighborhood: (input.neighborhood || info?.neighborhood || "").trim(),
    city: (input.city || info?.city || "").trim(),
    state: (input.state || info?.state || "PR").trim().toUpperCase(),
  };

  if (!cityIsAllowed(cfg, address.city)) {
    return fail(`Ainda não entregamos em ${address.city || "sua cidade"}. Atendemos Curitiba e região metropolitana.`, { address });
  }

  const origin = await getStoreOrigin(s);
  if (!origin) return fail("A loja ainda não cadastrou o endereço de saída das entregas.", { address });

  let dest = await cachedGeocode(s.integrations.mapsProvider, s.integrations.mapsApiKey, address, origin);
  if (!dest && info?.lat != null && info.lng != null) dest = { lat: info.lat, lng: info.lng };
  if (!dest) return fail("Não conseguimos localizar esse endereço no mapa. Confira rua e número.", { address });

  const straight = haversineKm(origin, dest);
  let km = straight * cfg.straightLineFactor;
  let method: ShippingQuote["method"] = "straight";
  if (cfg.distanceMode === "route") {
    const routeKm = await cachedRouteKm(s.integrations.mapsProvider, s.integrations.mapsApiKey, origin, dest);
    // Rota absurda (erro de geocodificação) cai para a linha reta.
    if (routeKm != null && routeKm < straight * 4 + 2) {
      km = routeKm;
      method = "route";
    }
  }

  const fee = computeShippingFee(cfg, {
    distanceKm: km,
    subtotalCents: input.subtotalCents,
    itemCount: input.itemCount,
    freeShippingCoupon: input.freeShippingCoupon,
    allItemsFreeShipping: input.allItemsFreeShipping,
  });

  return {
    ok: true,
    ...fee,
    distanceKm: Math.round(km * 10) / 10,
    method,
    etaText: cfg.etaText,
    address,
    destination: dest,
  };
}
