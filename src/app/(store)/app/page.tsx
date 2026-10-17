import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BellRing, Download, EllipsisVertical, Gauge, Laptop, MonitorSmartphone, PackageCheck, Share, Smartphone, SquarePlus, WifiOff } from "lucide-react";
import { getPublicSettings } from "@/lib/settings";
import { InstallAppButton } from "@/components/pwa/install-app";
import { PushToggleButton } from "@/components/pwa/push-optin";
import { Breadcrumbs } from "@/components/ui/nav";
import { buttonVariants } from "@/components/ui/button";
import { Eyebrow } from "@/components/store/home/section-header";
import { PhoneMockup } from "@/components/store/home/phone-mockup";
import { PushSupportHint } from "@/components/store/home/push-support-hint";
import { getStoreVapidKey } from "@/components/store/layout/vapid";

export async function generateMetadata(): Promise<Metadata> {
  const { store } = await getPublicSettings();
  return {
    title: "Baixe o app",
    description: `Instale o app da ${store.name} direto do navegador, receba ofertas relâmpago e cupons por notificação e acompanhe seus pedidos.`,
    alternates: { canonical: "/app" },
  };
}

type Step = { icon: React.ComponentType<{ className?: string }>; text: React.ReactNode };

function StepsCard({ id, icon: Icon, title, subtitle, steps, note }: { id: string; icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string; steps: Step[]; note?: React.ReactNode }) {
  return (
    <article aria-labelledby={id} className="flex flex-col rounded-3xl border border-border bg-card p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl border border-border bg-elevated text-foreground">
          <Icon className="size-5" />
        </span>
        <div>
          <h3 id={id} className="text-lg font-semibold">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <ol className="mt-6 space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3.5">
            <span className="tabular grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft font-mono text-sm font-semibold text-primary">{i + 1}</span>
            <span className="flex flex-1 items-start gap-2 pt-1 text-sm leading-relaxed">
              <s.icon className="mt-0.5 size-4 shrink-0 text-subtle" />
              <span>{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
      {note && <div className="mt-6 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm leading-relaxed text-foreground">{note}</div>}
    </article>
  );
}

export default async function AppPage() {
  const [settings, vapidPublicKey] = await Promise.all([getPublicSettings(), getStoreVapidKey()]);
  const name = settings.store.name;

  const faq = [
    {
      q: "Preciso baixar na Play Store ou na App Store?",
      a: `Não. O app da ${name} é instalado direto pelo navegador, em poucos segundos. Ele aparece na tela inicial com o nosso ícone e abre em tela cheia, como qualquer aplicativo.`,
    },
    {
      q: "Ocupa espaço no celular? Tem custo?",
      a: "É grátis e muito leve: usa bem menos espaço do que um aplicativo comum e se atualiza sozinho, sem você precisar fazer nada.",
    },
    {
      q: "Por que não recebo notificações no iPhone?",
      a: "No iPhone, as notificações só funcionam com o app adicionado à Tela de Início (iOS 16.4 ou mais recente). Instale pelo Safari, abra a loja pelo ícone novo e toque em “Ativar avisos de ofertas”.",
    },
    {
      q: "Que tipo de notificação vou receber?",
      a: "Só o que vale a pena: início de ofertas relâmpago, cupons e promoções especiais. Nada de mensagens a toda hora.",
    },
    {
      q: "Como desativo as notificações?",
      a: "Nesta página, toque em “Notificações ativas” para desligar. Você também pode bloquear pelas configurações do navegador ou do celular a qualquer momento.",
    },
    {
      q: "O app funciona sem internet?",
      a: "Para comprar é preciso estar conectado, mas o seu carrinho fica salvo no aparelho. Se a internet cair, é só continuar de onde parou quando ela voltar.",
    },
    {
      q: "Posso comprar pelo app do mesmo jeito que no site?",
      a: "Sim. É a mesma loja, com os mesmos preços, frete calculado pelo CEP e as mesmas formas de pagamento, inclusive pagar na entrega.",
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  const benefits = [
    { icon: BellRing, title: "Ofertas antes de todo mundo", text: "Aviso no celular quando começar uma oferta relâmpago ou sair um cupom." },
    { icon: PackageCheck, title: "Pedidos sempre à mão", text: "Acompanhe cada etapa, da separação até o motoboy chegar." },
    { icon: Gauge, title: "Rápido e leve", text: "Abre em tela cheia, carrega rápido e quase não ocupa espaço." },
    { icon: WifiOff, title: "Carrinho guardado", text: "Mesmo com a internet instável, seus itens continuam salvos." },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="container-page pt-5">
        <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "App" }]} />
      </div>

      {/* Destaque */}
      <section aria-labelledby="app-titulo" className="container-page pt-6">
        <div className="relative isolate overflow-hidden rounded-3xl border border-border bg-card">
          <div aria-hidden className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]" />
          <div className="grid items-center gap-12 px-5 py-10 sm:px-10 sm:py-14 md:grid-cols-[1.2fr_1fr] lg:px-14 lg:py-16">
            <div>
              <Eyebrow className="mb-4">App {name}</Eyebrow>
              <h1 id="app-titulo" className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                A {name} no seu celular, <span className="text-primary">como um app</span>
              </h1>
              <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
                Instale direto do navegador, sem loja de aplicativos. Receba ofertas relâmpago e cupons por notificação e acompanhe seus pedidos com um toque.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <InstallAppButton variant="primary" size="lg" label="Instalar o app" />
                <PushToggleButton vapidPublicKey={vapidPublicKey} className="h-13 px-6 text-base" />
              </div>
              <p className="mt-4 text-sm text-subtle">Grátis · funciona em Android, iPhone e computador.</p>
            </div>
            <PhoneMockup storeName={name} />
          </div>
        </div>
      </section>

      {/* Vantagens */}
      <section aria-label="Vantagens do app" className="container-page mt-12 md:mt-16">
        <ul className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map(({ icon: Icon, title, text }) => (
            <li key={title} className="bg-card p-5">
              <Icon className="size-5 text-primary" aria-hidden />
              <p className="mt-3 font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Passo a passo */}
      <section aria-labelledby="como-instalar" className="container-page mt-16 md:mt-24">
        <Eyebrow className="mb-2">Passo a passo</Eyebrow>
        <h2 id="como-instalar" className="text-2xl font-semibold sm:text-3xl">
          Como instalar
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">Leva menos de um minuto. Escolha o seu aparelho:</p>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <StepsCard
            id="passo-android"
            icon={Smartphone}
            title="Android (Chrome)"
            subtitle="Samsung, Motorola, Xiaomi e outros"
            steps={[
              { icon: Download, text: <>Toque em <b>Instalar o app</b> aqui nesta página.</> },
              { icon: EllipsisVertical, text: <>Se o botão não aparecer, abra o menu do Chrome (<b>⋮</b>) e escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</> },
              { icon: SquarePlus, text: <>Confirme em <b>Instalar</b>. O ícone da {name} aparece na sua tela inicial.</> },
              { icon: BellRing, text: <>Abra o app e toque em <b>Ativar avisos de ofertas</b>.</> },
            ]}
          />
          <StepsCard
            id="passo-iphone"
            icon={Smartphone}
            title="iPhone (Safari)"
            subtitle="iOS 16.4 ou mais recente para notificações"
            steps={[
              { icon: MonitorSmartphone, text: <>Abra esta página no <b>Safari</b>.</> },
              { icon: Share, text: <>Toque em <b>Compartilhar</b> (o quadrado com a seta para cima).</> },
              { icon: SquarePlus, text: <>Role e escolha <b>Adicionar à Tela de Início</b>, depois toque em <b>Adicionar</b>.</> },
              { icon: BellRing, text: <>Abra a {name} pelo ícone novo e toque em <b>Ativar avisos de ofertas</b>.</> },
            ]}
            note={
              <>
                <b>Importante no iPhone:</b> as notificações só funcionam depois que o app é adicionado à Tela de Início e aberto por lá. Pelo Safari comum, o iPhone não permite avisos.
              </>
            }
          />
        </div>
        <div className="mt-4 flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border bg-elevated">
              <Laptop className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-lg font-semibold">No computador (Chrome ou Edge)</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Clique no ícone de instalar na barra de endereço (à direita) ou use o botão abaixo. A loja abre em uma janela própria.
              </p>
            </div>
          </div>
          <InstallAppButton variant="outline" label="Instalar no computador" className="shrink-0" />
        </div>
      </section>

      {/* Notificações */}
      <section aria-labelledby="avisos-titulo" className="container-page mt-16 md:mt-24">
        <div className="relative isolate overflow-hidden rounded-3xl border border-border bg-card px-5 py-10 text-center sm:px-10">
          <div aria-hidden className="glow-orange absolute left-1/2 top-0 -z-10 size-[420px] -translate-x-1/2 -translate-y-1/2" />
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
            <BellRing className="size-6" aria-hidden />
          </span>
          <h2 id="avisos-titulo" className="mt-4 text-2xl font-semibold sm:text-3xl">
            Ative os avisos de ofertas
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
            Só mandamos o que vale a pena: ofertas relâmpago, cupons e promoções especiais. Você desliga quando quiser.
          </p>
          <div className="mt-6 flex justify-center">
            <PushToggleButton vapidPublicKey={vapidPublicKey} className="h-13 px-6 text-base" />
          </div>
          <PushSupportHint className="mx-auto mt-4 max-w-md justify-center text-left" />
          {!vapidPublicKey && <p className="mt-4 text-sm text-subtle">As notificações ainda não estão disponíveis. Volte em breve.</p>}
        </div>
      </section>

      {/* Perguntas */}
      <section aria-labelledby="faq-titulo" className="container-page mt-16 md:mt-24">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <Eyebrow className="mb-2">Dúvidas</Eyebrow>
            <h2 id="faq-titulo" className="text-2xl font-semibold sm:text-3xl">
              Perguntas frequentes
            </h2>
            <p className="mt-2 text-muted-foreground">Ficou alguma dúvida? Fale com a gente pelo WhatsApp.</p>
            <Link href="/" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
              Voltar às compras <ArrowRight aria-hidden />
            </Link>
          </div>
          <div className="divide-y divide-border rounded-3xl border border-border bg-card">
            {faq.map((f) => (
              <details key={f.q} className="group px-5 sm:px-6">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-lg border border-border text-subtle transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
