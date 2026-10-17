import type { Metadata } from "next";
import { MessageCircle, PackageSearch, RefreshCw } from "lucide-react";
import { ListingHeader } from "@/components/store/catalog/headers";
import { DeviceOrders } from "@/components/store/order/device-orders";
import { LookupForm } from "@/components/store/order/lookup-form";

export const metadata: Metadata = {
  title: "Acompanhar pedido",
  description: "Veja o status do seu pedido na Tirvo com o código e o WhatsApp usado na compra.",
  alternates: { canonical: "/acompanhar" },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TrackPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.codigo) ? sp.codigo[0] : sp.codigo;
  const initialCode = (raw ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 16);

  return (
    <div className="container-page pb-16 pt-4 sm:pt-6">
      <ListingHeader
        breadcrumbs={[{ label: "Início", href: "/" }, { label: "Acompanhar pedido" }]}
        eyebrow="Pós-compra"
        title="Acompanhar pedido"
        description="Digite o código do pedido e o WhatsApp usado na compra para ver o status em tempo real."
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:gap-8">
        <section aria-labelledby="busca-pedido" className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-8">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
          <div className="relative max-w-md">
            <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
              <PackageSearch className="size-6" aria-hidden />
            </span>
            <h2 id="busca-pedido" className="mt-5 text-xl font-semibold">
              Encontre seu pedido
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Por segurança, pedimos os dois dados juntos.</p>
            <div className="mt-6">
              <LookupForm initialCode={initialCode} />
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <DeviceOrders />
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-3 rounded-2xl border border-border px-4 py-3.5">
              <RefreshCw className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span className="text-muted-foreground">
                A página do pedido atualiza sozinha: confirmação, separação, saída do motoboy e entrega.
              </span>
            </li>
            <li className="flex items-start gap-3 rounded-2xl border border-border px-4 py-3.5">
              <MessageCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span className="text-muted-foreground">
                Não achou o código? Ele vem na mensagem do pedido no WhatsApp, logo no título: <span className="font-mono text-foreground">#TV…</span>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
