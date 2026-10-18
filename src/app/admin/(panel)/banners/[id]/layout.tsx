import { notFound } from "next/navigation";
import { db } from "@/lib/db";

// Confere se o banner existe antes do loading.tsx começar o streaming: assim o id desconhecido responde 404 de verdade.
export default async function BannerLayout({ children, params }: LayoutProps<"/admin/banners/[id]">) {
  const { id } = await params;
  const found = await db.banner.findUnique({ where: { id: id.slice(0, 40) }, select: { id: true } });
  if (!found) notFound();
  return children;
}
