import Link from "next/link";
import { ArrowRight, BellRing, Download, PackageCheck } from "lucide-react";
import { InstallAppButton } from "@/components/pwa/install-app";
import { PushToggleButton } from "@/components/pwa/push-optin";
import { Eyebrow } from "./section-header";
import { PhoneMockup } from "./phone-mockup";

/** Convite para instalar o app (PWA) e ativar as notificações de ofertas. */
export function AppSection({ vapidPublicKey, storeName }: { vapidPublicKey: string; storeName: string }) {
  const features = [
    { icon: Download, title: "Instala direto do navegador", text: "Sem loja de aplicativos e sem ocupar espaço no celular." },
    { icon: BellRing, title: "Ofertas relâmpago e cupons", text: "Receba um aviso no celular quando começar uma promoção." },
    { icon: PackageCheck, title: "Seus pedidos à mão", text: "Acompanhe cada etapa até o motoboy chegar na sua casa." },
  ];
  return (
    <section aria-labelledby="app-titulo" className="container-page">
      <div className="relative isolate overflow-hidden rounded-3xl border border-border bg-card">
        <div aria-hidden className="bg-grid absolute inset-0 -z-10 [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
        <div className="grid items-center gap-12 px-5 py-10 sm:px-10 sm:py-14 md:grid-cols-[1.15fr_1fr] lg:px-14">
          <div>
            <Eyebrow className="mb-4">App {storeName}</Eyebrow>
            <h2 id="app-titulo" className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Leve a {storeName} no bolso
            </h2>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Nosso app abre em tela cheia, carrega rápido e avisa você das melhores ofertas antes de todo mundo.
            </p>
            <ul className="mt-7 space-y-4">
              {features.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-elevated text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="block text-sm text-muted-foreground">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
            {/* No celular os dois botões ocupam a largura toda (mesmo tamanho, um embaixo do outro). */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <InstallAppButton variant="inverse" size="lg" className="max-sm:w-full" />
              <PushToggleButton vapidPublicKey={vapidPublicKey} className="h-13 px-6 text-base max-sm:w-full" />
            </div>
            <Link href="/app" className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary">
              Como instalar no Android e no iPhone <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <PhoneMockup storeName={storeName} />
        </div>
      </div>
    </section>
  );
}
