import type { ProductAiFill } from "@/lib/ai/product";
import type { ImportDraft } from "./build";

// Junta o preenchimento da IA (src/lib/ai/product.ts) no rascunho do importador.
// Nunca mexe em preço nem estoque; o que o dono escreveu prevalece.

export type AiFill = ProductAiFill;

/** Junta a resposta da IA no rascunho, só nos campos vazios. */
export function mergeAi(d: ImportDraft, ai: AiFill, nameFromFolder: boolean): ImportDraft {
  const clip = (s: string | null, n: number) => (s ? s.trim().slice(0, n) || null : null);
  const pos = (n: number | null, max: number) => (n != null && n > 0 && n <= max ? n : null);
  const ean = ai.ean?.replace(/\D/g, "") ?? "";
  return {
    ...d,
    name: nameFromFolder && ai.name && ai.name.trim().length >= 2 ? ai.name.trim().slice(0, 160) : d.name,
    brand: d.brand ?? clip(ai.brand, 80),
    model: d.model ?? clip(ai.model, 80),
    color: d.color ?? clip(ai.color, 60),
    category: d.category ?? clip(ai.category, 120),
    shortDescription: d.shortDescription ?? clip(ai.shortDescription, 500),
    description: d.description ?? clip(ai.description, 20000),
    specs: d.specs.length ? d.specs : ai.specs.filter((s) => s.label.trim() && s.value.trim()).map((s) => ({ label: s.label.trim().slice(0, 60), value: s.value.trim().slice(0, 300) })).slice(0, 60),
    voltage: d.voltage ?? ai.voltage,
    warrantyMonths: d.warrantyMonths ?? pos(ai.warrantyMonths, 240),
    weightGrams: d.weightGrams ?? pos(ai.weightGrams, 10_000_000),
    widthCm: d.widthCm ?? pos(ai.widthCm, 1000),
    heightCm: d.heightCm ?? pos(ai.heightCm, 1000),
    depthCm: d.depthCm ?? pos(ai.depthCm, 1000),
    ean: d.ean ?? (ean.length >= 8 && ean.length <= 14 ? ean : null),
    tags: d.tags.length ? d.tags : ai.tags.map((t) => t.trim().slice(0, 40)).filter(Boolean).slice(0, 8),
    metaTitle: d.metaTitle ?? clip(ai.metaTitle, 120),
    metaDescription: d.metaDescription ?? clip(ai.metaDescription, 320),
  };
}
