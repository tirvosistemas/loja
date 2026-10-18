import { notFound } from "next/navigation";
import { getBrandMeta } from "@/components/store/catalog/queries";

// Confere a marca antes do loading.tsx começar o streaming (responde 404 de verdade).
export default async function BrandLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getBrandMeta(slug))) notFound();
  return children;
}
