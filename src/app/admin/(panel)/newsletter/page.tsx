import type { Metadata } from "next";
import { Suspense } from "react";
import { Download, Mail } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, pluralize } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { PageHeader, StatCard } from "@/components/admin/page-header";
import { SearchBox } from "@/components/admin/search-box";
import { CopyButton } from "@/components/admin/orders/copy-button";
import { addDays, startOfTodaySP } from "@/components/admin/orders/time";
import { EmptyState, Skeleton } from "@/components/ui/card";
import { Pagination } from "@/components/ui/nav";
import { buttonVariants } from "@/components/ui/button";
import { DeleteSubscriber } from "./delete-subscriber";

export const metadata: Metadata = { title: "Newsletter" };

const PER_PAGE = 50;
type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function NewsletterPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 120);
  const pageRaw = Number.parseInt(first(sp.page), 10);
  const where: Prisma.NewsletterSubscriberWhereInput = q ? { email: { contains: q.toLowerCase() } } : {};

  const [total, all, last30, settings] = await Promise.all([
    db.newsletterSubscriber.count({ where }),
    db.newsletterSubscriber.count(),
    db.newsletterSubscriber.count({ where: { createdAt: { gte: addDays(startOfTodaySP(), -29) } } }),
    getSettings(),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1), pageCount);
  const subscribers = await db.newsletterSubscriber.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE });
  const href = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (p > 1) s.set("page", String(p));
    const qs = s.toString();
    return `/admin/newsletter${qs ? `?${qs}` : ""}`;
  };
  const exportHref = `/api/admin/newsletter/export${q ? `?q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <PageHeader
        title="Newsletter"
        description="E-mails de quem pediu para receber ofertas e novidades pelo site."
        actions={
          all > 0 ? (
            <>
              <CopyButton text={subscribers.map((s) => s.email).join(", ")} label="Copiar e-mails da página" toastMessage="E-mails copiados." size="md" />
              <a href={exportHref} download className={buttonVariants({ variant: "secondary" })}>
                <Download aria-hidden /> Exportar CSV
              </a>
            </>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:max-w-lg">
        <StatCard label="Inscritos" value={all.toLocaleString("pt-BR")} icon={<Mail />} />
        <StatCard label="Últimos 30 dias" value={`+${last30.toLocaleString("pt-BR")}`} hint="novos inscritos" />
      </div>

      {!settings.appearance.showNewsletter && (
        <p className="mb-5 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
          O cadastro da newsletter está escondido no site. Ative em Configurações → SEO e aparência.
        </p>
      )}

      <div className="mb-4">
        <Suspense fallback={<Skeleton className="h-11 w-full sm:w-80" />}>
          <SearchBox placeholder="Buscar e-mail" className="w-full sm:w-80" />
        </Suspense>
      </div>

      {subscribers.length === 0 ? (
        <EmptyState
          icon={<Mail />}
          title={q ? "Nenhum e-mail encontrado" : "Nenhum inscrito ainda"}
          description={q ? `Nada encontrado para “${q}”.` : "Quando alguém se inscrever pelo site, o e-mail aparece aqui."}
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">{pluralize(total, "e-mail", "e-mails")}</p>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {subscribers.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-elevated/50">
                <div className="min-w-0 flex-1">
                  <a href={`mailto:${s.email}`} className="block truncate text-sm font-medium hover:text-primary">
                    {s.email}
                  </a>
                  <p className="tabular text-xs text-subtle">Inscrito em {formatDateTime(s.createdAt)}</p>
                </div>
                <DeleteSubscriber id={s.id} email={s.email} />
              </li>
            ))}
          </ul>
          <Pagination className="mt-6" page={page} pageCount={pageCount} hrefFor={href} />
        </>
      )}
    </>
  );
}
