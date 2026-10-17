import type { Metadata } from "next";
import Link from "next/link";
import { BadgePercent, CalendarClock, ExternalLink, Package, Plus, Zap } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonIds, cn } from "@/lib/utils";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { EmptyState } from "@/components/ui/card";
import { Countdown } from "@/components/ui/countdown";
import { buttonVariants } from "@/components/ui/button";
import { countScopeProducts, getPickerOptions, scopeWhere } from "@/components/admin/marketing/data";
import { scheduleState, type ScheduleState } from "@/components/admin/marketing/schedule";
import { PromotionsTable } from "@/components/admin/marketing/promotions-table";

export const metadata: Metadata = { title: "Promoções e ofertas" };

type SP = Record<string, string | string[] | undefined>;

const FILTERS: { id: "todas" | ScheduleState; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "active", label: "Ativas" },
  { id: "scheduled", label: "Agendadas" },
  { id: "inactive", label: "Inativas" },
  { id: "ended", label: "Encerradas" },
];
const FILTER_PARAM: Record<string, ScheduleState> = { ativas: "active", agendadas: "scheduled", inativas: "inactive", encerradas: "ended" };
const PARAM_OF: Record<ScheduleState, string> = { active: "ativas", scheduled: "agendadas", inactive: "inativas", ended: "encerradas" };

export default async function PromotionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const raw = Array.isArray(sp.situacao) ? sp.situacao[0] : sp.situacao;
  const filter = raw ? FILTER_PARAM[raw] : undefined;

  const [rows, options] = await Promise.all([db.promotion.findMany({ orderBy: [{ active: "desc" }, { priority: "desc" }, { createdAt: "desc" }] }), getPickerOptions()]);
  const now = new Date();
  const promos = rows.map((p) => {
    const ids = { categoryIds: jsonIds(p.categoryIds), brandIds: jsonIds(p.brandIds), productIds: jsonIds(p.productIds) };
    return { ...p, ...ids, state: scheduleState(p, now) };
  });

  // Ordem: no ar, agendadas, inativas, encerradas.
  const rank: Record<ScheduleState, number> = { active: 0, scheduled: 1, inactive: 2, ended: 3 };
  promos.sort((a, b) => rank[a.state] - rank[b.state]);

  const counts = await Promise.all(promos.map((p) => countScopeProducts(p)));
  const live = promos.filter((p) => p.state === "active");
  const discounted = live.length
    ? live.some((p) => p.scope === "ALL")
      ? await db.product.count({ where: { status: "ACTIVE" } })
      : await db.product.count({ where: { OR: live.map((p) => scopeWhere(p)).filter((w): w is Prisma.ProductWhereInput => !!w) } })
    : 0;
  const flash = live.filter((p) => p.flash && p.endsAt).sort((a, b) => a.endsAt!.getTime() - b.endsAt!.getTime())[0];

  const catNames = new Map(options.categories.map((c) => [c.id, c.name]));
  const brandNames = new Map(options.brands.map((b) => [b.id, b.name]));
  const visible = promos.map((p, i) => ({ ...p, affected: counts[i] })).filter((p) => !filter || p.state === filter);
  const byState = (s: ScheduleState) => promos.filter((p) => p.state === s).length;

  return (
    <>
      <PageHeader
        title="Promoções e ofertas"
        description="Descontos automáticos: o preço muda sozinho na loja enquanto a promoção vale."
        actions={
          <>
            <a href="/ofertas" target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary" })}>
              <ExternalLink aria-hidden /> Ver ofertas na loja
            </a>
            <Link href="/admin/promocoes/novo" className={buttonVariants({ variant: "primary" })}>
              <Plus aria-hidden /> Nova promoção
            </Link>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="No ar agora" value={live.length.toLocaleString("pt-BR")} icon={<BadgePercent />} hint={live.length === 1 ? "promoção ativa" : "promoções ativas"} />
        <StatCard label="Agendadas" value={byState("scheduled").toLocaleString("pt-BR")} icon={<CalendarClock />} hint="começam depois" />
        <StatCard label="Produtos com desconto" value={discounted.toLocaleString("pt-BR")} icon={<Package />} hint="ativos, agora" />
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>Oferta relâmpago</span>
            <Zap className="size-4.5 text-subtle" aria-hidden />
          </div>
          {flash ? (
            <>
              <Countdown endsAt={flash.endsAt!.toISOString()} compact className="mt-2 block text-2xl font-semibold" />
              <p className="mt-1 truncate text-xs text-subtle">{flash.name}</p>
            </>
          ) : (
            <>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-subtle">—</p>
              <p className="mt-1 text-xs text-subtle">Nenhuma no ar</p>
            </>
          )}
        </div>
      </div>

      {promos.length > 0 && (
        <nav aria-label="Filtrar por situação" className="no-scrollbar -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {FILTERS.map((f) => {
            const activeTab = (f.id === "todas" && !filter) || f.id === filter;
            const n = f.id === "todas" ? promos.length : byState(f.id);
            return (
              <Link
                key={f.id}
                href={f.id === "todas" ? "/admin/promocoes" : `/admin/promocoes?situacao=${PARAM_OF[f.id]}`}
                aria-current={activeTab ? "page" : undefined}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm transition-colors",
                  activeTab ? "border-transparent bg-inverse font-medium text-inverse-foreground" : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                {f.label}
                <span className="tabular text-xs opacity-70">{n}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {promos.length === 0 ? (
        <EmptyState
          icon={<BadgePercent />}
          title="Nenhuma promoção criada"
          description="Crie uma promoção para dar desconto em toda a loja, em categorias, marcas ou produtos escolhidos. O preço muda sozinho no período que você definir."
          action={
            <Link href="/admin/promocoes/novo" className={buttonVariants({ variant: "primary" })}>
              <Plus aria-hidden /> Criar promoção
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState icon={<BadgePercent />} title="Nada nesta situação" description="Escolha outro filtro para ver as demais promoções." />
      ) : (
        <PromotionsTable rows={visible} now={now} catNames={catNames} brandNames={brandNames} />
      )}
    </>
  );
}
