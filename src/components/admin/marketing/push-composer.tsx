"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { ImageUpload } from "@/components/admin/image-uploader";
import { Callout } from "@/components/admin/settings/form-kit";
import { sendCampaignAction } from "@/app/admin/(panel)/notificacoes/actions";
import { pluralize } from "@/lib/format";
import { LabelWithCount } from "./form-bits";
import { PUSH_BODY_MAX, PUSH_TITLE_MAX } from "./labels";
import { LinkPicker, type LinkKind } from "./link-picker";
import { PushPreview } from "./push-preview";
import type { LinkOptions } from "./banner-form";

const KINDS: LinkKind[] = ["home", "ofertas", "lancamentos", "categoria", "marca", "produto", "pagina", "url"];
const EMPTY = { title: "", body: "", url: "/ofertas", image: null as string | null };
const count = (s: string) => [...s.trim()].length;

/** Escrever e enviar uma notificação para todos os inscritos, com prévia no Android e no iPhone. */
export function PushComposer({ subscribers, links, storeName }: { subscribers: number; links: LinkOptions; storeName: string }) {
  const router = useRouter();
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  const set = <K extends keyof typeof EMPTY>(k: K, value: (typeof EMPTY)[K]) => {
    setV((s) => ({ ...s, [k]: value }));
    setErrors((e) => {
      if (!e[k]) return e;
      const { [k]: _removed, ...rest } = e;
      return rest;
    });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!count(v.title)) e.title = "Escreva o título.";
    else if (count(v.title) > PUSH_TITLE_MAX) e.title = `Use até ${PUSH_TITLE_MAX} caracteres.`;
    if (!count(v.body)) e.body = "Escreva a mensagem.";
    else if (count(v.body) > PUSH_BODY_MAX) e.body = `Use até ${PUSH_BODY_MAX} caracteres.`;
    if (!v.url) e.url = "Escolha para onde o toque leva o cliente.";
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) document.getElementById(`push-${first}`)?.focus();
    return !first;
  };

  const send = () =>
    start(async () => {
      try {
        const r = await sendCampaignAction({ title: v.title, body: v.body, url: v.url, image: v.image });
        if (!r.ok) {
          setErrors(r.fieldErrors ?? {});
          toast.error(r.error);
          setConfirm(false);
          return;
        }
        const d = r.data;
        if (d && d.failed > 0) toast.success(r.message ?? "Enviado.", { description: `${pluralize(d.failed, "aparelho não recebeu", "aparelhos não receberam")} (saíram ou bloquearam os avisos).` });
        else toast.success(r.message ?? "Enviado.");
        setConfirm(false);
        setV(EMPTY);
        router.refresh();
      } catch {
        toast.error("Falha de conexão. Tente de novo.");
      }
    });

  const disabled = subscribers === 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled && validate()) setConfirm(true);
        }}
        className="min-w-0 space-y-5 rounded-2xl border border-border bg-card p-5"
      >
        <div>
          <h2 className="text-[15px] font-semibold">Nova notificação</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Curta e direta: o que é, quanto custa, até quando.</p>
        </div>

        <Field label={<LabelWithCount value={v.title} max={PUSH_TITLE_MAX} required>Título</LabelWithCount>} htmlFor="push-title" error={errors.title}>
          <Input id="push-title" value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: 🔥 Air fryers com 20% OFF" aria-invalid={!!errors.title} />
        </Field>
        <Field label={<LabelWithCount value={v.body} max={PUSH_BODY_MAX} required>Mensagem</LabelWithCount>} htmlFor="push-body" error={errors.body}>
          <Textarea id="push-body" rows={3} value={v.body} onChange={(e) => set("body", e.target.value)} placeholder="Ex.: Só até domingo, com entrega no mesmo dia em Curitiba." aria-invalid={!!errors.body} />
        </Field>
        <Field label="Ao tocar, abrir" htmlFor="push-url" error={errors.url}>
          <LinkPicker id="push-url" value={v.url} onChange={(h) => set("url", h)} kinds={KINDS} invalid={!!errors.url} {...links} />
        </Field>
        <Field label="Imagem (opcional)" hint="Aparece grande no Android. Use uma imagem horizontal (2:1), sem texto miúdo." error={errors.image}>
          <ImageUpload value={v.image} onChange={(k) => set("image", k)} folder="push" aspect="aspect-[2/1]" label="Enviar imagem" className="max-w-md" />
        </Field>

        {disabled ? (
          <Callout title="Ninguém inscrito ainda">O envio fica disponível quando o primeiro cliente ativar as notificações (veja como abaixo).</Callout>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">{disabled ? "Sem inscritos" : `Vai para ${pluralize(subscribers, "aparelho inscrito", "aparelhos inscritos")}.`}</p>
          <Button type="submit" disabled={disabled}>
            <Send aria-hidden /> Enviar agora para {subscribers.toLocaleString("pt-BR")} {subscribers === 1 ? "inscrito" : "inscritos"}
          </Button>
        </div>
      </form>

      <aside className="min-w-0 rounded-2xl border border-border bg-card p-5 xl:sticky xl:top-20" aria-label="Prévia da notificação">
        <p className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
          <span aria-hidden className="size-1.5 animate-pulse-dot rounded-full bg-primary" />
          Prévia
        </p>
        <PushPreview title={v.title.trim()} body={v.body.trim()} image={v.image} storeName={storeName} />
      </aside>

      <Dialog
        open={confirm}
        onClose={() => !pending && setConfirm(false)}
        title="Enviar notificação?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={send} loading={pending}>
              <Send aria-hidden /> Enviar agora
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          “<span className="font-medium text-foreground">{v.title.trim()}</span>” vai para {pluralize(subscribers, "aparelho", "aparelhos")} agora. Depois de enviada, não dá para cancelar.
        </p>
      </Dialog>
    </div>
  );
}
