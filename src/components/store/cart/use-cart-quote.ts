"use client";

import { useCallback, useEffect, useState } from "react";
import type { CartQuoteResponse } from "@/lib/orders/quote";
import type { PaymentMethodKey } from "@/lib/constants";
import { useCart } from "@/stores/cart";

// Cotação do carrinho no servidor (POST /api/cart/quote), refeita 300 ms depois de cada
// mudança. A resposta atualiza preços e limites do carrinho guardado no navegador e tira
// os itens que ficaram indisponíveis; os avisos ficam em `notices` até o cliente fechar.

export type QuoteAddressInput = {
  cep: string;
  number?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
};

export type CartQuoteParams = {
  couponCode?: string;
  phone?: string | null;
  address?: QuoteAddressInput | null;
  deliveryType?: "DELIVERY" | "PICKUP";
  paymentMethod?: PaymentMethodKey | null;
};

type State = { key: string | null; quote: CartQuoteResponse | null; error: string | null };

export function useDebouncedValue<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useCartQuote(params: CartQuoteParams, opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled ?? true;
  const items = useCart((s) => s.items);
  const syncFromServer = useCart((s) => s.syncFromServer);

  const body = {
    items: items.map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: i.quantity })),
    couponCode: params.couponCode || null,
    phone: params.phone || null,
    address: params.address ?? null,
    deliveryType: params.deliveryType ?? "DELIVERY",
    paymentMethod: params.paymentMethod ?? null,
  };
  const key = JSON.stringify(body);
  const empty = body.items.length === 0;

  const [state, setState] = useState<State>({ key: null, quote: null, error: null });
  const [notices, setNotices] = useState<string[]>([]);
  const [nonce, setNonce] = useState(0);
  const reqKey = `${nonce}|${key}`;

  useEffect(() => {
    if (!enabled || empty) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/cart/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: key,
          signal: ctrl.signal,
        });
        const data = (await res.json().catch(() => null)) as (CartQuoteResponse & { error?: string }) | null;
        if (!res.ok || !data || !Array.isArray(data.lines)) {
          throw new Error(data?.error || "Não foi possível atualizar o carrinho agora.");
        }
        if (ctrl.signal.aborted) return;
        setState({ key: reqKey, quote: data, error: null });
        if (data.issues.length > 0) setNotices((prev) => [...new Set([...prev, ...data.issues])]);
        syncFromServer(
          data.lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId,
            unitPriceCents: l.unitPriceCents,
            compareAtCents: l.compareAtCents,
            maxQuantity: l.maxQuantity,
            quantity: l.quantity,
          })),
          data.unavailable.map((l) => l.key),
        );
      } catch (e) {
        if (ctrl.signal.aborted || (e as Error).name === "AbortError") return;
        const message =
          e instanceof TypeError ? "Sem conexão. Confira sua internet." : (e as Error).message || "Não foi possível atualizar o carrinho agora.";
        setState((s) => ({ ...s, key: reqKey, error: message }));
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [key, reqKey, enabled, empty, syncFromServer]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  const dismissNotices = useCallback(() => setNotices([]), []);
  const addNotices = useCallback((list: string[]) => setNotices((prev) => [...new Set([...prev, ...list])]), []);

  const settled = state.key === reqKey;
  return {
    quote: empty ? null : state.quote,
    /** true enquanto a resposta não corresponde ao carrinho atual */
    loading: enabled && !empty && !settled,
    error: settled ? state.error : null,
    notices,
    dismissNotices,
    addNotices,
    refresh,
  };
}

export type CartQuoteState = ReturnType<typeof useCartQuote>;
