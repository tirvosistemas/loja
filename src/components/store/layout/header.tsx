"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, PackageSearch } from "lucide-react";
import type { MenuCategory } from "@/lib/catalog";
import { AnimatedLogo } from "@/components/brand/animated-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { SearchAutocomplete } from "./search-autocomplete";
import { CategoryNav } from "./category-nav";
import { MobileMenu } from "./mobile-menu";
import { CartButton, WishlistLink } from "./header-actions";
import { MOBILE_SEARCH_ID, useStoreUi } from "./ui-store";

/**
 * Cabeçalho fixo da loja. No computador: logo, busca, atalhos e a linha de categorias.
 * No celular: menu, logo e carrinho, com a busca logo abaixo; ao rolar para baixo ele se
 * esconde (a barra de abas inferior continua visível) e volta ao rolar para cima.
 */
export function Header({ categories, whatsapp }: { categories: MenuCategory[]; whatsapp: string }) {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const hidden = useStoreUi((s) => s.headerHidden);
  const setHidden = useStoreUi((s) => s.setHeaderHidden);
  const setMenuOpen = useStoreUi((s) => s.setMenuOpen);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      setScrolled(y > 8);
      const delta = y - lastY;
      const focusInside = headerRef.current?.contains(document.activeElement) ?? false;
      if (y < 140 || focusInside) setHidden(false);
      else if (delta > 8) setHidden(true);
      else if (delta < -8) setHidden(false);
      if (Math.abs(delta) > 8 || y < 140) lastY = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [setHidden]);

  // Em outra página o cabeçalho volta a aparecer.
  useEffect(() => setHidden(false), [pathname, setHidden]);

  return (
    <>
      <header
        ref={headerRef}
        onFocus={() => setHidden(false)}
        className={cn(
          "sticky top-0 z-40 border-b transition-[translate,background-color,border-color] duration-300",
          scrolled ? "border-border bg-background/80 backdrop-blur-xl backdrop-saturate-150" : "border-transparent bg-background",
          hidden && "max-md:-translate-y-full",
        )}
      >
        <div className="container-page flex h-16 items-center gap-2 md:h-[72px] md:gap-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
            aria-haspopup="dialog"
            className="-ml-2 grid size-10 shrink-0 place-items-center rounded-xl text-foreground hover:bg-elevated md:hidden"
          >
            <Menu className="size-[22px]" aria-hidden />
          </button>

          <Link href="/" aria-label="Tirvo — página inicial" className="shrink-0 rounded-lg text-foreground">
            <AnimatedLogo className="h-7 md:h-8" title="Tirvo" />
          </Link>

          <div className="mx-auto hidden w-full max-w-2xl flex-1 md:block">
            <SearchAutocomplete inputId="busca-topo" />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-0.5 md:ml-0">
            <Link
              href="/acompanhar"
              aria-current={pathname === "/acompanhar" ? "page" : undefined}
              className="hidden h-10 items-center gap-2 rounded-xl px-2.5 text-sm text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground md:flex"
            >
              <PackageSearch className="size-5" aria-hidden />
              <span className="hidden xl:inline">Acompanhar pedido</span>
              <span className="sr-only xl:hidden">Acompanhar pedido</span>
            </Link>
            <WishlistLink className="hidden md:grid" />
            <ThemeToggle className="hidden md:grid" />
            <CartButton className="-mr-2 md:mr-0" />
          </div>
        </div>

        <div className="container-page pb-3 md:hidden">
          <SearchAutocomplete inputId={MOBILE_SEARCH_ID} placeholder="O que você procura?" />
        </div>

        <div className="hidden border-t border-border md:block">
          <CategoryNav categories={categories} />
        </div>
      </header>
      <MobileMenu categories={categories} whatsapp={whatsapp} />
    </>
  );
}
