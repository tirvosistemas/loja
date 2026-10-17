import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import { getPickerOptions, linkOptions } from "@/components/admin/marketing/data";
import { BannerForm, type BannerFormValues } from "@/components/admin/marketing/banner-form";

export const metadata: Metadata = { title: "Novo banner" };

type SP = Record<string, string | string[] | undefined>;

export default async function NewBannerPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const sp = await searchParams;
  const raw = Array.isArray(sp.posicao) ? sp.posicao[0] : sp.posicao;
  const placement = raw === "STRIP" ? "STRIP" : "HERO";
  const options = await getPickerOptions();
  const initial: BannerFormValues = {
    title: "",
    subtitle: "",
    eyebrow: "",
    ctaLabel: "",
    href: "/ofertas",
    imageDesktop: null,
    imageMobile: null,
    theme: "dark",
    align: "left",
    placement,
    startsAt: null,
    endsAt: null,
    active: true,
  };
  return (
    <>
      <PageHeader title="Novo banner" description="Monte o banner e acompanhe a prévia ao lado." back={{ href: "/admin/banners", label: "Banners" }} />
      <BannerForm id={null} initial={initial} links={linkOptions(options)} />
    </>
  );
}
