import { z } from "zod";

// Peças de validação comuns às ações de marketing (banners, promoções, cupons e notificações).

/** Link interno ("/ofertas") ou externo ("https://…"). Vazio vira null. */
export const hrefSchema = z
  .string()
  .trim()
  .max(500, "Link muito longo.")
  .refine((v) => v === "" || (/^\/(?!\/)/.test(v) && !/\s/.test(v)) || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v), {
    message: "Use um caminho da loja (ex.: /ofertas) ou um endereço completo (https://…).",
  })
  .transform((v) => (v === "" ? null : v));

/** Chave de imagem enviada pelo painel (/uploads/…) ou endereço de imagem. */
export const imageKeySchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^\/(?!\/)/.test(v) || /^https:\/\//i.test(v), { message: "Imagem inválida. Envie a imagem de novo." });

/** Data em ISO (ou vazio → null). */
export const optionalDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v == null || v.trim() === "") return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Data inválida." });
      return z.NEVER;
    }
    return d;
  });

/** Lista de ids (strings curtas, sem repetição). */
export const idList = z
  .array(z.string().trim().min(1).max(40))
  .max(1000, "Seleção grande demais.")
  .default([])
  .transform((ids) => Array.from(new Set(ids)));

export const entityId = z.string().trim().min(1).max(40);

/** Fim depois do início (aplicar com superRefine). */
export function checkPeriod(v: { startsAt: Date | null; endsAt: Date | null }, ctx: z.RefinementCtx) {
  if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt) {
    ctx.addIssue({ code: "custom", path: ["endsAt"], message: "O fim precisa ser depois do início." });
  }
}

export const scopeSchema = z.enum(["ALL", "CATEGORY", "BRAND", "PRODUCTS"]);
export type ScopeKey = z.infer<typeof scopeSchema>;

/** Confere se o escopo escolhido tem itens. */
export function checkScope(v: { scope: ScopeKey; categoryIds: string[]; brandIds: string[]; productIds: string[] }, ctx: z.RefinementCtx) {
  if (v.scope === "CATEGORY" && !v.categoryIds.length) ctx.addIssue({ code: "custom", path: ["categoryIds"], message: "Escolha pelo menos uma categoria." });
  if (v.scope === "BRAND" && !v.brandIds.length) ctx.addIssue({ code: "custom", path: ["brandIds"], message: "Escolha pelo menos uma marca." });
  if (v.scope === "PRODUCTS" && !v.productIds.length) ctx.addIssue({ code: "custom", path: ["productIds"], message: "Escolha pelo menos um produto." });
}

/** Texto com limite contado em caracteres visíveis (emoji conta como 1). */
export function textMax(max: number, message = `Use até ${max} caracteres.`) {
  return z
    .string()
    .trim()
    .refine((s) => [...s].length <= max, { message });
}
