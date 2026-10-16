import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-[background-color,color,border-color,box-shadow,transform] duration-150 active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover hover:shadow-glow",
        inverse: "bg-inverse text-inverse-foreground hover:opacity-90",
        secondary: "bg-elevated text-foreground border border-border hover:border-border-strong hover:bg-muted",
        outline: "border border-border-strong bg-transparent text-foreground hover:bg-elevated",
        ghost: "bg-transparent text-foreground hover:bg-elevated",
        danger: "bg-danger text-white hover:opacity-90",
        "danger-ghost": "bg-transparent text-danger hover:bg-danger-soft",
        whatsapp: "bg-whatsapp text-[#04210f] hover:brightness-105 hover:shadow-[0_8px_30px_-8px_rgb(37_211_102_/_.55)]",
        link: "h-auto rounded-md px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-[15px]",
        lg: "h-13 px-6 text-base",
        xl: "h-14 px-7 text-base font-semibold",
        icon: "size-10 p-0",
        "icon-sm": "size-8 p-0 rounded-lg",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { loading?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, loading, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
