"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Heart, PackageSearch, Sparkles, Zap } from "lucide-react";
import type { MenuCategory } from "@/lib/catalog";
import { Sheet } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { CategoryIcon } from "@/components/ui/category-icon";
import { buttonVariants } from "@/components/ui/button";
import { InstallAppButton } from "@/components/pwa/install-app";
import { Logo } from "@/components/brand/logo";
import { whatsappLink } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { useStoreUi } from "./ui-store";
import { WhatsAppIcon } from "./social-icons";

const GREETING = "Olá! Vim pelo site da Tirvo e queria tirar uma dúvida.";

/** Menu lateral do celular: categorias (com subcategorias), atalhos, app e tema. */
export function MobileMenu({ categories, whatsapp }: { categories: MenuCategory[]; whatsapp: string }) {
  const open = useStoreUi((s) => s.menuOpen);
  const setOpen = useStoreUi((s) => s.setMenuOpen);
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => setOpen(false), [pathname, setOpen]);

  const close = () => setOpen(false);
  const quick = [
    { href: "/ofertas", label: "Ofertas", icon: <Zap className="size-[18px] text-primary" aria-hidden />, dot: true },
    { href: "/lancamentos", label: "Lançamentos", icon: <Sparkles className="size-[18px] text-subtle" aria-hidden /> },
    { href: "/acompanhar", label: "Acompanhar pedido", icon: <PackageSearch className="size-[18px] text-subtle" aria-hidden /> },
    { href: "/favoritos", label: "Favoritos", icon: <Heart className="size-[18px] text-subtle" aria-hidden /> },
  ];

  return (
    <Sheet open={open} onClose={close} side="left" label="Menu da loja" title={<Logo className="h-6" title="Tirvo" />}>
      <nav aria-label="Menu" className="flex min-h-full flex-col">
        <ul className="border-b border-border px-3 py-3">
          {quick.map((q) => (
            <li key={q.href}>
              <Link
                href={q.href}
                onClick={close}
                aria-current={pathname === q.href ? "page" : undefined}
                className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium hover:bg-elevated"
              >
                {q.icon}
                <span className="flex-1">{q.label}</span>
                {q.dot && <span aria-hidden className="size-2 rounded-full bg-primary animate-pulse-dot" />}
              </Link>
            </li>
          ))}
        </ul>

        {categories.length > 0 && (
          <div className="px-3 py-4">
            <p className="px-3 pb-2 font-mono text-xs uppercase tracking-[0.16em] text-subtle">Categorias</p>
            <ul>
              {categories.map((c) => {
                const isOpen = expanded === c.id;
                const subId = `menu-sub-${c.id}`;
                return (
                  <li key={c.id}>
                    <div className="flex items-center">
                      <Link
                        href={`/categoria/${c.slug}`}
                        onClick={close}
                        aria-current={pathname === `/categoria/${c.slug}` ? "page" : undefined}
                        className="flex min-h-11 flex-1 items-center gap-3 rounded-xl px-3 text-[15px] hover:bg-elevated"
                      >
                        <CategoryIcon name={c.icon} className="size-[18px] shrink-0 text-subtle" />
                        <span className="truncate">{c.name}</span>
                      </Link>
                      {c.children.length > 0 && (
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={subId}
                          aria-label={`${isOpen ? "Fechar" : "Abrir"} subcategorias de ${c.name}`}
                          onClick={() => setExpanded(isOpen ? null : c.id)}
                          className="grid size-11 shrink-0 place-items-center rounded-xl text-subtle hover:bg-elevated hover:text-foreground"
                        >
                          <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} aria-hidden />
                        </button>
                      )}
                    </div>
                    {c.children.length > 0 && (
                      <ul id={subId} hidden={!isOpen} className="mb-2 ml-[22px] border-l border-border pl-4">
                        {c.children.map((ch) => (
                          <li key={ch.id}>
                            <Link
                              href={`/categoria/${ch.slug}`}
                              onClick={close}
                              className="flex min-h-10 items-center rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground"
                            >
                              {ch.name}
                            </Link>
                          </li>
                        ))}
                        <li>
                          <Link
                            href={`/categoria/${c.slug}`}
                            onClick={close}
                            className="flex min-h-10 items-center rounded-lg px-2 text-sm font-medium text-primary"
                          >
                            Ver tudo em {c.name}
                          </Link>
                        </li>
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-auto space-y-3 border-t border-border px-5 py-5">
          <InstallAppButton block variant="secondary" label="Baixar o app" />
          {whatsapp && (
            <a
              href={whatsappLink(whatsapp, GREETING)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "whatsapp", block: true })}
            >
              <WhatsAppIcon className="size-5" /> Falar no WhatsApp
            </a>
          )}
          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-1">
            <span className="text-sm text-muted-foreground">Tema claro / escuro</span>
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </Sheet>
  );
}
