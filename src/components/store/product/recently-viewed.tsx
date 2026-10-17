"use client";

import { useEffect, useState } from "react";
import type { ProductCardDTO } from "@/lib/catalog";
import { ProductRail } from "@/components/store/product-rail";
import { useLists } from "@/stores/wishlist";

/** Registra a visita e mostra os outros produtos vistos recentemente. */
export function RecentlyViewed({ currentId }: { currentId: string }) {
  const [items, setItems] = useState<ProductCardDTO[]>([]);

  useEffect(() => {
    const lists = useLists.getState();
    const ids = lists.recent.filter((id) => id !== currentId).slice(0, 12);
    lists.pushRecent(currentId);
    if (!ids.length) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/products?ids=${ids.map(encodeURIComponent).join(",")}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: ProductCardDTO[] }) => setItems(d.items ?? []))
      .catch(() => null);
    return () => ctrl.abort();
  }, [currentId]);

  if (!items.length) return null;
  return <ProductRail title="Vistos recentemente" eyebrow="Seu histórico" products={items} />;
}
