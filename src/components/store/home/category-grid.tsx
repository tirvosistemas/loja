import Link from "next/link";
import { CategoryIcon } from "@/components/ui/category-icon";
import { SmartImage } from "@/components/ui/smart-image";
import { pluralize } from "@/lib/format";
import { SectionHeader } from "./section-header";

type HomeCategory = { id: string; name: string; slug: string; icon: string | null; image: string | null; productCount: number };

/** Grade de categorias (rolagem lateral no celular). */
export function CategoryGrid({ categories }: { categories: HomeCategory[] }) {
  if (!categories.length) return null;
  return (
    <section id="categorias" aria-labelledby="categorias-titulo" className="container-page scroll-mt-28">
      <SectionHeader id="categorias-titulo" eyebrow="Categorias" title="Compre por categoria" />
      <ul className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 md:grid-cols-4 lg:grid-cols-6">
        {categories.map((c) => (
          <li key={c.id} className="w-[31%] min-w-[104px] shrink-0 snap-start sm:w-auto sm:min-w-0">
            <Link
              href={`/categoria/${c.slug}`}
              className="group flex h-full flex-col items-center gap-3 rounded-2xl border border-border bg-card px-3 py-4 text-center transition-[border-color,translate] duration-200 hover:-translate-y-0.5 hover:border-primary/40 sm:py-5"
            >
              {c.image ? (
                <span className="grid size-16 place-items-center overflow-hidden rounded-xl bg-well sm:size-20">
                  <SmartImage src={c.image} alt="" size="sm" sizes="80px" className="size-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-105" />
                </span>
              ) : (
                <span className="grid size-14 place-items-center rounded-xl border border-border bg-elevated text-foreground transition-colors group-hover:border-primary/30 group-hover:text-primary sm:size-16">
                  <CategoryIcon name={c.icon} className="size-6 sm:size-7" />
                </span>
              )}
              <span className="min-w-0">
                <span className="line-clamp-2 text-sm font-medium leading-tight">{c.name}</span>
                <span className="mt-1 block font-mono text-[11px] text-subtle">{pluralize(c.productCount, "produto", "produtos")}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
