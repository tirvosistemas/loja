import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, CheckCheck, ExternalLink, Megaphone, Smartphone } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/format";
import { imageUrl } from "@/lib/images";
import { AdminTable, PageHeader, StatCard } from "@/components/admin/page-header";
import { Eyebrow } from "@/components/admin/settings/form-kit";
import { EmptyState } from "@/components/ui/card";
import { Pagination } from "@/components/ui/nav";
import { getPickerOptions, linkOptions } from "@/components/admin/marketing/data";
import { describeHref } from "@/components/admin/marketing/links";
import { PushComposer } from "@/components/admin/marketing/push-composer";

export const metadata: Metadata = { title: "Notificações do app" };

const PER_PAGE = 20;
type SP = Record<string, string | string[] | undefined>;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const pageRaw = Number.parseInt((Array.isArray(sp.page) ? sp.page[0] : sp.page) ?? "", 10);

  const [subscribers, campaigns, delivered, options, settings, last30] = await Promise.all([
    db.pushSubscription.count(),
    db.pushCampaign.count(),
    db.pushCampaign.aggregate({ _sum: { sentCount: true } }),
    getPickerOptions(),
    getSettings(),
    db.pushSubscription.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(campaigns / PER_PAGE));
  const page = Math.min(Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1), pageCount);
  const history = await db.pushCampaign.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE });
  const names = {
    categories: new Map(options.categories.map((c) => [c.slug, c.name])),
    brands: new Map(options.brands.map((b) => [b.slug, b.name])),
    pages: new Map(options.pages.map((p) => [p.slug, p.title])),
  };

  return (
    <>
      <PageHeader
        title="Notificações do app"
        description="Avisos de promoções e novidades que chegam no celular e no computador dos clientes, mesmo com o site fechado."
        actions={
          <Link href="/admin/configuracoes?aba=app" className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Configurar o convite e os avisos automáticos
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Inscritos" value={subscribers.toLocaleString("pt-BR")} icon={<BellRing />} hint={last30 ? `+${last30.toLocaleString("pt-BR")} nos últimos 30 dias` : "aparelhos que aceitaram"} />
        <StatCard label="Campanhas enviadas" value={campaigns.toLocaleString("pt-BR")} icon={<Megaphone />} hint="desde o início" />
        <div className="col-span-2 lg:col-span-1">
          <StatCard label="Total entregue" value={(delivered._sum.sentCount ?? 0).toLocaleString("pt-BR")} icon={<CheckCheck />} hint="notificações recebidas" />
        </div>
      </div>

      <PushComposer subscribers={subscribers} links={linkOptions(options)} storeName={settings.store.name} />

      <section aria-labelledby="como-inscrever" className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <Smartphone className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="como-inscrever" className="text-[15px] font-semibold">
              Como os clientes passam a receber
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Só recebe quem instalou o app da loja ou permitiu as notificações no site. O convite aparece sozinho para os visitantes
              {settings.push.promptEnabled ? ` depois de ${settings.push.promptDelaySeconds} segundos navegando` : " (hoje está desligado nas configurações)"}.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <Eyebrow>Android e computador</Eyebrow>
            <p className="mt-2 text-sm text-muted-foreground">Basta tocar em “Ativar notificações” no site (Chrome, Edge ou Firefox). Instalar o app é opcional.</p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <Eyebrow>iPhone e iPad</Eyebrow>
            <p className="mt-2 text-sm text-muted-foreground">
              Precisa do app instalado: no Safari, Compartilhar → “Adicionar à Tela de Início”, abrir pelo ícone e ativar os avisos. Exige iOS 16.4 ou mais novo.
            </p>
          </div>
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-x-1 text-[13px] text-subtle">
          Divulgue a página
          <a href="/app" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary">
            /app <ExternalLink className="size-3" aria-hidden />
          </a>
          no Instagram e no WhatsApp: ela ensina o passo a passo.
        </p>
      </section>

      <section aria-labelledby="historico" className="mt-10">
        <h2 id="historico" className="mb-3 text-lg font-semibold tracking-tight">
          Histórico de envios
        </h2>
        {history.length === 0 ? (
          <EmptyState icon={<Megaphone />} title="Nenhuma notificação enviada" description="As notificações enviadas por aqui e os avisos automáticos de promoções aparecem nesta lista." />
        ) : (
          <>
            <AdminTable>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Notificação</th>
                  <th scope="col">Link</th>
                  <th scope="col" className="text-right">
                    Enviados
                  </th>
                  <th scope="col" className="text-right">
                    Falhas
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((c) => (
                  <tr key={c.id}>
                    <td className="tabular whitespace-nowrap text-[13px] text-muted-foreground">{formatDateTime(c.sentAt ?? c.createdAt)}</td>
                    <td className="max-w-[26rem]">
                      <div className="flex items-start gap-3">
                        {c.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageUrl(c.image, "sm")} alt="" className="aspect-[2/1] w-16 shrink-0 rounded-md border border-border object-cover" loading="lazy" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{c.title}</p>
                          <p className="line-clamp-2 text-[13px] text-muted-foreground">{c.body}</p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[12rem]">
                      {c.url ? (
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[13px] text-muted-foreground hover:text-primary" title={c.url}>
                          {describeHref(c.url, names)}
                        </a>
                      ) : (
                        <span className="text-[13px] text-subtle">—</span>
                      )}
                    </td>
                    <td className="tabular text-right font-medium">{c.sentCount.toLocaleString("pt-BR")}</td>
                    <td className={`tabular text-right ${c.failedCount ? "text-warning" : "text-subtle"}`}>{c.failedCount.toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
            <Pagination className="mt-6" page={page} pageCount={pageCount} hrefFor={(p) => (p > 1 ? `/admin/notificacoes?page=${p}` : "/admin/notificacoes")} />
          </>
        )}
      </section>
    </>
  );
}
