import { Skeleton } from "@/components/ui/card";

// Esqueletos exibidos enquanto as páginas do catálogo carregam.

export function ListSkeleton({ rows = 6, filters = true }: { rows?: number; filters?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-11 w-40" />
      </div>
      {filters && (
        <div className="mb-5 flex flex-col gap-2.5 lg:flex-row">
          <Skeleton className="h-11 w-full lg:w-80" />
          <Skeleton className="h-11 w-full lg:w-[520px]" />
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
            <Skeleton className="size-12 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="hidden h-6 w-20 sm:block" />
            <Skeleton className="hidden h-6 w-24 md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton({ sideNav = false }: { sideNav?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className={sideNav ? "lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[220px_minmax(0,1fr)]" : undefined}>
        {sideNav && (
          <div className="hidden space-y-2 lg:block">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        )}
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-5 rounded-2xl border border-border bg-card p-5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-24 w-full" />
              <div className="grid gap-5 sm:grid-cols-2">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
