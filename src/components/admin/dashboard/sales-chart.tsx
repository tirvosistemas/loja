"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Table2 } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SalesPoint = { date: string; label: string; weekday: string; revenueCents: number; orders: number };

const ORANGE = "#FF5500";

// Espaços não separáveis: o rótulo do eixo não quebra em duas linhas ("R$ 22,2" / "mil").
function compactBRL(cents: number) {
  const v = cents / 100;
  if (v >= 1_000_000) return `R$\u00a0${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}\u00a0mi`;
  if (v >= 1_000) return `R$\u00a0${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}\u00a0mil`;
  return `R$\u00a0${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

type TooltipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: SalesPoint }> };

function ChartTooltip({ active, payload }: TooltipProps) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="rounded-xl border border-border-strong bg-card px-3 py-2 text-sm shadow-card">
      <p className="tabular font-semibold">{formatBRL(p.revenueCents)}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {p.weekday}, {p.label} · {p.orders === 1 ? "1 pedido" : `${p.orders} pedidos`}
      </p>
    </div>
  );
}

/** Faturamento por dia nos últimos 30 dias (pedidos não cancelados). */
export function SalesChart({ data }: { data: SalesPoint[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const empty = data.every((d) => d.revenueCents === 0);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <div role="group" aria-label="Forma de exibição" className="inline-flex rounded-lg border border-border bg-elevated p-0.5">
          {(
            [
              ["chart", "Gráfico", BarChart3],
              ["table", "Tabela", Table2],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                view === v ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden /> {label}
            </button>
          ))}
        </div>
      </div>

      {view === "chart" ? (
        <div className="relative h-64 w-full sm:h-72" role="img" aria-label="Gráfico de faturamento diário dos últimos 30 dias">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="sales-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ORANGE} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={ORANGE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tick={{ fill: "var(--subtle)", fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={24}
                tickMargin={8}
              />
              <YAxis
                width={68}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--subtle)", fontSize: 11 }}
                tickFormatter={(v: number) => compactBRL(v)}
                allowDecimals={false}
                // "auto" arredonda o topo do eixo (0, 6 mil, 12 mil, 18 mil, 24 mil) em vez de terminar no maior dia.
                domain={empty ? [0, 10000] : [0, "auto"]}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }} isAnimationActive={false} />
              <Area
                type="monotone"
                dataKey="revenueCents"
                name="Faturamento"
                stroke={ORANGE}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="url(#sales-area)"
                activeDot={{ r: 4.5, fill: ORANGE, stroke: "var(--card)", strokeWidth: 2 }}
                dot={false}
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
          {empty && (
            <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">Nenhuma venda nos últimos 30 dias.</p>
          )}
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">Faturamento e pedidos por dia, últimos 30 dias</caption>
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left text-xs text-subtle">
                <th scope="col" className="px-3 py-2 font-medium">
                  Dia
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Pedidos
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Faturamento
                </th>
              </tr>
            </thead>
            <tbody className="tabular">
              {[...data].reverse().map((d) => (
                <tr key={d.date} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    {d.label} <span className="text-subtle">· {d.weekday}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{d.orders}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{formatBRL(d.revenueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
