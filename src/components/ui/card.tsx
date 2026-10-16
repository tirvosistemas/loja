import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-border bg-card", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-border px-5 py-4", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function Separator({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-border", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-xl bg-[linear-gradient(90deg,var(--muted)_0%,var(--elevated)_50%,var(--muted)_100%)] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center", className)}>
      {icon && <div className="grid size-12 place-items-center rounded-2xl bg-elevated text-muted-foreground [&_svg]:size-6">{icon}</div>}
      <div className="max-w-sm">
        <p className="font-semibold">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-border bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{children}</kbd>;
}
