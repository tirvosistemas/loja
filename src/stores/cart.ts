"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Carrinho do cliente, salvo no navegador. Os preços guardados aqui servem só para
// exibição imediata; o servidor sempre recalcula (POST /api/cart/quote e /api/orders).

export type CartItem = {
  productId: string;
  variantId: string | null;
  quantity: number;
  // retrato para exibir sem esperar o servidor
  slug: string;
  name: string;
  variantName: string | null;
  image: string | null;
  unitPriceCents: number;
  compareAtCents: number | null;
  maxQuantity: number;
};

export type SavedAddress = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  reference: string;
};

export type SavedShipping = {
  cep: string;
  number: string;
  feeCents: number;
  free: boolean;
  distanceKm: number;
  etaText: string;
  quotedAt: number;
};

type CartState = {
  items: CartItem[];
  couponCode: string;
  address: SavedAddress | null;
  shipping: SavedShipping | null;
  customer: { name: string; phone: string; email: string };
  drawerOpen: boolean;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (productId: string, variantId: string | null, quantity: number) => void;
  remove: (productId: string, variantId: string | null) => void;
  clear: () => void;
  setCoupon: (code: string) => void;
  setAddress: (a: SavedAddress | null) => void;
  setShipping: (s: SavedShipping | null) => void;
  setCustomer: (c: Partial<CartState["customer"]>) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** Atualiza preços e limites com o que veio do servidor. */
  syncFromServer: (lines: { productId: string; variantId: string | null; unitPriceCents: number; compareAtCents: number | null; maxQuantity: number; quantity: number }[], removedKeys?: string[]) => void;
};

const same = (a: { productId: string; variantId: string | null }, productId: string, variantId: string | null) =>
  a.productId === productId && (a.variantId ?? null) === (variantId ?? null);

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      couponCode: "",
      address: null,
      shipping: null,
      customer: { name: "", phone: "", email: "" },
      drawerOpen: false,
      add: (item, quantity = 1) =>
        set((s) => {
          const existing = s.items.find((i) => same(i, item.productId, item.variantId));
          const max = Math.max(1, item.maxQuantity || 1);
          if (existing) {
            return {
              items: s.items.map((i) =>
                same(i, item.productId, item.variantId) ? { ...i, ...item, quantity: Math.min(max, i.quantity + quantity) } : i,
              ),
            };
          }
          return { items: [...s.items, { ...item, quantity: Math.min(max, quantity) }] };
        }),
      setQuantity: (productId, variantId, quantity) =>
        set((s) => ({
          items: s.items
            .map((i) => (same(i, productId, variantId) ? { ...i, quantity: Math.min(Math.max(0, quantity), i.maxQuantity || 99) } : i))
            .filter((i) => i.quantity > 0),
        })),
      remove: (productId, variantId) => set((s) => ({ items: s.items.filter((i) => !same(i, productId, variantId)) })),
      clear: () => set({ items: [], couponCode: "" }),
      setCoupon: (couponCode) => set({ couponCode: couponCode.trim().toUpperCase() }),
      setAddress: (address) => set({ address }),
      setShipping: (shipping) => set({ shipping }),
      setCustomer: (c) => set((s) => ({ customer: { ...s.customer, ...c } })),
      openDrawer: () => set({ drawerOpen: true }),
      closeDrawer: () => set({ drawerOpen: false }),
      syncFromServer: (lines, removedKeys = []) =>
        set((s) => ({
          items: s.items
            .filter((i) => !removedKeys.includes(`${i.productId}:${i.variantId ?? ""}`))
            .map((i) => {
              const l = lines.find((x) => same(x, i.productId, i.variantId));
              return l
                ? { ...i, unitPriceCents: l.unitPriceCents, compareAtCents: l.compareAtCents, maxQuantity: l.maxQuantity, quantity: Math.min(i.quantity, Math.max(1, l.maxQuantity)) }
                : i;
            }),
        })),
    }),
    {
      name: "tirvo-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ items: s.items, couponCode: s.couponCode, address: s.address, shipping: s.shipping, customer: s.customer }),
    },
  ),
);

export const cartCount = (s: CartState) => s.items.reduce((n, i) => n + i.quantity, 0);
export const cartSubtotal = (s: CartState) => s.items.reduce((n, i) => n + i.quantity * i.unitPriceCents, 0);
