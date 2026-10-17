import { Skeleton } from "@/components/ui/card";

// Esqueletos de carregamento das listagens (usados nos loading.tsx).

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card" aria-hidden>
      <Skeleton className="aspect-square rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-3 h-6 w-28" />
        <Skeleton className="h-3 w-36" />
        <Skeleton className="mt-2 h-10 w-full" />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ListingSkeleton({ banner }: { banner?: boolean }) {
  return (
    <div className="container-page pb-16 pt-4 sm:pt-6" role="status" aria-label="Carregando produtos">
      <Skeleton className="h-4 w-48" />
      {banner ? (
        <Skeleton className="mt-5 h-44 w-full rounded-3xl sm:h-52" />
      ) : (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      )}
      <div className="mt-8 lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10">
        <div className="hidden space-y-4 lg:block">
          <Skeleton className="h-4 w-20" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
          <Skeleton className="mt-6 h-4 w-24" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div>
          <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
            <Skeleton className="h-5 w-28" />
            <div className="flex gap-2">
              <Skeleton className="h-11 w-24 lg:hidden" />
              <Skeleton className="h-11 w-44" />
            </div>
          </div>
          <div className="pt-5">
            <GridSkeleton />
          </div>
        </div>
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
