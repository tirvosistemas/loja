"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  BadgePercent, BellRing, ExternalLink, FileText, FolderTree, GalleryHorizontal, LayoutDashboard, LogOut, Mail, Menu,
  Package, Settings, ShieldCheck, ShoppingBag, Star, Tags, Ticket, Users, X, type LucideIcon,
} from "lucide-react";
import { AnimatedLogo } from "@/components/brand/animated-logo";
import { Sheet } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { ADMIN_NAV } from "./nav";
import { logoutAction } from "@/app/admin/actions";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, ShoppingBag, Users, Package, FolderTree, Tags, Star, GalleryHorizontal, BadgePercent, Ticket, BellRing, Mail, FileText, Settings, ShieldCheck,
};

type Counts = { orders: number; reviews: number };

function NavLinks({ counts, onNavigate }: { counts: Counts; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-6" aria-label="Menu do painel">
      {ADMIN_NAV.map((g) => (
        <div key={g.group}>
          <p className="mb-1.5 px-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-subtle">{g.group}</p>
          <ul className="space-y-0.5">
            {g.items.map((it) => {
              const Icon = ICONS[it.icon];
              const active = it.href === "/admin" ? pathname === "/admin" : pathname.startsWith(it.href);
              const badge = "badge" in it ? counts[it.badge as keyof Counts] : 0;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                      active ? "bg-elevated font-medium text-foreground ring-1 ring-border" : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("size-4.5 shrink-0", active ? "text-primary" : "text-subtle group-hover:text-foreground")} />
                    <span className="flex-1 truncate">{it.label}</span>
                    {badge > 0 && (
                      <span className="tabular rounded-full bg-primary px-1.5 py-px text-[11px] font-semibold text-primary-foreground">{badge > 99 ? "99+" : badge}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({ user, counts, storeName, children }: { user: { name: string; email: string; role: string }; counts: Counts; storeName: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  const closeMenu = useCallback(() => setOpen(false), []);
  // Girou o tablet ou alargou a janela: a barra lateral fixa aparece e a gaveta fecha.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  // No celular o menu abre numa gaveta (Esc fecha, rolagem da página travada); o "fechar" ocupa o lugar do selo.
  const sidebar = (drawer: boolean) => (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between px-5">
        <Link href="/admin" aria-label={`${storeName} · painel`} className="text-foreground">
          <AnimatedLogo className="h-6" />
        </Link>
        {drawer ? (
          <button type="button" onClick={() => setOpen(false)} aria-label="Fechar menu" className="-mr-2 grid size-10 place-items-center rounded-lg text-muted-foreground hover:bg-elevated hover:text-foreground">
            <X className="size-5" />
          </button>
        ) : (
          <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-subtle">admin</span>
        )}
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto px-3 pb-6 pt-2">
        <NavLinks counts={counts} onNavigate={() => setOpen(false)} />
      </div>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-subtle">{user.email}</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" aria-label="Sair" title="Sair" className="grid size-9 place-items-center rounded-lg text-subtle hover:bg-elevated hover:text-foreground">
              <LogOut className="size-4.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-card lg:block">{sidebar(false)}</aside>

      <Sheet open={open} onClose={closeMenu} side="left" className="w-[85vw] max-w-72 bg-card lg:hidden">
        {sidebar(true)}
      </Sheet>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl sm:px-6">
          <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open} className="-ml-1 grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-elevated lg:hidden">
            <Menu className="size-5" />
          </button>
          <Link href="/admin" className="text-foreground lg:hidden" aria-label="Painel">
            <AnimatedLogo className="h-5" replayOnHover={false} />
          </Link>
          <div className="flex-1" />
          <Link
            href="/"
            target="_blank"
            className="hidden items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground sm:flex"
          >
            Ver loja <ExternalLink className="size-3.5" />
          </Link>
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
