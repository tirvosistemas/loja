// Limite simples por janela de tempo, em memória (um servidor só, como na VM da Oracle).

const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  b.count++;
  return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), retryAfterMs: b.reset - now };
}

/**
 * IP do cliente. X-Real-IP vem primeiro porque o Caddy sempre o sobrescreve com o IP real;
 * um cabeçalho que o próprio visitante inventa (ex.: CF-Connecting-IP) não pode furar o limite.
 */
export function clientIp(headers: Headers): string {
  const ip =
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("cf-connecting-ip")?.trim() ||
    "local";
  return ip.slice(0, 64);
}
