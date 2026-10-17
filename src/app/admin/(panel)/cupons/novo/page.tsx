import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import { getPickerOptions } from "@/components/admin/marketing/data";
import { CouponForm, type CouponFormValues } from "@/components/admin/marketing/coupon-form";

export const metadata: Metadata = { title: "Novo cupom" };

export default async function NewCouponPage() {
  await requireAdmin();
  const options = await getPickerOptions();
  const initial: CouponFormValues = {
    code: "",
    description: "",
    type: "PERCENT",
    percent: 10,
    fixedCents: null,
    minSubtotalCents: null,
    maxDiscountCents: null,
    usageLimit: null,
    perCustomerLimit: 1,
    firstOrderOnly: false,
    stackWithPromotions: true,
    scope: "ALL",
    categoryIds: [],
    brandIds: [],
    productIds: [],
    startsAt: null,
    endsAt: null,
    active: true,
  };
  return (
    <>
      <PageHeader title="Novo cupom" description="Defina o código, o desconto e as regras. O resumo ao lado mostra como ficou." back={{ href: "/admin/cupons", label: "Cupons" }} />
      <CouponForm id={null} initial={initial} categories={options.categories} brands={options.brands} />
    </>
  );
}
