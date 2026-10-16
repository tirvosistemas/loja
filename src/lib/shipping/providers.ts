import type { LatLng } from "./geo";

// Provedores de mapa para achar as coordenadas de um endereço e a distância de carro.
// "osm" é gratuito e não precisa de chave (Nominatim + OSRM). Os outros usam a chave
// cadastrada em Configurações → Integrações.

export type MapsProvider = "osm" | "google" | "openrouteservice" | "mapbox";

export type AddressQuery = {
  street?: string;
  number?: string;
  neighborhood?: string;
  city: string;
  state: string;
  cep?: string;
};

const TIMEOUT = 8000;
const UA = `TirvoLoja/1.0 (${process.env.APP_URL ?? "http://localhost"})`;

function oneLine(a: AddressQuery) {
  const streetPart = [a.street, a.number].filter(Boolean).join(", ");
  return [streetPart, a.neighborhood, `${a.city} - ${a.state}`, a.cep, "Brasil"].filter(Boolean).join(", ");
}

async function getJson(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${new URL(url).host}`);
  return res.json();
}

// ───────── Geocodificação

async function nominatim(a: AddressQuery, near?: LatLng | null): Promise<LatLng | null> {
  const base = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&accept-language=pt-BR";
  const vb = near ? `&viewbox=${near.lng - 0.8},${near.lat + 0.8},${near.lng + 0.8},${near.lat - 0.8}` : "";
  const attempts: string[] = [];
  if (a.street) {
    const street = encodeURIComponent([a.number, a.street].filter(Boolean).join(" "));
    attempts.push(`${base}&street=${street}&city=${encodeURIComponent(a.city)}&state=${encodeURIComponent(a.state)}${vb}`);
    attempts.push(`${base}&q=${encodeURIComponent(oneLine({ ...a, cep: undefined }))}${vb}`);
  }
  if (a.neighborhood) attempts.push(`${base}&q=${encodeURIComponent(`${a.neighborhood}, ${a.city} - ${a.state}, Brasil`)}${vb}`);
  for (const url of attempts) {
    const j = (await getJson(url, { headers: { "User-Agent": UA } })) as Array<{ lat: string; lon: string }>;
    if (j[0]) return { lat: Number(j[0].lat), lng: Number(j[0].lon) };
  }
  return null;
}

async function googleGeocode(a: AddressQuery, key: string, near?: LatLng | null): Promise<LatLng | null> {
  const bounds = near ? `&bounds=${near.lat - 0.8},${near.lng - 0.8}|${near.lat + 0.8},${near.lng + 0.8}` : "";
  const j = (await getJson(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(oneLine(a))}&components=country:BR&region=br&language=pt-BR${bounds}&key=${encodeURIComponent(key)}`,
  )) as { status: string; error_message?: string; results: Array<{ geometry: { location: { lat: number; lng: number } } }> };
  if (j.status === "ZERO_RESULTS") return null;
  if (j.status !== "OK") throw new Error(`Google: ${j.status}${j.error_message ? ` (${j.error_message})` : ""}`);
  return j.results[0]?.geometry.location ?? null;
}

async function orsGeocode(a: AddressQuery, key: string, near?: LatLng | null): Promise<LatLng | null> {
  const focus = near ? `&focus.point.lat=${near.lat}&focus.point.lon=${near.lng}` : "";
  const j = (await getJson(
    `https://api.openrouteservice.org/geocode/search?api_key=${encodeURIComponent(key)}&text=${encodeURIComponent(oneLine(a))}&boundary.country=BR&size=1${focus}`,
  )) as { features: Array<{ geometry: { coordinates: [number, number] } }> };
  const c = j.features[0]?.geometry.coordinates;
  return c ? { lat: c[1], lng: c[0] } : null;
}

async function mapboxGeocode(a: AddressQuery, key: string, near?: LatLng | null): Promise<LatLng | null> {
  const prox = near ? `&proximity=${near.lng},${near.lat}` : "";
  const j = (await getJson(
    `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(oneLine(a))}&country=br&limit=1&language=pt${prox}&access_token=${encodeURIComponent(key)}`,
  )) as { features: Array<{ geometry: { coordinates: [number, number] } }> };
  const c = j.features[0]?.geometry.coordinates;
  return c ? { lat: c[1], lng: c[0] } : null;
}

export async function geocodeWith(provider: MapsProvider, apiKey: string, a: AddressQuery, near?: LatLng | null) {
  if (provider === "google" && apiKey) return googleGeocode(a, apiKey, near);
  if (provider === "openrouteservice" && apiKey) return orsGeocode(a, apiKey, near);
  if (provider === "mapbox" && apiKey) return mapboxGeocode(a, apiKey, near);
  return nominatim(a, near);
}

// ───────── Distância de carro (metros)

async function osrm(from: LatLng, to: LatLng) {
  const base = (process.env.OSRM_URL || "https://router.project-osrm.org").replace(/\/+$/, "");
  const j = (await getJson(`${base}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`, {
    headers: { "User-Agent": UA },
  })) as { code: string; routes?: Array<{ distance: number }> };
  if (j.code !== "Ok" || !j.routes?.[0]) return null;
  return j.routes[0].distance;
}

async function googleRoute(from: LatLng, to: LatLng, key: string) {
  const j = (await getJson("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.distanceMeters" },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
      destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
      travelMode: "DRIVE",
    }),
  })) as { routes?: Array<{ distanceMeters?: number }> };
  return j.routes?.[0]?.distanceMeters ?? null;
}

async function orsRoute(from: LatLng, to: LatLng, key: string) {
  const j = (await getJson("https://api.openrouteservice.org/v2/directions/driving-car", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: key },
    body: JSON.stringify({ coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }),
  })) as { routes?: Array<{ summary?: { distance?: number } }> };
  return j.routes?.[0]?.summary?.distance ?? null;
}

async function mapboxRoute(from: LatLng, to: LatLng, key: string) {
  const j = (await getJson(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false&access_token=${encodeURIComponent(key)}`,
  )) as { routes?: Array<{ distance: number }> };
  return j.routes?.[0]?.distance ?? null;
}

export async function routeMetersWith(provider: MapsProvider, apiKey: string, from: LatLng, to: LatLng) {
  if (provider === "google" && apiKey) return googleRoute(from, to, apiKey);
  if (provider === "openrouteservice" && apiKey) return orsRoute(from, to, apiKey);
  if (provider === "mapbox" && apiKey) return mapboxRoute(from, to, apiKey);
  return osrm(from, to);
}
