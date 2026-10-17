import { db } from "./db";
import { effectivePrice, getActivePromotions } from "./pricing";

// Reprecifica o carrinho no servidor a partir do banco. O navegador guarda só ids e
// quantidades; preços, estoque e disponibilidade sempre vêm daqui.

export type CartInputItem = { productId: string; variantId?: string | null; quantity: number };

export type PricedLine = {
  key: string; // productId:variantId
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantName: string | null;
  sku: string | null;
  image: string | null;
  categoryId: string | null;
  brandId: string | null;
  unitPriceCents: number;
  originalUnitPriceCents: number; // antes da promoção
  compareAtCents: number | null;
  quantity: number; // já limitada ao estoque
  requestedQuantity: number;
  maxQuantity: number;
  totalCents: number;
  available: boolean;
  promoted: boolean;
  promotionName: string | null;
  freeShipping: boolean;
  issue: string | null; // aviso para o cliente (sem estoque, quantidade ajustada…)
};

export type PricedCart = {
  lines: PricedLine[]; // só itens disponíveis
  unavailable: PricedLine[];
  subtotalCents: number;
  itemCount: number;
  allFreeShipping: boolean;
  issues: string[];
};

export const MAX_PER_LINE = 20;

export function lineKey(productId: string, variantId?: string | null) {
  return `${productId}:${variantId ?? ""}`;
}

export async function priceCart(items: CartInputItem[]): Promise<PricedCart> {
  const merged = new Map<string, CartInputItem>();
  for (const it of items.slice(0, 100)) {
    if (!it?.productId) continue;
    const q = Math.floor(Number(it.quantity) || 0);
    if (q <= 0) continue;
    const k = lineKey(it.productId, it.variantId);
    const prev = merged.get(k);
    merged.set(k, { productId: it.productId, variantId: it.variantId ?? null, quantity: (prev?.quantity ?? 0) + q });
  }
  const list = [...merged.values()];
  if (list.length === 0) return { lines: [], unavailable: [], subtotalCents: 0, itemCount: 0, allFreeShipping: false, issues: [] };

  const [products, promos] = await Promise.all([
    db.product.findMany({
      where: { id: { in: [...new Set(list.map((i) => i.productId))] } },
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      },
    }),
    getActivePromotions(),
  ]);
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines: PricedLine[] = [];
  const unavailable: PricedLine[] = [];
  const issues: string[] = [];

  for (const it of list) {
    const p = byId.get(it.productId);
    const base = {
      key: lineKey(it.productId, it.variantId),
      productId: it.productId,
      variantId: it.variantId ?? null,
      requestedQuantity: it.quantity,
    };
    if (!p || p.status !== "ACTIVE") {
      const line: PricedLine = {
        ...base, slug: p?.slug ?? "", name: p?.name ?? "Produto indisponível", variantName: null, sku: null, image: null,
        categoryId: null, brandId: null, unitPriceCents: 0, originalUnitPriceCents: 0, compareAtCents: null, quantity: 0,
        maxQuantity: 0, totalCents: 0, available: false, promoted: false, promotionName: null, freeShipping: false,
        issue: "Este produto não está mais disponível.",
      };
      unavailable.push(line);
      issues.push(`${line.name}: não está mais disponível.`);
      continue;
    }
    let variant = null as (typeof p.variants)[number] | null;
    if (p.variants.length > 0) {
      variant = p.variants.find((v) => v.id === it.variantId) ?? null;
      if (!variant) {
        const line: PricedLine = {
          ...base, slug: p.slug, name: p.name, variantName: null, sku: p.sku, image: p.images[0]?.url ?? null,
          categoryId: p.categoryId, brandId: p.brandId, unitPriceCents: 0, originalUnitPriceCents: 0, compareAtCents: null,
          quantity: 0, maxQuantity: 0, totalCents: 0, available: false, promoted: false, promotionName: null,
          freeShipping: p.freeShipping, issue: `Escolha ${p.variantLabel?.toLowerCase() || "uma opção"} deste produto.`,
        };
        unavailable.push(line);
        issues.push(`${p.name}: ${line.issue}`);
        continue;
      }
    }
    const stock = variant ? variant.stock : p.stock;
    const limitedByStock = p.trackStock && !p.allowBackorder;
    const maxQuantity = limitedByStock ? Math.max(0, Math.min(stock, MAX_PER_LINE)) : MAX_PER_LINE;
    const price = effectivePrice(p, variant, promos);
    const quantity = Math.min(it.quantity, maxQuantity);
    let issue: string | null = null;
    if (maxQuantity === 0) issue = "Sem estoque no momento.";
    else if (quantity < it.quantity)
      issue =
        limitedByStock && stock < MAX_PER_LINE
          ? `Só temos ${maxQuantity} ${maxQuantity === 1 ? "unidade" : "unidades"} em estoque.`
          : `Limite de ${MAX_PER_LINE} unidades por item em cada pedido.`;

    const line: PricedLine = {
      ...base,
      // Variação enviada para um produto que não tem (mais) variações: vale o produto.
      variantId: variant?.id ?? null,
      slug: p.slug,
      name: p.name,
      variantName: variant?.name ?? null,
      sku: variant?.sku ?? p.sku,
      image: p.images[0]?.url ?? null,
      categoryId: p.categoryId,
      brandId: p.brandId,
      unitPriceCents: price.priceCents,
      originalUnitPriceCents: price.basePriceCents,
      compareAtCents: price.compareAtCents,
      quantity,
      maxQuantity,
      totalCents: price.priceCents * quantity,
      available: quantity > 0,
      promoted: !!price.promotion,
      promotionName: price.promotion?.name ?? null,
      freeShipping: p.freeShipping,
      issue,
    };
    if (line.available) lines.push(line);
    else unavailable.push(line);
    if (issue) issues.push(`${p.name}${variant ? ` (${variant.name})` : ""}: ${issue}`);
  }

  return {
    lines,
    unavailable,
    subtotalCents: lines.reduce((s, l) => s + l.totalCents, 0),
    itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    allFreeShipping: lines.length > 0 && lines.every((l) => l.freeShipping),
    issues,
  };
}
