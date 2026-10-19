import { buttonVariants } from "@/components/ui/button";
import { whatsappLink } from "@/lib/whatsapp";
import { WhatsAppIcon } from "@/components/store/layout/social-icons";

/** Faixa final: comprar conversando pelo WhatsApp. */
export function WhatsAppBand({ phone, businessHours }: { phone: string; businessHours: string }) {
  if (!phone) return null;
  const href = whatsappLink(phone, "Olá! Vim pelo site da Tirvo e queria ajuda para escolher um produto.");
  return (
    <section aria-labelledby="wpp-titulo" className="container-page">
      <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-border bg-card px-5 py-8 sm:px-10 md:flex-row md:items-center">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-whatsapp/15 text-whatsapp">
            <WhatsAppIcon className="size-6" />
          </span>
          <div>
            <h2 id="wpp-titulo" className="text-xl font-semibold sm:text-2xl">
              Prefere comprar falando com a gente?
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Tire dúvidas sobre compatibilidade, voltagem, entrega e pagamento com uma pessoa de verdade.
              {businessHours ? ` Atendimento: ${businessHours}.` : ""}
            </p>
          </div>
        </div>
        <a href={href} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "whatsapp", size: "lg", className: "w-full shrink-0 md:w-auto" })}>
          <WhatsAppIcon className="size-5" /> Chamar no WhatsApp
        </a>
      </div>
    </section>
  );
}
