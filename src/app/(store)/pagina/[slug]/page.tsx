import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { getFooterPages } from "@/lib/catalog";
import { getPublicSettings } from "@/lib/settings";
import { whatsappLink } from "@/lib/whatsapp";
import { formatDate, formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/ui/nav";
import { Markdown } from "@/components/ui/markdown";
import { Eyebrow } from "@/components/store/catalog/headers";
import { plainExcerpt } from "@/components/store/catalog/queries";

type Props = { params: Promise<{ slug: string }> };

const getPage = cache(async (slug: string) =>
  db.page.findFirst({ where: { slug, published: true }, select: { slug: true, title: true, content: true, updatedAt: true } }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return { title: "Página não encontrada", robots: { index: false } };
  const description = plainExcerpt(page.content) || undefined;
  return {
    title: page.title,
    description,
    alternates: { canonical: `/pagina/${page.slug}` },
    openGraph: { title: page.title, description, url: `/pagina/${page.slug}` },
  };
}

export default async function InstitutionalPage({ params }: Props) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();
  const [settings, pages] = await Promise.all([getPublicSettings(), getFooterPages()]);
  const { store, address } = settings;
  const addressLine = address?.street
    ? `${address.street}${address.number ? `, ${address.number}` : ""}${address.complement ? ` · ${address.complement}` : ""} · ${address.neighborhood ? `${address.neighborhood}, ` : ""}${address.city}/${address.state}`
    : null;

  return (
    <div className="container-page pb-16 pt-4 sm:pt-6">
      <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: page.title }]} />

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14">
        <article className="min-w-0">
          <header className="border-b border-border pb-6">
            <Eyebrow>Institucional</Eyebrow>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{page.title}</h1>
            <p className="mt-3 text-sm text-subtle">
              Atualizado em <time dateTime={page.updatedAt.toISOString()}>{formatDate(page.updatedAt, { dateStyle: "long" })}</time>
            </p>
          </header>
          <div className="max-w-[70ch] pt-8">
            <Markdown
              content={page.content}
              className="space-y-5 text-[15px] leading-[1.75] sm:text-base [&_h2]:pt-4 [&_h3]:pt-3 [&_li]:pl-1 [&_ol]:space-y-2 [&_ul]:space-y-2"
            />
          </div>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-36 lg:self-start" aria-label="Atendimento">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="glow-orange pointer-events-none absolute -right-20 -top-20 size-56" aria-hidden />
            <div className="relative">
              <Eyebrow>Atendimento</Eyebrow>
              <p className="mt-3 text-lg font-semibold">Ficou com alguma dúvida?</p>
              <p className="mt-1 text-sm text-muted-foreground">Fale com a gente. Respondemos rápido pelo WhatsApp.</p>
              {store.whatsapp && (
                <a
                  href={whatsappLink(store.whatsapp, `Olá! Vim pela página “${page.title}” do site e tenho uma dúvida.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-whatsapp text-[15px] font-semibold text-[#04210f] transition hover:brightness-105"
                >
                  <MessageCircle className="size-5" aria-hidden /> Chamar no WhatsApp
                </a>
              )}
              <ul className="mt-5 space-y-3 text-sm">
                {store.phone && (
                  <li>
                    <a href={`tel:${store.phone.replace(/[^\d+]/g, "")}`} className="-my-1.5 flex items-center gap-3 py-1.5 text-muted-foreground hover:text-foreground">
                      <Phone className="size-4 shrink-0 text-subtle" aria-hidden /> {formatPhone(store.phone)}
                    </a>
                  </li>
                )}
                {store.email && (
                  <li>
                    <a href={`mailto:${store.email}`} className="-my-1.5 flex items-center gap-3 break-all py-1.5 text-muted-foreground hover:text-foreground">
                      <Mail className="size-4 shrink-0 text-subtle" aria-hidden /> {store.email}
                    </a>
                  </li>
                )}
                {store.businessHours && (
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <Clock className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden /> {store.businessHours}
                  </li>
                )}
                {addressLine && (
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden /> {addressLine}
                  </li>
                )}
              </ul>
            </div>
          </div>

          {pages.length > 1 && (
            <nav aria-label="Páginas institucionais" className="rounded-2xl border border-border p-2">
              <ul>
                {pages.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/pagina/${p.slug}`}
                      aria-current={p.slug === page.slug ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm transition-colors",
                        p.slug === page.slug ? "bg-elevated font-medium text-foreground" : "text-muted-foreground hover:bg-elevated hover:text-foreground",
                      )}
                    >
                      {p.slug === page.slug && <span className="size-1.5 rounded-full bg-primary" aria-hidden />}
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </aside>
      </div>
    </div>
  );
}
