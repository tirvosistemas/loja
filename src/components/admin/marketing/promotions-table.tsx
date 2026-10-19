import Link from "next/link";
import { Zap } from "lucide-react";
import type { DiscountScope, DiscountType } from "@prisma/client";
import { pluralize } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { togglePromotionAction } from "@/app/admin/(panel)/promocoes/actions";
import { discountText, scopeSummary } from "./labels";
import { shortDateTime } from "./schedule";
import { ScheduleStatus } from "./schedule-status";
import { ActiveToggle } from "./row-actions";
import { PromotionRowActions } from "./promotion-row-actions";
import { ListCell, ListHeader, ListRow, ListShell } from "./list";

export type PromotionRow = {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  scope: DiscountScope;
  categoryIds: string[];
  brandIds: string[];
  productIds: string[];
  flash: boolean;
  badge: string | null;
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  affected: number;
};

/** Nomes para a coluna de escopo: "Headsets Gamer, Controles +2". */
function names(ids: string[], map: Map<string, string>) {
  const list = ids.map((id) => map.get(id)).filter((n): n is string => !!n);
  if (!list.length) return null;
  return list.length > 2 ? `${list.slice(0, 2).join(", ")} +${list.length - 2}` : list.join(", ");
}

const COLS = "xl:grid-cols-[minmax(0,1.5fr)_6.5rem_minmax(0,1.2fr)_9.5rem_11.5rem]";

/** Lista de promoções: situação, desconto, escopo, alcance, período e ações. */
export function PromotionsTable({ rows, now, catNames, brandNames }: { rows: PromotionRow[]; now: Date; catNames: Map<string, string>; brandNames: Map<string, string> }) {
  return (
    <ListShell>
      <ListHeader cols={COLS} labels={["Promoção", "Desconto", "Vale para", "Período", "Ações"]} />
      {rows.map((p) => {
        const scopeNames = p.scope === "CATEGORY" ? names(p.categoryIds, catNames) : p.scope === "BRAND" ? names(p.brandIds, brandNames) : null;
        return (
          <ListRow key={p.id} cols={COLS}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <ScheduleStatus active={p.active} startsAt={p.startsAt} endsAt={p.endsAt} now={now} feminine />
                {p.flash && (
                  <Badge tone="accent">
                    <Zap aria-hidden /> Relâmpago
                  </Badge>
                )}
                {p.badge && <Badge>{p.badge}</Badge>}
              </div>
              <Link href={`/admin/promocoes/${p.id}`} className="mt-1.5 block truncate font-medium hover:text-primary">
                {p.name}
              </Link>
            </div>
            <ListCell label="Desconto">
              <span className="tabular font-semibold">{discountText(p.type, p.value)}</span>
            </ListCell>
            <ListCell label="Vale para">
              <span className="block truncate">{scopeSummary(p.scope, p)}</span>
              <span className="block truncate text-xs text-subtle">
                {scopeNames ? `${scopeNames} · ` : ""}
                {pluralize(p.affected, "produto ativo", "produtos ativos")}
              </span>
            </ListCell>
            <ListCell label="Período">
              <span className="tabular text-[13px] text-muted-foreground">
                {p.startsAt || p.endsAt ? (
                  <>
                    <span className="block">{p.startsAt ? `de ${shortDateTime(p.startsAt)}` : "desde já"}</span>
                    <span className="block">{p.endsAt ? `até ${shortDateTime(p.endsAt)}` : "sem data de fim"}</span>
                  </>
                ) : (
                  "Sem prazo"
                )}
              </span>
            </ListCell>
            <div className="flex items-center justify-between gap-2 border-t border-border pt-2 xl:justify-end xl:border-0 xl:pt-0">
              <ActiveToggle id={p.id} label={p.name} active={p.active} action={togglePromotionAction} feminine />
              <PromotionRowActions id={p.id} name={p.name} />
            </div>
          </ListRow>
        );
      })}
    </ListShell>
  );
}
