import type { ZodError } from "zod";

// Formato padrão de retorno das server actions do painel.
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function fromZod(error: ZodError, message = "Confira os campos destacados."): ActionResult<never> {
  return { ok: false, error: message, fieldErrors: zodFieldErrors(error) };
}

/** Erro do Prisma de valor único repetido (ex.: slug ou SKU já usado). */
export function isUniqueError(e: unknown, field?: string) {
  const err = e as { code?: string; meta?: { target?: string[] | string } };
  if (err?.code !== "P2002") return false;
  if (!field) return true;
  const t = err.meta?.target;
  return Array.isArray(t) ? t.some((x) => x.includes(field)) : String(t ?? "").includes(field);
}
