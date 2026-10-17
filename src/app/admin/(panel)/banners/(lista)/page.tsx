import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, GalleryHorizontal, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getPickerOptions } from "@/components/admin/marketing/data";
import { BannerCard } from "@/components/admin/marketing/banner-card";
import { scheduleState } from "@/components/admin/marketing/schedule";
import { describeHref } from "@/components/admin/marketing/links";

export const metadata: Metadata = { title: "Banners" };

const GROUPS = [
  {
    placement: "HERO" as const,
    title: "Carrossel do topo",
    description: "Banners grandes no início da página inicial. Giram sozinhos, na ordem abaixo.",
    empty: "Sem banners no carrossel, a loja mostra a abertura padrão da marca.",
    aspect: "aspect-[8/3]",
  },
  {
    placement: "STRIP" as const,
    title: "Faixas no meio da página",
    description: "Campanhas entre as vitrines de produtos, com uma ou duas por linha.",
    empty: "Use as faixas para destacar uma categoria, uma marca ou uma condição especial.",
    aspect: "aspect-[3/1]",
  },
];

export default async function BannersPage() {
  await requireAdmin();
  const [banners, settings, options] = await Promise.all([
    db.banner.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),
    getSettings(),
    getPickerOptions(),
  ]);
  const now = new Date();
  const names = {
    categories: new Map(options.categories.map((c) => [c.slug, c.name])),
    brands: new Map(options.brands.map((b) => [b.slug, b.name])),
    pages: new Map(options.pages.map((p) => [p.slug, p.title])),
  };
  const autoplay = settings.appearance.heroAutoplayMs;

  return (
    <>
      <PageHeader
        title="Banners"
        description="Imagens de destaque da página inicial, com título, botão e período de exibição."
        actions={
          <>
            <a href="/" target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary" })}>
              <ExternalLink aria-hidden /> Ver na loja
            </a>
            <Link href="/admin/banners/novo" className={buttonVariants({ variant: "primary" })}>
              <Plus aria-hidden /> Novo banner
            </Link>
          </>
        }
      />

      <div className="space-y-10">
        {GROUPS.map((g) => {
          const items = banners.filter((b) => b.placement === g.placement);
          const live = items.filter((b) => scheduleState(b, now) === "active").length;
          return (
            <section key={g.placement} aria-labelledby={`grupo-${g.placement}`}>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h2 id={`grupo-${g.placement}`} className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
                    {g.title}
                    <span className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[10.5px] font-normal uppercase tracking-[0.14em] text-subtle">{g.placement}</span>
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {g.description}{" "}
                    {items.length > 0 && (
                      <span className="tabular text-subtle">
                        {live} de {items.length} no ar agora.
                      </span>
                    )}
                  </p>
                  {g.placement === "HERO" && (
                    <p className="mt-1 text-[13px] text-subtle">
                      {autoplay > 0 ? `Troca automática a cada ${(Math.round(autoplay / 100) / 10).toLocaleString("pt-BR")} s.` : "Troca automática desligada."}{" "}
                      <Link href="/admin/configuracoes?aba=seo" className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline">
                        Ajustar
                      </Link>
                    </p>
                  )}
                </div>
                <Link href={`/admin/banners/novo?posicao=${g.placement}`} className={buttonVariants({ variant: "secondary", size: "sm", className: "h-10 shrink-0 self-start sm:self-auto" })}>
                  <Plus aria-hidden /> Adicionar
                </Link>
              </div>

              {items.length === 0 ? (
                <EmptyState
                  icon={<GalleryHorizontal />}
                  title={g.placement === "HERO" ? "Nenhum banner no carrossel" : "Nenhuma faixa criada"}
                  description={g.empty}
                  action={
                    <Link href={`/admin/banners/novo?posicao=${g.placement}`} className={buttonVariants({ variant: "primary" })}>
                      <Plus aria-hidden /> Criar banner
                    </Link>
                  }
                />
              ) : (
                <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((b, i) => (
                    <BannerCard key={b.id} banner={b} index={i} total={items.length} aspect={g.aspect} now={now} linkText={describeHref(b.href, names)} />
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
