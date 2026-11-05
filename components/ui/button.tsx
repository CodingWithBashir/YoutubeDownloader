import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-[0_12px_30px_-14px_rgb(var(--brand))] hover:brightness-110 active:translate-y-px",
  secondary: "bg-ink text-canvas hover:opacity-90 active:translate-y-px",
  outline: "border border-line bg-surface/60 text-ink hover:border-brand/50 hover:bg-surface",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger text-white hover:brightness-110",
  soft: "bg-brand-soft text-brand hover:brightness-95 dark:hover:brightness-125",
};

const sizes: Record<Size, string> = {
  sm: "h-9 rounded-xl px-3.5 text-xs",
  md: "h-11 rounded-xl px-5 text-sm",
  lg: "h-[52px] rounded-2xl px-6 text-sm",
  icon: "h-10 w-10 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition duration-200 ease-swift disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});
