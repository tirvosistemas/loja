// Calculadora de preço de venda. Arquivo puro: usado no cadastro, na edição em massa e nas
// Configurações. Taxas e imposto incidem sobre o preço; embalagem e outros custos são fixos.
//   preço = (custo + embalagem + outros) ÷ (1 − taxa − imposto − margem)

export type PriceCalcConfig = {
  feeCardPercent: number;
  feePixPercent: number;
  taxPercent: number;
  packagingCents: number;
  otherCostCents: number;
  targetMarginPercent: number;
  priceEnding: "90" | "99" | "00" | "none";
};

export type PayKind = "card" | "pix";

/** Arredonda para cima até o final escolhido (R$ 47,23 → R$ 47,90). */
export function applyEnding(cents: number, ending: PriceCalcConfig["priceEnding"]): number {
  if (ending === "none") return Math.ceil(cents);
  if (ending === "00") return Math.ceil(cents / 100) * 100;
  const end = Number(ending);
  const reais = Math.floor(cents / 100);
  const candidate = reais * 100 + end;
  return candidate >= cents ? candidate : candidate + 100;
}

// Tira o ruído do ponto flutuante (1890,0000000000002 → 1890) antes de arredondar para cima.
const snap = (cents: number) => Math.round(cents * 1e6) / 1e6;

/** Preço sugerido para chegar à margem desejada (sobre o preço), pagando com cartão. null = impossível. */
export function suggestPrice(costCents: number, cfg: PriceCalcConfig, marginPercent = cfg.targetMarginPercent, kind: PayKind = "card"): number | null {
  const fee = kind === "card" ? cfg.feeCardPercent : cfg.feePixPercent;
  const rate = (fee + cfg.taxPercent + marginPercent) / 100;
  if (rate >= 0.95) return null;
  const fixed = costCents + cfg.packagingCents + cfg.otherCostCents;
  if (fixed <= 0) return null;
  return applyEnding(snap(fixed / (1 - rate)), cfg.priceEnding);
}

export type PriceBreakdown = {
  priceCents: number;
  feeCents: number;
  taxCents: number;
  fixedCents: number; // custo + embalagem + outros
  profitCents: number;
  marginPercent: number; // lucro ÷ preço
};

/** Quanto sobra de verdade de uma venda, depois de taxa, imposto e custos. */
export function priceBreakdown(priceCents: number, costCents: number, cfg: PriceCalcConfig, kind: PayKind = "card"): PriceBreakdown {
  const fee = kind === "card" ? cfg.feeCardPercent : cfg.feePixPercent;
  const feeCents = Math.round((priceCents * fee) / 100);
  const taxCents = Math.round((priceCents * cfg.taxPercent) / 100);
  const fixedCents = costCents + cfg.packagingCents + cfg.otherCostCents;
  const profitCents = priceCents - feeCents - taxCents - fixedCents;
  return { priceCents, feeCents, taxCents, fixedCents, profitCents, marginPercent: priceCents > 0 ? Math.round((profitCents / priceCents) * 1000) / 10 : 0 };
}

/** Reajuste em porcentagem (ex.: +10 ou −5), com o final escolhido. */
export function adjustPrice(cents: number, percent: number, ending: PriceCalcConfig["priceEnding"]): number {
  const raw = snap((cents * (100 + percent)) / 100);
  if (ending === "none") return Math.max(1, Math.round(raw));
  // Reduções arredondam para o final mais próximo abaixo, para não subir o preço.
  if (percent < 0) {
    const up = applyEnding(raw, ending);
    const down = up - 100;
    return Math.max(1, down >= 1 && up > raw ? down : up);
  }
  return applyEnding(raw, ending);
}
