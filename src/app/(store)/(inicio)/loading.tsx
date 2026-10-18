import { Skeleton } from "@/components/ui/card";

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Skeleton className="aspect-square rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-3 w-1/3 rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-2/3 rounded-md" />
        <Skeleton className="mt-3 h-6 w-1/2 rounded-md" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

/** Esqueleto enquanto a página carrega. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-12 md:gap-16">
      <span className="sr-only">Carregando…</span>
      <div className="container-page pt-4 md:pt-6">
        <Skeleton className="aspect-[4/3] w-full rounded-2xl md:aspect-[1920/720] md:rounded-3xl" />
        <div className="mt-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[76px] rounded-2xl" />
          ))}
        </div>
      </div>
      <div className="container-page">
        <Skeleton className="mb-6 h-7 w-56 rounded-lg" />
        <div className="no-scrollbar flex gap-3 overflow-hidden sm:grid sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-36 w-[31%] shrink-0 rounded-2xl sm:w-auto" />
          ))}
        </div>
      </div>
      <div className="container-page">
        <Skeleton className="mb-6 h-7 w-44 rounded-lg" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={i >= 2 ? "hidden md:block" : undefined}>
              <CardSkeleton />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
