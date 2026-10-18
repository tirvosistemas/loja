import { notFound } from "next/navigation";
import { db } from "@/lib/db";

// Confere se o produto existe antes do loading.tsx começar o streaming: assim o id desconhecido responde 404 de verdade.
export default async function ProductLayout({ children, params }: LayoutProps<"/admin/produtos/[id]">) {
  const { id } = await params;
  const found = /^[\w-]{1,40}$/.test(id) ? await db.product.findUnique({ where: { id }, select: { id: true } }) : null;
  if (!found) notFound();
  return children;
}
