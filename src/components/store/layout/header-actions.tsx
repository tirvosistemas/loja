"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Heart, ShoppingBag } from "lucide-react";
import { cartCount, useCart } from "@/stores/cart";
import { useLists } from "@/stores/wishlist";
import { cn } from "@/lib/utils";
import { useMounted } from "./ui-store";

/** Bolinha com a contagem, com um "pulo" quando o número muda. */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 20 }}
          aria-hidden
          className={cn(
            "tabular absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground ring-2 ring-background",
            className,
          )}
        >
          {count > 99 ? "99+" : count}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export function useCartCount() {
  const mounted = useMounted();
  const count = useCart(cartCount);
  return mounted ? count : 0;
}

export function useWishCount() {
  const mounted = useMounted();
  const count = useLists((s) => s.wishlist.length);
  return mounted ? count : 0;
}

export function CartButton({ className }: { className?: string }) {
  const count = useCartCount();
  const openDrawer = useCart((s) => s.openDrawer);
  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={count > 0 ? `Abrir carrinho, ${count} ${count === 1 ? "item" : "itens"}` : "Abrir carrinho"}
      aria-haspopup="dialog"
      className={cn(
        "relative grid size-10 place-items-center rounded-xl text-foreground transition-colors hover:bg-elevated",
        className,
      )}
    >
      <ShoppingBag className="size-[22px]" aria-hidden />
      <CountBadge count={count} />
    </button>
  );
}

export function WishlistLink({ className }: { className?: string }) {
  const count = useWishCount();
  return (
    <Link
      href="/favoritos"
      aria-label={count > 0 ? `Favoritos, ${count} ${count === 1 ? "produto" : "produtos"}` : "Favoritos"}
      className={cn("relative grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground", className)}
    >
      <Heart className="size-5" aria-hidden />
      <CountBadge count={count} />
    </Link>
  );
}
