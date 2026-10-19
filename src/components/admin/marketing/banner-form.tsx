"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { toast } from "sonner";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/ui/tabs";
import { buttonVariants } from "@/components/ui/button";
import { ImageUpload } from "@/components/admin/image-uploader";
import { Section, SettingsField } from "@/components/admin/settings/form-kit";
import { saveBannerAction } from "@/app/admin/(panel)/banners/actions";
import { cn } from "@/lib/utils";
import { BannerPreview } from "./banner-preview";
import { DateTimeField } from "./datetime-field";
import { ChoiceCards, LabelWithCount } from "./form-bits";
import { LinkPicker, type LinkKind } from "./link-picker";
import { useEntityForm } from "./use-entity-form";
import { FormFooter } from "./form-footer";

export type BannerFormValues = {
  title: string;
  subtitle: string;
  eyebrow: string;
  ctaLabel: string;
  href: string;
  imageDesktop: string | null;
  imageMobile: string | null;
  theme: "dark" | "light";
  align: "left" | "center" | "right";
  placement: "HERO" | "STRIP";
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
};

export type LinkOptions = {
  categories: { slug: string; label: string }[];
  brands: { slug: string; label: string }[];
  pages: { slug: string; label: string }[];
};

const LINK_KINDS: LinkKind[] = ["none", "ofertas", "lancamentos", "categoria", "marca", "produto", "pagina", "home", "url"];

export function BannerForm({ id, initial, links }: { id: string | null; initial: BannerFormValues; links: LinkOptions }) {
  const router = useRouter();
  const f = useEntityForm(initial, (v) => saveBannerAction(id, v), {
    onSaved: (_data, _values, message) => {
      toast.success(message ?? "Banner salvo.");
      if (!id) router.push("/admin/banners");
      else router.refresh();
    },
  });
  const { values: v, set, errors: e } = f;
  const hero = v.placement === "HERO";

  return (
    <form onSubmit={f.submit} noValidate>
      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <div className="min-w-0 space-y-5">
          <Section title="Onde aparece">
            <ChoiceCards
              name="placement"
              value={v.placement}
              onChange={(p) => set("placement", p)}
              options={[
                { value: "HERO", label: "Carrossel do topo", hint: "Banner grande no início da página inicial. Vários giram sozinhos." },
                { value: "STRIP", label: "Faixa no meio da página", hint: "Campanhas entre as vitrines de produtos (1 ou 2 por linha)." },
              ]}
            />
          </Section>

          <Section title="Imagens" description="Use fotos sem texto escrito: o título e o botão são colocados por cima, em qualquer tela.">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
              <SettingsField
                name="imageDesktop"
                label="Para computador"
                required
                error={e.imageDesktop}
                hint={hero ? "Recomendado: 1920 × 720 px." : "Recomendado: 1920 × 640 px."}
              >
                <ImageUpload
                  value={v.imageDesktop}
                  onChange={(k) => set("imageDesktop", k)}
                  folder="banners"
                  aspect={hero ? "aspect-[8/3]" : "aspect-[3/1]"}
                  label="Enviar imagem horizontal"
                />
              </SettingsField>
              <SettingsField name="imageMobile" label="Para celular (opcional)" error={e.imageMobile} hint="1080 × 1350 px, na vertical.">
                <ImageUpload
                  value={v.imageMobile}
                  onChange={(k) => set("imageMobile", k)}
                  folder="banners"
                  aspect="aspect-[4/5]"
                  label="Enviar imagem vertical"
                  hint="Opcional"
                  className="mx-auto max-w-56 sm:max-w-none"
                />
              </SettingsField>
            </div>
          </Section>

          <Section title="Textos" description="Curtos e diretos. Deixe em branco o que não quiser mostrar.">
            <SettingsField name="eyebrow" htmlFor="b-eyebrow" label={<LabelWithCount value={v.eyebrow} max={40}>Texto pequeno (acima do título)</LabelWithCount>} error={e.eyebrow}>
              <Input id="b-eyebrow" value={v.eyebrow} maxLength={60} placeholder="Ex.: Semana gamer" onChange={(x) => set("eyebrow", x.target.value)} aria-invalid={!!e.eyebrow} />
            </SettingsField>
            <SettingsField name="title" htmlFor="b-title" label={<LabelWithCount value={v.title} max={60} required>Título</LabelWithCount>} error={e.title}>
              <Input id="b-title" value={v.title} maxLength={120} placeholder="Ex.: Headsets com até 25% OFF" onChange={(x) => set("title", x.target.value)} aria-invalid={!!e.title} />
            </SettingsField>
            <SettingsField name="subtitle" htmlFor="b-subtitle" label={<LabelWithCount value={v.subtitle} max={140}>Subtítulo</LabelWithCount>} error={e.subtitle}>
              <Textarea
                id="b-subtitle"
                rows={2}
                value={v.subtitle}
                maxLength={300}
                placeholder="Ex.: Entrega rápida por motoboy em Curitiba e região."
                onChange={(x) => set("subtitle", x.target.value)}
                aria-invalid={!!e.subtitle}
              />
            </SettingsField>
          </Section>

          <Section title="Botão e link" description="Todo o banner fica clicável quando há um link. O botão aparece se tiver texto.">
            <SettingsField name="ctaLabel" htmlFor="b-cta" label={<LabelWithCount value={v.ctaLabel} max={24}>Texto do botão</LabelWithCount>} error={e.ctaLabel}>
              <Input id="b-cta" value={v.ctaLabel} maxLength={40} placeholder="Ex.: Ver ofertas" onChange={(x) => set("ctaLabel", x.target.value)} aria-invalid={!!e.ctaLabel} />
            </SettingsField>
            <SettingsField name="href" htmlFor="b-href" label="Ao clicar, abrir" error={e.href}>
              <LinkPicker id="b-href" value={v.href} onChange={(h) => set("href", h)} kinds={LINK_KINDS} invalid={!!e.href} {...links} />
            </SettingsField>
          </Section>

          <Section title="Aparência">
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div>
                <p className="mb-1.5 text-sm font-medium">Cor do texto</p>
                <Segmented<BannerFormValues["theme"]>
                  value={v.theme}
                  onChange={(t) => set("theme", t)}
                  className="flex w-full"
                  options={[
                    { value: "dark", label: <><span aria-hidden className="size-3.5 rounded-full border border-border-strong bg-white" /> Claro</> },
                    { value: "light", label: <><span aria-hidden className="size-3.5 rounded-full border border-border-strong bg-zinc-950" /> Escuro</> },
                  ]}
                />
                <p className="mt-1.5 text-[13px] text-subtle">{v.theme === "dark" ? "Texto claro, para fotos escuras." : "Texto escuro, para fotos claras."}</p>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium">Alinhamento</p>
                <Segmented<BannerFormValues["align"]>
                  value={v.align}
                  onChange={(a) => set("align", a)}
                  className="flex w-full"
                  options={[
                    { value: "left", label: <><AlignLeft className="size-4" aria-hidden /><span className="sr-only sm:not-sr-only">Esquerda</span></> },
                    { value: "center", label: <><AlignCenter className="size-4" aria-hidden /><span className="sr-only sm:not-sr-only">Centro</span></> },
                    { value: "right", label: <><AlignRight className="size-4" aria-hidden /><span className="sr-only sm:not-sr-only">Direita</span></> },
                  ]}
                />
                <p className="mt-1.5 text-[13px] text-subtle">No celular, o texto fica sempre na parte de baixo.</p>
              </div>
            </div>
          </Section>

          <Section title="Quando mostrar" description="Horário de Brasília. Deixe em branco para mostrar sempre.">
            <div className="grid gap-4 sm:grid-cols-2">
              <SettingsField name="startsAt" htmlFor="b-start" label="Início" error={e.startsAt}>
                <DateTimeField id="b-start" value={v.startsAt} onChange={(d) => set("startsAt", d)} quick="start" invalid={!!e.startsAt} />
              </SettingsField>
              <SettingsField name="endsAt" htmlFor="b-end" label="Fim" error={e.endsAt}>
                <DateTimeField id="b-end" value={v.endsAt} onChange={(d) => set("endsAt", d)} quick="end" invalid={!!e.endsAt} />
              </SettingsField>
            </div>
            <Switch checked={v.active} onChange={(c) => set("active", c)} label="Banner ativo" description="Desligue para tirar da loja sem excluir." />
          </Section>
        </div>

        <aside className={cn("order-first min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5 xl:sticky xl:top-20 xl:order-none")} aria-label="Prévia">
          <BannerPreview data={v} />
        </aside>
      </div>

      <FormFooter
        dirty={f.dirty}
        pending={f.pending}
        onReset={f.reset}
        isNew={!id}
        submitLabel={id ? "Salvar banner" : "Criar banner"}
        cancel={
          <Link href="/admin/banners" className={buttonVariants({ variant: "ghost" })}>
            Voltar
          </Link>
        }
      />
    </form>
  );
}
