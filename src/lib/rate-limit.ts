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

export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}
