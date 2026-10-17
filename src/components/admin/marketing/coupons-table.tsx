import Link from "next/link";
import type { Coupon } from "@prisma/client";
import { formatBRL, formatDate } from "@/lib/format";
import { CopyButton } from "@/components/admin/orders/copy-button";
import { Badge } from "@/components/ui/badge";
import { toggleCouponAction } from "@/app/admin/(panel)/cupons/actions";
import { couponValueText } from "./labels";
import { scheduleState } from "./schedule";
import { ScheduleStatus } from "./schedule-status";
import { ActiveToggle } from "./row-actions";
import { CouponRowActions } from "./coupon-row-actions";
import { ListCell, ListHeader, ListRow, ListShell } from "./list";

export type CouponRow = Pick<
  Coupon,
  "id" | "code" | "description" | "type" | "value" | "maxDiscountCents" | "minSubtotalCents" | "usageLimit" | "usedCount" | "active" | "startsAt" | "endsAt"
>;

const exhausted = (c: CouponRow) => c.usageLimit != null && c.usedCount >= c.usageLimit;

const COLS = "xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_8rem_minmax(0,1fr)_9rem]";

/** Lista de cupons: código (com copiar), desconto, usos, validade, situação e ações. */
export function CouponsTable({ rows, now }: { rows: CouponRow[]; now: Date }) {
  return (
    <ListShell>
      <ListHeader cols={COLS} labels={["Cupom", "Desconto", "Usos", "Validade", "Ações"]} />
      {rows.map((c) => {
        const pct = c.usageLimit ? Math.min(100, Math.round((c.usedCount / c.usageLimit) * 100)) : null;
        const soldOut = exhausted(c) && scheduleState(c, now) === "active";
        return (
          <ListRow key={c.id} cols={COLS}>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <Link href={`/admin/cupons/${c.id}`} className="truncate font-mono text-[15px] font-semibold tracking-wider hover:text-primary">
                  {c.code}
                </Link>
                <CopyButton text={c.code} iconOnly label={`Copiar o código ${c.code}`} toastMessage={`Código ${c.code} copiado.`} variant="ghost" className="size-10 shrink-0 sm:size-8" />
                <span className="ml-auto xl:hidden">{soldOut ? <Badge tone="danger">Esgotado</Badge> : <ScheduleStatus active={c.active} startsAt={c.startsAt} endsAt={c.endsAt} now={now} />}</span>
              </div>
              {c.description && <p className="truncate text-xs text-subtle">{c.description}</p>}
            </div>
            <ListCell label="Desconto">
              <span className="block">{couponValueText(c)}</span>
              {c.minSubtotalCents ? <span className="tabular block text-xs text-subtle">pedidos acima de {formatBRL(c.minSubtotalCents)}</span> : null}
            </ListCell>
            <ListCell label="Usos">
              <span className="tabular">
                {c.usedCount.toLocaleString("pt-BR")}
                <span className="text-subtle"> / {c.usageLimit != null ? c.usageLimit.toLocaleString("pt-BR") : "∞"}</span>
              </span>
              {pct != null && (
                <div className="mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Usos de ${c.code}`}>
                  <div className={pct >= 100 ? "h-full bg-danger" : pct >= 80 ? "h-full bg-warning" : "h-full bg-primary"} style={{ width: `${pct}%` }} />
                </div>
              )}
            </ListCell>
            <ListCell label="Validade">
              <span className="hidden xl:mb-1 xl:block">{soldOut ? <Badge tone="danger">Esgotado</Badge> : <ScheduleStatus active={c.active} startsAt={c.startsAt} endsAt={c.endsAt} now={now} />}</span>
              <span className="tabular block text-[13px] text-muted-foreground">
                {c.endsAt ? `até ${formatDate(c.endsAt)}` : "Sem validade"}
                {c.startsAt && c.startsAt > now ? ` · começa ${formatDate(c.startsAt)}` : ""}
              </span>
            </ListCell>
            <div className="flex items-center justify-between gap-2 border-t border-border pt-2 xl:justify-end xl:border-0 xl:pt-0">
              <ActiveToggle id={c.id} label={`Cupom ${c.code}`} active={c.active} action={toggleCouponAction} />
              <CouponRowActions id={c.id} code={c.code} used={c.usedCount} />
            </div>
          </ListRow>
        );
      })}
    </ListShell>
  );
}
