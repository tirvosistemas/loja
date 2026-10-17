import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/format";
import { jsonIds } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import { getPickerOptions } from "@/components/admin/marketing/data";
import { PromotionForm, type PromotionFormValues } from "@/components/admin/marketing/promotion-form";
import { ScheduleStatus } from "@/components/admin/marketing/schedule-status";

export const metadata: Metadata = { title: "Editar promoção" };

export default async function EditPromotionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [promo, options, settings, subscribers] = await Promise.all([
    db.promotion.findUnique({ where: { id: id.slice(0, 40) } }),
    getPickerOptions(),
    getSettings(),
    db.pushSubscription.count(),
  ]);
  if (!promo) notFound();
  const initial: PromotionFormValues = {
    name: promo.name,
    description: promo.description ?? "",
    type: promo.type,
    percent: promo.type === "PERCENT" ? promo.value : null,
    fixedCents: promo.type === "FIXED" ? promo.value : null,
    scope: promo.scope,
    categoryIds: jsonIds(promo.categoryIds),
    brandIds: jsonIds(promo.brandIds),
    productIds: jsonIds(promo.productIds),
    badge: promo.badge ?? "",
    flash: promo.flash,
    priority: promo.priority,
    startsAt: promo.startsAt?.toISOString() ?? null,
    endsAt: promo.endsAt?.toISOString() ?? null,
    active: promo.active,
  };
  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 break-words">{promo.name}</span>
            <ScheduleStatus active={promo.active} startsAt={promo.startsAt} endsAt={promo.endsAt} feminine />
          </span>
        }
        description={`Criada em ${formatDateTime(promo.createdAt)} · atualizada em ${formatDateTime(promo.updatedAt)}`}
        back={{ href: "/admin/promocoes", label: "Promoções" }}
      />
      <PromotionForm
        id={promo.id}
        initial={initial}
        categories={options.categories}
        brands={options.brands}
        subscribers={subscribers}
        autoNotify={settings.push.autoNotifyPromotions}
      />
    </>
  );
}
