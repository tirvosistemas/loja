import { Skeleton } from "@/components/ui/card";

export function ProductPageSkeleton() {
  return (
    <div className="container-page pb-16 pt-4 sm:pt-6" role="status" aria-label="Carregando produto">
      <Skeleton className="h-4 w-64 max-w-full" />
      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
        <div className="flex flex-col gap-3 lg:flex-row-reverse lg:gap-4">
          <Skeleton className="aspect-square w-full flex-1 rounded-3xl" />
          <div className="flex gap-2 lg:w-20 lg:flex-col">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="size-16 shrink-0 lg:size-20" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-48" />
          <div className="space-y-4 rounded-2xl border border-border p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-4 w-56" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-11 w-20" />
              <Skeleton className="h-11 w-20" />
              <Skeleton className="h-11 w-20" />
            </div>
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-13 w-32" />
              <Skeleton className="h-13 flex-1" />
            </div>
            <Skeleton className="h-13 w-full" />
          </div>
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
