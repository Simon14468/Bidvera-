import { cn } from "@/lib/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-lift)] active:scale-[0.98] disabled:bg-primary/50",
  secondary:
    "bg-primary-muted text-primary hover:bg-primary/15 active:scale-[0.98] disabled:opacity-50",
  ghost:
    "bg-transparent text-foreground hover:bg-foreground/[0.06] active:scale-[0.98] disabled:opacity-50",
  danger: "bg-danger text-white hover:bg-danger/90 active:scale-[0.98] disabled:opacity-50",
  outline:
    "bg-card border border-border text-foreground hover:bg-foreground/[0.06] hover:border-foreground/15 active:scale-[0.98] disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[color,background-color,box-shadow,transform] duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
        disabled={disabled || loading}
      >
        {loading ? (
          <span
            className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
            aria-hidden
          />
        ) : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
