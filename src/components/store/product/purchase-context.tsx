"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import type { ProductDetailDTO, VariantDTO } from "@/lib/catalog";
import { installmentText } from "@/lib/format";
import { useCart } from "@/stores/cart";

// Estado da compra na página do produto (variação, quantidade e "adicionar"),
// compartilhado entre a caixa de compra, a barra fixa do celular, a galeria e o frete.

export type PayConfig = { pixDiscountPercent: number; installmentsMax: number; installmentsMinCents: number };

type PriceView = {
  priceCents: number;
  compareAtCents: number | null;
  discountPercent: number;
  pixPriceCents: number;
  installments: { count: number; valueCents: number } | null;
  fromPrice: boolean;
};

type Ctx = {
  product: ProductDetailDTO;
  pay: PayConfig;
  variant: VariantDTO | null;
  selectVariant: (id: string) => void;
  needsVariant: boolean;
  variantError: boolean;
  quantity: number;
  setQuantity: (n: number) => void;
  maxQuantity: number;
  available: boolean;
  price: PriceView;
  pickerRef: RefObject<HTMLDivElement | null>;
  addToCart: (opts?: { buyNow?: boolean }) => boolean;
};

const PurchaseCtx = createContext<Ctx | null>(null);

export function usePurchase() {
  const ctx = useContext(PurchaseCtx);
  if (!ctx) throw new Error("usePurchase precisa do PurchaseProvider");
  return ctx;
}

export function PurchaseProvider({ product, pay, children }: { product: ProductDetailDTO; pay: PayConfig; children: ReactNode }) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const openDrawer = useCart((s) => s.openDrawer);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  // Com uma única variação, ela já vem escolhida.
  const [variantId, setVariantId] = useState<string | null>(product.variants.length === 1 ? product.variants[0].id : null);
  const [quantity, setQty] = useState(1);
  const [variantError, setVariantError] = useState(false);

  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const hasVariants = product.variants.length > 0;
  const needsVariant = hasVariants && !variant;
  const maxQuantity = variant ? variant.maxQuantity : hasVariants ? 0 : product.maxQuantity;
  const available = needsVariant ? product.inStock : maxQuantity > 0;

  const price = useMemo<PriceView>(() => {
    if (variant)
      return {
        priceCents: variant.priceCents,
        compareAtCents: variant.compareAtCents,
        discountPercent: variant.discountPercent,
        pixPriceCents: variant.pixPriceCents,
        installments: installmentText(variant.priceCents, pay.installmentsMax, pay.installmentsMinCents),
        fromPrice: false,
      };
    return {
      priceCents: product.priceCents,
      compareAtCents: product.compareAtCents,
      discountPercent: product.discountPercent,
      pixPriceCents: product.pixPriceCents,
      installments: product.installments,
      fromPrice: product.fromPrice,
    };
  }, [variant, product, pay]);

  const selectVariant = useCallback(
    (id: string) => {
      const v = product.variants.find((x) => x.id === id);
      if (!v || !v.inStock) return;
      setVariantId(id);
      setVariantError(false);
      setQty((q) => Math.max(1, Math.min(q, v.maxQuantity)));
    },
    [product.variants],
  );

  const setQuantity = useCallback((n: number) => setQty(Math.max(1, Math.min(n, Math.max(1, maxQuantity)))), [maxQuantity]);

  const addToCart = useCallback(
    (opts?: { buyNow?: boolean }) => {
      if (needsVariant) {
        setVariantError(true);
        const el = pickerRef.current;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
        }
        return false;
      }
      if (maxQuantity <= 0) return false;
      add(
        {
          productId: product.id,
          variantId: variant?.id ?? null,
          slug: product.slug,
          name: product.name,
          variantName: variant?.name ?? null,
          image: product.image,
          unitPriceCents: price.priceCents,
          compareAtCents: price.compareAtCents,
          maxQuantity,
        },
        Math.min(quantity, maxQuantity),
      );
      if (opts?.buyNow) router.push("/checkout");
      else openDrawer();
      return true;
    },
    [needsVariant, maxQuantity, add, product, variant, price, quantity, router, openDrawer],
  );

  const value: Ctx = {
    product,
    pay,
    variant,
    selectVariant,
    needsVariant,
    variantError,
    quantity,
    setQuantity,
    maxQuantity,
    available,
    price,
    pickerRef,
    addToCart,
  };
  return <PurchaseCtx.Provider value={value}>{children}</PurchaseCtx.Provider>;
}
