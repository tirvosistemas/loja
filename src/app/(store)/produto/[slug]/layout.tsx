import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/catalog";

// Confere se o produto existe antes do loading.tsx começar o streaming:
// assim um endereço inválido responde 404 de verdade (e não 200 com a tela de "não encontrado").
// getProductBySlug usa cache(): a página reaproveita a mesma consulta.
export default async function ProductLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getProductBySlug(slug))) notFound();
  return children;
}
