import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({ value, count, size = "sm", className }: { value: number; count?: number; size?: "sm" | "md"; className?: string }) {
  const px = size === "sm" ? "size-3.5" : "size-4.5";
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex" role="img" aria-label={`Nota ${value.toFixed(1).replace(".", ",")} de 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="relative">
            <Star className={cn(px, "text-border-strong")} fill="currentColor" strokeWidth={0} aria-hidden />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${Math.max(0, Math.min(1, value - i + 1)) * 100}%` }}>
              <Star className={cn(px, "text-brand")} fill="currentColor" strokeWidth={0} aria-hidden />
            </span>
          </span>
        ))}
      </div>
      {count !== undefined && (
        <span className="text-xs text-subtle tabular">
          ({count}
          <span className="sr-only"> {count === 1 ? "avaliação" : "avaliações"}</span>)
        </span>
      )}
    </div>
  );
}
