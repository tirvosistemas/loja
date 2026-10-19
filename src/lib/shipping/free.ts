import { formatBRL } from "../format";

// Frete grátis da loja (Configurações → Frete e entrega): vale para todos os produtos, até uma
// distância da loja e a partir de um valor mínimo de pedido. Sem banco: serve à vitrine, ao
// checkout e ao painel.

export type FreeShippingRule = {
  /** Valor mínimo em produtos. 0 = sem mínimo. */
  minCents: number;
  /** Raio a partir da loja. null = toda a área de entrega. */
  maxKm: number | null;
};

type RuleSettings = {
  enabled?: boolean;
  freeShippingEnabled: boolean;
  freeShippingAboveCents: number | null;
  freeShippingMaxKm: number | null;
};

/** A regra em vigor, ou null quando o frete grátis (ou a entrega) está desligado. */
export function freeShippingRule(cfg: RuleSettings): FreeShippingRule | null {
  if (cfg.enabled === false || !cfg.freeShippingEnabled) return null;
  return { minCents: Math.max(0, cfg.freeShippingAboveCents ?? 0), maxKm: cfg.freeShippingMaxKm };
}

const km = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
/** 2000 → "R$ 20"; 2990 → "R$ 29,90". */
const brl = (cents: number) => formatBRL(cents).replace(/,00$/, "");

/** "até 30 km da loja" ou "em toda a área de entrega". */
export function freeShippingWhere(rule: FreeShippingRule) {
  return rule.maxKm != null ? `até ${km(rule.maxKm)} da loja` : "em toda a área de entrega";
}

/** "pedido mínimo de R$ 20", ou null sem mínimo. */
export function freeShippingMinimum(rule: FreeShippingRule) {
  return rule.minCents > 0 ? `pedido mínimo de ${brl(rule.minCents)}` : null;
}

/** "Frete grátis até 30 km da loja, com pedido mínimo de R$ 20." */
export function freeShippingSentence(rule: FreeShippingRule) {
  const min = freeShippingMinimum(rule);
  return `Frete grátis ${freeShippingWhere(rule)}${min ? `, com ${min}` : ""}.`;
}
