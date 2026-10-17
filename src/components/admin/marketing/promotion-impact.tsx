"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Countdown } from "@/components/ui/countdown";
import { Price } from "@/components/ui/price";
import { imageUrl } from "@/lib/images";
import { formatBRL } from "@/lib/format";
import { previewPromotionAction, type PromotionPreview } from "@/app/admin/(panel)/promocoes/actions";
import type { ScopeValue } from "./scope-fields";

/** Quantos produtos a promoção alcança e como fica o preço de um deles (atualiza enquanto edita). */
export function PromotionImpact({
  type,
  value,
  scope,
  excludeId,
  badge,
  flash,
  endsAt,
}: {
  type: "PERCENT" | "FIXED";
  value: number;
  scope: ScopeValue;
  excludeId: string | null;
  badge: string;
  flash: boolean;
  endsAt: string | null;
}) {
  const [data, setData] = useState<PromotionPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const key = JSON.stringify({ type, value, scope, excludeId });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const input = JSON.parse(key) as { type: "PERCENT" | "FIXED"; value: number; scope: ScopeValue; excludeId: string | null };
        const r = await previewPromotionAction({ type: input.type, value: Math.max(0, input.value), excludeId: input.excludeId, ...input.scope });
        if (!alive) return;
        if (r.ok && r.data) {
          setData(r.data);
          setError(false);
        } else setError(true);
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [key]);

  const ex = data?.example;
  const showBadge = badge.trim();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">
          <span aria-hidden className="size-1.5 rounded-full bg-primary" />
          Impacto na loja
        </p>
        {loading && <Loader2 className="size-4 animate-spin text-subtle" aria-label="Calculando" />}
      </div>

      <div aria-live="polite">
        {error && !data ? (
          <p className="text-sm text-danger">Não foi possível calcular a prévia agora.</p>
        ) : data ? (
          <p className="text-sm text-muted-foreground">
            <span className="tabular block text-3xl font-semibold tracking-tight text-foreground">{data.count.toLocaleString("pt-BR")}</span>
            {data.count === 1 ? "produto ativo recebe" : "produtos ativos recebem"} este desconto
            {scope.scope !== "ALL" && data.totalActive > 0 && <> ({Math.round((data.count / data.totalActive) * 100)}% da loja)</>}.
          </p>
        ) : (
          <div className="h-16 animate-pulse rounded-xl bg-elevated" />
        )}
      </div>

      {ex ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-background">
          <div className="relative aspect-[4/3] bg-well">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl(ex.image, "sm")} alt="" className="size-full object-contain p-5" />
            <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
              {ex.discountPercent > 0 && <Badge tone="solid">-{ex.discountPercent}%</Badge>}
              {flash ? (
                <Badge tone="inverse">
                  <Zap aria-hidden /> Relâmpago
                </Badge>
              ) : (
                showBadge && <Badge tone="inverse">{showBadge}</Badge>
              )}
            </div>
          </div>
          <div className="space-y-2 p-4">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-subtle">Exemplo</p>
            <p className="line-clamp-2 text-[15px] font-medium leading-snug">{ex.name}</p>
            <Price priceCents={ex.priceCents} compareAtCents={ex.compareAtCents} showPix={false} />
            {flash && endsAt && new Date(endsAt) > new Date() && (
              <div className="pt-1">
                <p className="mb-1 text-xs text-muted-foreground">Termina em</p>
                <Countdown endsAt={endsAt} />
              </div>
            )}
          </div>
        </div>
      ) : data && data.count === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
          {data.totalActive === 0 ? "Ainda não há produtos ativos na loja." : "Nenhum produto ativo no escopo escolhido."}
        </p>
      ) : null}

      {ex && ex.priceCents === 0 && (
        <p className="flex gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> Com esse desconto o produto sai de graça. Confira o valor.
        </p>
      )}
      {ex && type === "FIXED" && ex.priceCents > 0 && value >= ex.basePriceCents * 0.5 && (
        <p className="flex gap-2 rounded-xl border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden /> {formatBRL(value)} é mais da metade do preço deste produto.
        </p>
      )}
      {ex?.winner && (
        <p className="rounded-xl border border-info/30 bg-info-soft px-3 py-2.5 text-sm text-foreground">
          Neste produto vale “{ex.winner}”, que já dá um preço menor. Quando duas promoções alcançam o mesmo produto, o cliente paga o menor preço.
        </p>
      )}
    </div>
  );
}
