import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PrintSlip } from "@/components/admin/orders/print-slip";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const order = id && id.length <= 40 ? await db.order.findUnique({ where: { id }, select: { code: true } }).catch(() => null) : null;
  return { title: order ? `Imprimir pedido #${order.code}` : "Imprimir pedido" };
}

export default async function PrintOrderPage({ params, searchParams }: Props) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!id || id.length > 40) notFound();
  const [order, settings] = await Promise.all([db.order.findUnique({ where: { id }, include: { items: { orderBy: { id: "asc" } } } }), getSettings()]);
  if (!order) notFound();
  const auto = (Array.isArray(sp.auto) ? sp.auto[0] : sp.auto) === "1";
  return <PrintSlip order={order} settings={settings} auto={auto} />;
}
