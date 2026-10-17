import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { getPickerOptions, linkOptions } from "@/components/admin/marketing/data";
import { BannerForm, type BannerFormValues } from "@/components/admin/marketing/banner-form";
import { ScheduleStatus } from "@/components/admin/marketing/schedule-status";

export const metadata: Metadata = { title: "Editar banner" };

export default async function EditBannerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [banner, options] = await Promise.all([db.banner.findUnique({ where: { id: id.slice(0, 40) } }), getPickerOptions()]);
  if (!banner) notFound();
  const initial: BannerFormValues = {
    title: banner.title,
    subtitle: banner.subtitle ?? "",
    eyebrow: banner.eyebrow ?? "",
    ctaLabel: banner.ctaLabel ?? "",
    href: banner.href ?? "",
    imageDesktop: banner.imageDesktop,
    imageMobile: banner.imageMobile,
    theme: banner.theme === "light" ? "light" : "dark",
    align: banner.align === "center" || banner.align === "right" ? banner.align : "left",
    placement: banner.placement,
    startsAt: banner.startsAt?.toISOString() ?? null,
    endsAt: banner.endsAt?.toISOString() ?? null,
    active: banner.active,
  };
  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 break-words">{banner.title}</span>
            <ScheduleStatus active={banner.active} startsAt={banner.startsAt} endsAt={banner.endsAt} />
          </span>
        }
        description={`Atualizado em ${formatDateTime(banner.updatedAt)}`}
        back={{ href: "/admin/banners", label: "Banners" }}
      />
      <BannerForm id={banner.id} initial={initial} links={linkOptions(options)} />
    </>
  );
}
