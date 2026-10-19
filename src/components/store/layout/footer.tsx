import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import type { MenuCategory } from "@/lib/catalog";
import type { PublicSettings } from "@/lib/settings";
import { LogoWithTagline } from "@/components/brand/logo";
import { InstallAppButton } from "@/components/pwa/install-app";
import { formatCep, formatPhone } from "@/lib/format";
import { whatsappLink } from "@/lib/whatsapp";
import { FacebookIcon, InstagramIcon, TikTokIcon, WhatsAppIcon, YouTubeIcon, socialUrl } from "./social-icons";

const GREETING = "Olá! Vim pelo site da Tirvo e queria tirar uma dúvida.";

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-subtle">{children}</h2>;
}

const linkCls = "inline-flex min-h-8 items-center text-sm text-muted-foreground transition-colors hover:text-foreground";

/** Rodapé: marca, categorias, institucional, atendimento, pagamentos e dados legais. */
export function Footer({
  settings,
  categories,
  pages,
}: {
  settings: PublicSettings;
  categories: MenuCategory[];
  pages: { slug: string; title: string }[];
}) {
  const { store, address } = settings;
  const year = new Date().getFullYear();

  const socials = [
    { key: "instagram", label: "Instagram", icon: InstagramIcon, url: socialUrl("instagram", store.instagram) },
    { key: "facebook", label: "Facebook", icon: FacebookIcon, url: socialUrl("facebook", store.facebook) },
    { key: "tiktok", label: "TikTok", icon: TikTokIcon, url: socialUrl("tiktok", store.tiktok) },
    { key: "youtube", label: "YouTube", icon: YouTubeIcon, url: socialUrl("youtube", store.youtube) },
  ].filter((s) => s.url);

  const institutional = [
    ...pages.map((p) => ({ href: `/pagina/${p.slug}`, label: p.title })),
    ...(pages.some((p) => p.slug === "como-comprar") ? [] : [{ href: "/pagina/como-comprar", label: "Como comprar" }]),
    { href: "/acompanhar", label: "Acompanhar pedido" },
  ];

  const addressLine = address
    ? [
        [address.street, address.number].filter(Boolean).join(", ") + (address.complement ? ` · ${address.complement}` : ""),
        [address.neighborhood, [address.city, address.state].filter(Boolean).join("/")].filter(Boolean).join(" · "),
        address.cep ? `CEP ${formatCep(address.cep)}` : "",
      ].filter((l) => l.trim())
    : [];

  // Selos conforme as formas de pagamento ligadas no painel.
  const m = settings.payment.methods;
  const payments = [
    ...(m.includes("PIX_MANUAL") || m.includes("PIX_ON_DELIVERY") ? ["Pix"] : []),
    ...(m.includes("ONLINE_STRIPE") ? ["Cartão de crédito"] : []),
    ...(m.includes("CARD_ON_DELIVERY") ? ["Cartão na entrega"] : []),
    ...(m.includes("CASH_ON_DELIVERY") ? ["Dinheiro na entrega"] : []),
    ...(m.includes("ONLINE_STRIPE") ? ["Pagamento seguro Stripe"] : []),
  ];

  return (
    <footer className="mt-20 border-t border-border bg-card">
      <div className="container-page grid gap-10 py-12 md:grid-cols-2 md:py-16 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="space-y-5">
          <Link href="/" aria-label={`${store.name} — página inicial`} className="inline-block">
            <LogoWithTagline className="h-14" />
          </Link>
          {store.description && <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{store.description}</p>}
          <p className="flex items-center gap-2 text-sm font-medium">
            <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
            Entregamos em Curitiba e região metropolitana
          </p>
          {socials.length > 0 && (
            <ul className="flex gap-2" aria-label="Redes sociais">
              {socials.map((s) => (
                <li key={s.key}>
                  <a
                    href={s.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${store.name} no ${s.label}`}
                    className="grid size-10 place-items-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                  >
                    <s.icon className="size-[18px]" />
                  </a>
                </li>
              ))}
            </ul>
          )}
          <InstallAppButton variant="outline" size="sm" label="Baixar o app" />
        </div>

        {categories.length > 0 && (
          <nav aria-labelledby="rodape-categorias">
            <ColumnTitle>
              <span id="rodape-categorias">Categorias</span>
            </ColumnTitle>
            <ul className="space-y-1">
              {categories.slice(0, 12).map((c) => (
                <li key={c.id}>
                  <Link href={`/categoria/${c.slug}`} className={linkCls}>
                    {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/ofertas" className={`${linkCls} font-medium text-primary hover:text-primary-hover`}>
                  Ofertas
                </Link>
              </li>
            </ul>
          </nav>
        )}

        <nav aria-labelledby="rodape-institucional">
          <ColumnTitle>
            <span id="rodape-institucional">Institucional</span>
          </ColumnTitle>
          <ul className="space-y-1">
            {institutional.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkCls}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/app" className={linkCls}>
                App da {store.name}
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <ColumnTitle>Atendimento</ColumnTitle>
          <ul className="space-y-3 text-sm">
            {store.whatsapp && (
              <li>
                <a
                  href={whatsappLink(store.whatsapp, GREETING)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2.5 text-muted-foreground hover:text-foreground"
                >
                  <WhatsAppIcon className="mt-0.5 size-4 shrink-0 text-whatsapp" />
                  <span>
                    <span className="block font-medium text-foreground group-hover:text-whatsapp">WhatsApp</span>
                    {formatPhone(store.whatsapp)}
                  </span>
                </a>
              </li>
            )}
            {store.phone && (
              <li>
                <a href={`tel:+55${store.phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")}`} className="-my-1.5 flex items-start gap-2.5 py-1.5 text-muted-foreground hover:text-foreground">
                  <Phone className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
                  {formatPhone(store.phone)}
                </a>
              </li>
            )}
            {store.email && (
              <li>
                <a href={`mailto:${store.email}`} className="-my-1.5 flex items-start gap-2.5 break-all py-1.5 text-muted-foreground hover:text-foreground">
                  <Mail className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
                  {store.email}
                </a>
              </li>
            )}
            {store.businessHours && (
              <li className="flex items-start gap-2.5 text-muted-foreground">
                <Clock className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
                {store.businessHours}
              </li>
            )}
            {addressLine.length > 0 && (
              <li className="flex items-start gap-2.5 text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden />
                <address className="not-italic">
                  {addressLine.map((l) => (
                    <span key={l} className="block">
                      {l}
                    </span>
                  ))}
                </address>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
          {payments.length > 0 ? (
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">Formas de pagamento</p>
            <ul className="flex flex-wrap gap-1.5">
              {payments.map((p) => (
                <li key={p} className="rounded-lg border border-border bg-elevated px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                  {p}
                </li>
              ))}
            </ul>
          </div>
          ) : (
            <span />
          )}
          <p className="text-xs leading-relaxed text-subtle md:max-w-md md:text-right">
            © {year} {store.legalName || store.name}
            {store.cnpj ? ` · CNPJ ${store.cnpj}` : ""}. Todos os direitos reservados.
            <span className="block">{store.tagline}</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
