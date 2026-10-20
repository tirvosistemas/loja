import { getSettings } from "@/lib/settings";
import { getAiConfig } from "@/lib/ai/client";
import { aiProvider } from "@/lib/ai/providers";
import type { PriceCalcConfig } from "@/lib/price-calc";

// O que o cadastro de produto precisa saber das ferramentas (sem segredos).

export type ProductTools = {
  price: PriceCalcConfig;
  /** Nome do provedor de IA configurado, ou null. */
  aiName: string | null;
  /** Padrão de fotos com alguma regra ligada (quadrado ou marca d'água). */
  photoStandard: boolean;
};

export async function getProductTools(): Promise<ProductTools> {
  const [{ catalog: c }, ai] = await Promise.all([getSettings(), getAiConfig()]);
  return {
    price: {
      feeCardPercent: c.feeCardPercent,
      feePixPercent: c.feePixPercent,
      taxPercent: c.taxPercent,
      packagingCents: c.packagingCents,
      otherCostCents: c.otherCostCents,
      targetMarginPercent: c.targetMarginPercent,
      priceEnding: c.priceEnding,
    },
    aiName: ai ? aiProvider(ai.provider).name : null,
    photoStandard: c.photoSquare || c.watermarkEnabled,
  };
}
