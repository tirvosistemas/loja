// Detalhamento do frete para o painel (simulador e tabela de referência).
// Segue exatamente a conta de computeShippingFee (src/lib/shipping/quote.ts), mas sem
// importar aquele módulo, que depende do banco e não pode ir para o navegador.

export type FeeConfig = {
  pricePerKmCents: number;
  baseFeeCents: number;
  minFeeCents: number;
  extraPerItemCents: number;
  maxDistanceKm: number;
  freeShippingAboveCents: number | null;
  freeShippingMaxKm: number | null;
  roundToCents: number;
};

export type FeeBreakdown = {
  km: number;
  available: boolean;
  baseCents: number;
  kmCents: number;
  extraItems: number;
  extraCents: number;
  rawCents: number;
  minApplied: boolean;
  afterMinCents: number;
  roundedCents: number;
  roundingApplied: boolean;
  /** Frete grátis por valor do pedido (limite e raio). */
  freeByThreshold: boolean;
  /** Grátis bloqueado só porque passou do raio do frete grátis. */
  outsideFreeRadius: boolean;
  finalCents: number;
};

export function feeBreakdown(cfg: FeeConfig, input: { distanceKm: number; itemCount?: number; subtotalCents?: number }): FeeBreakdown {
  const km = Math.max(0, Math.round(input.distanceKm * 10) / 10);
  const available = !(cfg.maxDistanceKm > 0 && km > cfg.maxDistanceKm);
  const items = Math.max(1, input.itemCount ?? 1);
  const baseCents = cfg.baseFeeCents;
  const kmCents = Math.round(km * cfg.pricePerKmCents);
  const extraItems = items - 1;
  const extraCents = cfg.extraPerItemCents * extraItems;
  const rawCents = baseCents + kmCents + extraCents;
  const afterMinCents = Math.max(rawCents, cfg.minFeeCents);
  const roundedCents = cfg.roundToCents > 1 ? Math.ceil(afterMinCents / cfg.roundToCents) * cfg.roundToCents : afterMinCents;
  const subtotal = input.subtotalCents ?? 0;
  const withinFreeRadius = cfg.freeShippingMaxKm == null || km <= cfg.freeShippingMaxKm;
  const reachesThreshold = cfg.freeShippingAboveCents != null && subtotal >= cfg.freeShippingAboveCents;
  const freeByThreshold = available && reachesThreshold && withinFreeRadius;
  return {
    km,
    available,
    baseCents,
    kmCents,
    extraItems,
    extraCents,
    rawCents,
    minApplied: afterMinCents > rawCents,
    afterMinCents,
    roundedCents,
    roundingApplied: roundedCents !== afterMinCents,
    freeByThreshold,
    outsideFreeRadius: available && reachesThreshold && !withinFreeRadius,
    finalCents: !available ? 0 : freeByThreshold ? 0 : roundedCents,
  };
}
