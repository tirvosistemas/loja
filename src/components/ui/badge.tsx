import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5 [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "border-border bg-elevated text-muted-foreground",
        accent: "border-primary/30 bg-primary-soft text-primary",
        solid: "border-transparent bg-primary text-primary-foreground font-semibold",
        inverse: "border-transparent bg-inverse text-inverse-foreground",
        success: "border-success/30 bg-success-soft text-success",
        warning: "border-warning/30 bg-warning-soft text-warning",
        danger: "border-danger/30 bg-danger-soft text-danger",
        info: "border-info/30 bg-info-soft text-info",
      },
      size: { sm: "px-2 py-0 text-[11px]", md: "" },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export function Badge({ className, tone, size, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
