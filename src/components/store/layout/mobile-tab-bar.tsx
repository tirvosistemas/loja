"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { flushSync } from "react-dom";
import { Heart, House, LayoutGrid, Search, ShoppingBag } from "lucide-react";
import { useCart } from "@/stores/cart";
import { cn } from "@/lib/utils";
import { CountBadge, useCartCount, useWishCount } from "./header-actions";
import { MOBILE_SEARCH_ID, useStoreUi } from "./ui-store";

/** Rotas com fluxo próprio, sem a barra inferior. */
const HIDDEN_ON = ["/checkout"];

/** Barra de navegação inferior no celular, com cara de aplicativo. */
export function MobileTabBar() {
  const pathname = usePathname();
  const cartCount = useCartCount();
  const wishCount = useWishCount();
  const openDrawer = useCart((s) => s.openDrawer);
  const drawerOpen = useCart((s) => s.drawerOpen);
  const menuOpen = useStoreUi((s) => s.menuOpen);
  const setMenuOpen = useStoreUi((s) => s.setMenuOpen);
  const setHeaderHidden = useStoreUi((s) => s.setHeaderHidden);

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const focusSearch = () => {
    // Mostra o cabeçalho na hora e foca o campo ainda dentro do toque (abre o teclado no iPhone).
    flushSync(() => setHeaderHidden(false));
    const input = document.getElementById(MOBILE_SEARCH_ID) as HTMLInputElement | null;
    input?.focus({ preventScroll: true });
    input?.select();
  };

  const item = "relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors";
  const on = "text-foreground";
  const off = "text-subtle hover:text-foreground";
  const isHome = pathname === "/";
  const isWish = pathname.startsWith("/favoritos");

  return (
    <>
      {/* Espaço para o conteúdo não ficar atrás da barra */}
      <div aria-hidden className="h-[calc(4rem+env(safe-area-inset-bottom))] md:hidden" />
      <nav aria-label="Navegação rápida" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-xl backdrop-saturate-150 md:hidden">
        <ul className="grid h-16 grid-cols-5">
          <li>
            <Link href="/" aria-current={isHome ? "page" : undefined} className={cn(item, isHome ? on : off)}>
              {isHome && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
              <House className="size-[22px]" aria-hidden />
              Início
            </Link>
          </li>
          <li>
            <button type="button" onClick={() => setMenuOpen(true)} aria-haspopup="dialog" aria-expanded={menuOpen} className={cn(item, "w-full", menuOpen ? on : off)}>
              <LayoutGrid className="size-[22px]" aria-hidden />
              Categorias
            </button>
          </li>
          <li>
            <button type="button" onClick={focusSearch} className={cn(item, "w-full", pathname.startsWith("/busca") ? on : off)}>
              <Search className="size-[22px]" aria-hidden />
              Buscar
            </button>
          </li>
          <li>
            <Link
              href="/favoritos"
              aria-current={isWish ? "page" : undefined}
              aria-label={wishCount > 0 ? `Favoritos, ${wishCount} ${wishCount === 1 ? "produto" : "produtos"}` : "Favoritos"}
              className={cn(item, isWish ? on : off)}
            >
              {isWish && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
              <span className="relative">
                <Heart className="size-[22px]" aria-hidden />
                <CountBadge count={wishCount} className="-right-2.5 -top-1.5" />
              </span>
              <span aria-hidden>Favoritos</span>
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={openDrawer}
              aria-haspopup="dialog"
              aria-expanded={drawerOpen}
              aria-label={cartCount > 0 ? `Carrinho, ${cartCount} ${cartCount === 1 ? "item" : "itens"}` : "Carrinho"}
              className={cn(item, "w-full", drawerOpen ? on : off)}
            >
              <span className="relative">
                <ShoppingBag className="size-[22px]" aria-hidden />
                <CountBadge count={cartCount} className="-right-2.5 -top-1.5" />
              </span>
              <span aria-hidden>Carrinho</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
