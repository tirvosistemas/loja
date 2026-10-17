import { formatBRL, pluralize } from "@/lib/format";
import type { ScopeKey } from "./rules";

// Textos curtos de descontos e escopos, usados nas listas e nos formulários.

export const SCOPE_OPTIONS: { value: ScopeKey; label: string; hint: string }[] = [
  { value: "ALL", label: "Todos os produtos", hint: "Vale para a loja inteira." },
  { value: "CATEGORY", label: "Categorias", hint: "Só produtos das categorias marcadas." },
  { value: "BRAND", label: "Marcas", hint: "Só produtos das marcas marcadas." },
  { value: "PRODUCTS", label: "Produtos", hint: "Só os produtos escolhidos." },
];

/** "15%" ou "R$ 50,00". */
export function discountText(type: "PERCENT" | "FIXED", value: number) {
  return type === "PERCENT" ? `${value}%` : formatBRL(value);
}

/** "Todos os produtos", "3 categorias", "1 marca", "12 produtos". */
export function scopeSummary(scope: ScopeKey, ids: { categoryIds: string[]; brandIds: string[]; productIds: string[] }) {
  switch (scope) {
    case "ALL":
      return "Todos os produtos";
    case "CATEGORY":
      return pluralize(ids.categoryIds.length, "categoria", "categorias");
    case "BRAND":
      return pluralize(ids.brandIds.length, "marca", "marcas");
    case "PRODUCTS":
      return pluralize(ids.productIds.length, "produto", "produtos");
  }
}

/** "15% · máx. R$ 50,00", "R$ 30,00" ou "Frete grátis". */
export function couponValueText(c: { type: "PERCENT" | "FIXED" | "FREE_SHIPPING"; value: number; maxDiscountCents?: number | null }) {
  if (c.type === "FREE_SHIPPING") return "Frete grátis";
  if (c.type === "FIXED") return `${formatBRL(c.value)} de desconto`;
  return `${c.value}% de desconto${c.maxDiscountCents != null ? ` · máx. ${formatBRL(c.maxDiscountCents)}` : ""}`;
}

export const PUSH_TITLE_MAX = 50;
export const PUSH_BODY_MAX = 140;

function clip(text: string, max: number) {
  const chars = [...text];
  return chars.length > max ? `${chars.slice(0, max - 1).join("").trimEnd()}…` : text;
}

/** Texto sugerido para a notificação de uma promoção: "🔥 {nome}" / "{descrição ou Até X% OFF} — aproveite!". */
export function promoNotifyText(p: { name: string; description: string; type: "PERCENT" | "FIXED"; value: number | null }) {
  const title = clip(`🔥 ${p.name.trim() || "Promoção na Tirvo"}`, PUSH_TITLE_MAX);
  const off = p.type === "PERCENT" ? `Até ${p.value ?? 0}% OFF` : `${formatBRL(p.value ?? 0)} OFF`;
  const lead = p.description.trim().replace(/\s+/g, " ") || off;
  const suffix = " — aproveite!";
  const body = `${clip(lead, PUSH_BODY_MAX - suffix.length)}${suffix}`;
  return { title, body };
}
