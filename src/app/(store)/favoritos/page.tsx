import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingHeader } from "@/components/store/catalog/headers";
import { FavoritesView } from "@/components/store/catalog/favorites-view";
import { GridSkeleton } from "@/components/store/catalog/skeletons";

export const metadata: Metadata = {
  title: "Favoritos",
  description: "Os produtos que você salvou para comprar depois.",
  robots: { index: false, follow: true },
};

export default function FavoritesPage() {
  return (
    <div className="container-page pb-16 pt-4 sm:pt-6">
      <ListingHeader
        breadcrumbs={[{ label: "Início", href: "/" }, { label: "Favoritos" }]}
        eyebrow="Sua lista"
        title="Favoritos"
        description="Os produtos que você salvou para comparar e comprar depois."
      />
      <div className="mt-8">
        <Suspense fallback={<GridSkeleton count={4} />}>
          <FavoritesView />
        </Suspense>
      </div>
    </div>
  );
}
