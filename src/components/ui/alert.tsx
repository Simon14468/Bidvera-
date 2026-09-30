import { cn } from "@/lib/cn";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { HTMLAttributes } from "react";

type AlertVariant = "info" | "success" | "warning" | "danger";

const styles: Record<AlertVariant, string> = {
  info: "border-border bg-card text-foreground",
  success:
    "border-[color-mix(in_srgb,var(--primary)_28%,var(--border))] bg-[color-mix(in_srgb,var(--primary)_10%,var(--card))] text-foreground",
  warning: "border-warning/30 bg-warning/5 text-foreground",
  danger: "border-danger/30 bg-danger/5 text-foreground",
};

const iconWrap: Record<AlertVariant, string> = {
  info: "bg-foreground/8 text-foreground",
  success: "bg-primary/15 text-primary",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
};

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  danger: AlertCircle,
};

export function Alert({
  variant = "info",
  title,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  title?: string;
}) {
  const Icon = icons[variant];
  return (
    <div
      role={variant === "danger" || variant === "warning" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-xl border px-3.5 py-3 shadow-[var(--shadow-soft)] animate-fade-in",
        styles[variant],
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full",
          iconWrap[variant],
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5 self-center">
        {title ? (
          <p className="text-sm font-semibold leading-snug text-foreground">{title}</p>
        ) : null}
        {children ? (
          <div
            className={cn(
              "text-sm leading-relaxed",
              title ? "text-muted" : "font-medium text-foreground",
            )}
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
