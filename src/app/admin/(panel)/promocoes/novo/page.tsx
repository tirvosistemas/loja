import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/page-header";
import { getPickerOptions } from "@/components/admin/marketing/data";
import { PromotionForm, type PromotionFormValues } from "@/components/admin/marketing/promotion-form";

export const metadata: Metadata = { title: "Nova promoção" };

export default async function NewPromotionPage() {
  await requireAdmin();
  const [options, settings, subscribers] = await Promise.all([getPickerOptions(), getSettings(), db.pushSubscription.count()]);
  const initial: PromotionFormValues = {
    name: "",
    description: "",
    type: "PERCENT",
    percent: 10,
    fixedCents: null,
    scope: "CATEGORY",
    categoryIds: [],
    brandIds: [],
    productIds: [],
    badge: "",
    flash: false,
    priority: 0,
    startsAt: null,
    endsAt: null,
    active: true,
  };
  return (
    <>
      <PageHeader title="Nova promoção" description="O desconto é aplicado sozinho nos produtos escolhidos durante o período." back={{ href: "/admin/promocoes", label: "Promoções" }} />
      <PromotionForm
        id={null}
        initial={initial}
        categories={options.categories}
        brands={options.brands}
        subscribers={subscribers}
        autoNotify={settings.push.autoNotifyPromotions}
      />
    </>
  );
}
