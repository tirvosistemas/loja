import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, type LabelHTMLAttributes, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-xl border border-input bg-card px-3.5 text-[15px] text-foreground placeholder:text-subtle transition-colors hover:border-border-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/25";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode; trailing?: ReactNode }>(
  function Input({ className, leading, trailing, ...props }, ref) {
    if (!leading && !trailing) return <input ref={ref} className={cn(fieldBase, "h-11", className)} {...props} />;
    return (
      <div className="relative">
        {leading && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-subtle [&_svg]:size-4">{leading}</span>}
        <input ref={ref} className={cn(fieldBase, "h-11", leading && "pl-10", trailing && "pr-11", className)} {...props} />
        {trailing && <span className="absolute inset-y-0 right-2 flex items-center">{trailing}</span>}
      </div>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...props },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(fieldBase, "min-h-24 py-3 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(fieldBase, "h-11 appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
    </div>
  );
});

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-foreground", className)} {...props} />;
}

export function FieldError({ children, id }: { children?: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-danger">
      {children}
    </p>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-primary">*</span>}
        </Label>
      )}
      {children}
      {hint && !error && <p className="mt-1.5 text-[13px] text-subtle">{hint}</p>}
      <FieldError>{error}</FieldError>
    </div>
  );
}
