"use client";

import Link from "next/link";
import { Heart, ShoppingBag, Truck, Zap } from "lucide-react";
import { toast } from "sonner";
import type { ProductCardDTO } from "@/lib/catalog";
import { useCart } from "@/stores/cart";
import { useLists } from "@/stores/wishlist";
import { SmartImage } from "@/components/ui/smart-image";
import { Price } from "@/components/ui/price";
import { Rating } from "@/components/ui/rating";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Card de produto usado em todas as listas da loja. */
export function ProductCard({ product, priority, className }: { product: ProductCardDTO; priority?: boolean; className?: string }) {
  const add = useCart((s) => s.add);
  const openDrawer = useCart((s) => s.openDrawer);
  const wished = useLists((s) => s.wishlist.includes(product.id));
  const toggleWish = useLists((s) => s.toggleWish);
  const href = `/produto/${product.slug}`;

  const quickAdd = () => {
    add({
      productId: product.id,
      variantId: null,
      slug: product.slug,
      name: product.name,
      variantName: null,
      image: product.image,
      unitPriceCents: product.priceCents,
      compareAtCents: product.compareAtCents,
      maxQuantity: 20,
    });
    toast.success("Adicionado ao carrinho", { description: product.name, action: { label: "Ver carrinho", onClick: openDrawer } });
  };

  return (
    <article
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-card",
        className,
      )}
    >
      <Link href={href} className="relative block aspect-square overflow-hidden bg-well" aria-label={product.name}>
        <SmartImage
          src={product.image}
          alt={product.name}
          size="sm"
          sizes="(min-width: 1280px) 20vw, (min-width: 768px) 30vw, 50vw"
          priority={priority}
          className={cn("size-full object-contain p-5 transition-all duration-500 group-hover:scale-[1.04]", product.hoverImage && "group-hover:opacity-0")}
        />
        {product.hoverImage && (
          <SmartImage
            src={product.hoverImage}
            alt=""
            size="sm"
            aria-hidden
            className="absolute inset-0 size-full object-contain p-5 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        )}
        {!product.inStock && (
          <span className="absolute inset-x-3 bottom-3 rounded-lg bg-black/75 py-1.5 text-center text-xs font-medium text-white">Esgotado</span>
        )}
      </Link>

      <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
        {product.discountPercent > 0 && <Badge tone="solid">-{product.discountPercent}%</Badge>}
        {product.promo?.flash && (
          <Badge tone="inverse">
            <Zap /> Relâmpago
          </Badge>
        )}
        {product.promo?.badge && !product.promo.flash && <Badge tone="inverse">{product.promo.badge}</Badge>}
        {product.isNew && <Badge className="border-transparent bg-black/80 text-white">Lançamento</Badge>}
      </div>

      <button
        type="button"
        onClick={() => toggleWish(product.id)}
        aria-label={wished ? "Remover dos favoritos" : "Salvar nos favoritos"}
        aria-pressed={wished}
        className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/90 text-zinc-800 shadow-sm backdrop-blur transition hover:scale-105 hover:bg-white"
      >
        <Heart className={cn("size-4.5", wished && "fill-[#ff5500] text-[#ff5500]")} />
      </button>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2 text-[12px] text-subtle">
          <span className="truncate uppercase tracking-wider">{product.brand ?? " "}</span>
          {product.voltage && <span className="shrink-0 rounded-md border border-border px-1.5 py-px font-mono text-[11px]">{product.voltage}</span>}
        </div>
        <Link href={href} className="line-clamp-2 min-h-[2.6em] text-[15px] font-medium leading-snug hover:text-primary">
          {product.name}
        </Link>
        {product.ratingCount > 0 && <Rating value={product.ratingAvg} count={product.ratingCount} />}
        <Price
          className="mt-auto pt-1"
          priceCents={product.priceCents}
          compareAtCents={product.compareAtCents}
          pixPriceCents={product.pixPriceCents}
          installments={product.installments}
          fromPrice={product.fromPrice}
        />
        <div className="flex items-center gap-2 pt-1">
          {product.hasVariants ? (
            <Link
              href={href}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-border-strong text-sm font-medium transition-colors hover:border-primary hover:text-primary"
            >
              Ver opções
            </Link>
          ) : (
            <button
              type="button"
              onClick={quickAdd}
              disabled={!product.inStock}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-inverse text-sm font-medium text-inverse-foreground transition hover:bg-primary hover:text-primary-foreground disabled:opacity-40"
            >
              <ShoppingBag className="size-4" /> {product.inStock ? "Adicionar" : "Indisponível"}
            </button>
          )}
        </div>
        {product.freeShipping && (
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-success">
            <Truck className="size-3.5" /> Frete grátis
          </p>
        )}
      </div>
    </article>
  );
}

export function ProductGrid({ products, className }: { products: ProductCardDTO[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4", className)}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 4} />
      ))}
    </div>
  );
}
