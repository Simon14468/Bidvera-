import { StatusIndicator } from "@/components/ui/status-indicator";
import { cn } from "@/lib/cn";
import { HTMLAttributes } from "react";

type BadgeVariant = "default" | "outline" | "secondary";

const variantClass: Record<BadgeVariant, string> = {
  default: "border-border/80 bg-surface text-ink",
  outline: "border-border/80 bg-transparent text-ink",
  secondary: "border-transparent bg-surface-2 text-muted",
};

export function Badge({
  className,
  statusIcon = false,
  variant = "default",
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  /** Prefixed Bidvera status icon (semantic color via currentColor). */
  statusIcon?: boolean;
  variant?: BadgeVariant;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-medium",
        variantClass[variant],
        className,
      )}
      {...props}
    >
      {statusIcon ? <StatusIndicator className="size-3" /> : null}
      {children}
    </span>
  );
}
