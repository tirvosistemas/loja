import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { orderWhatsappMessage } from "@/lib/orders/message";
import { OrderDetailView, orderDetailInclude } from "@/components/admin/orders/order-detail";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const order = id && id.length <= 40 ? await db.order.findUnique({ where: { id }, select: { code: true } }).catch(() => null) : null;
  return { title: order ? `Pedido #${order.code}` : "Pedido" };
}

export default async function OrderDetailPage({ params }: Params) {
  await requireAdmin();
  const { id } = await params;
  if (!id || id.length > 40) notFound();
  const [order, settings] = await Promise.all([db.order.findUnique({ where: { id }, include: orderDetailInclude }), getSettings()]);
  if (!order) notFound();
  const currentMessage = await orderWhatsappMessage(order.id).catch(() => "");
  return <OrderDetailView order={order} settings={settings} currentMessage={currentMessage || null} />;
}
