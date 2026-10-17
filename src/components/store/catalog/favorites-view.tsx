"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Heart, RefreshCw } from "lucide-react";
import type { ProductCardDTO } from "@/lib/catalog";
import { ProductGrid } from "@/components/store/product-card";
import { Button } from "@/components/ui/button";
import { useLists } from "@/stores/wishlist";
import { pluralize } from "@/lib/format";
import { GridSkeleton } from "./skeletons";

// Favoritos ficam no navegador (ids). Aqui buscamos os cards atualizados no servidor.

export function FavoritesView() {
  const [mounted, setMounted] = useState(false);
  const wishlist = useLists((s) => s.wishlist);
  const [items, setItems] = useState<ProductCardDTO[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => setMounted(true), []);

  // Busca só quando aparecem ids novos (desfavoritar apenas filtra a lista atual).
  const fetchKey = mounted ? wishlist.join(",") : null;
  useEffect(() => {
    if (fetchKey == null) return;
    const ids = fetchKey ? fetchKey.split(",").slice(0, 60) : [];
    if (!ids.length) {
      setItems([]);
      return;
    }
    if (items && ids.every((id) => items.some((p) => p.id === id))) return;
    const ctrl = new AbortController();
    setError(false);
    fetch(`/api/products?ids=${ids.map(encodeURIComponent).join(",")}`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json() as Promise<{ items: ProductCardDTO[] }>;
      })
      .then((d) => setItems(d.items))
      .catch((e: Error) => e.name !== "AbortError" && setError(true));
    return () => ctrl.abort();
  }, [fetchKey, attempt]);

  const visible = useMemo(() => {
    if (!items) return [];
    const order = new Map(wishlist.map((id, i) => [id, i]));
    return items.filter((p) => order.has(p.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }, [items, wishlist]);

  return (
    <div>
      <p className="tabular mb-5 text-sm text-muted-foreground" aria-live="polite">
        {mounted && items ? pluralize(visible.length, "produto salvo", "produtos salvos") : " "}
      </p>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <p className="font-semibold">Não foi possível carregar seus favoritos.</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            <RefreshCw aria-hidden /> Tentar de novo
          </Button>
        </div>
      ) : !mounted || items == null ? (
        <GridSkeleton count={4} />
      ) : visible.length === 0 ? (
        <div className="relative overflow-hidden rounded-3xl border border-dashed border-border-strong px-6 py-14 text-center sm:py-20">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
          <div className="relative mx-auto flex max-w-sm flex-col items-center gap-4">
            <span className="relative grid size-16 place-items-center rounded-2xl border border-border bg-card">
              <Heart className="size-7 text-primary" aria-hidden />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" aria-hidden />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Sua lista está vazia</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Toque no coração dos produtos para salvar aqui e comparar depois. A lista fica guardada neste aparelho.
              </p>
            </div>
            <Link
              href="/ofertas"
              className="flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Ver ofertas <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      ) : (
        <ProductGrid products={visible} />
      )}
    </div>
  );
}
