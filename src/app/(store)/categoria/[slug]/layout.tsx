import { notFound } from "next/navigation";
import { getCategoryMeta } from "@/components/store/catalog/queries";

// Confere a categoria antes do loading.tsx começar o streaming (responde 404 de verdade).
export default async function CategoryLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getCategoryMeta(slug))) notFound();
  return children;
}
