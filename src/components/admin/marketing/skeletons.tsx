import { Skeleton } from "@/components/ui/card";

// Esqueletos exibidos enquanto as páginas de marketing carregam.

function Header({ action = true }: { action?: boolean }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {action && <Skeleton className="h-11 w-40" />}
    </div>
  );
}

export function ListPageSkeleton({ stats = 4, cards }: { stats?: number; cards?: boolean }) {
  return (
    <div role="status" aria-label="Carregando">
      <Header />
      {stats > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden>
          {Array.from({ length: stats }, (_, i) => (
            <Skeleton key={i} className="h-[108px] rounded-2xl" />
          ))}
        </div>
      )}
      {cards ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      )}
    </div>
  );
}

export function FormPageSkeleton({ aside = true }: { aside?: boolean }) {
  return (
    <div role="status" aria-label="Carregando">
      <Header action={false} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]" aria-hidden>
        <div className="space-y-5">
          {["h-56", "h-64", "h-48"].map((h) => (
            <Skeleton key={h} className={`${h} rounded-2xl`} />
          ))}
        </div>
        {aside && <Skeleton className="hidden h-96 rounded-2xl xl:block" />}
      </div>
    </div>
  );
}
