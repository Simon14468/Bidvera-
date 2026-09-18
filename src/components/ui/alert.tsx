import { cn } from "@/lib/cn";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { HTMLAttributes } from "react";

type AlertVariant = "info" | "success" | "warning" | "danger";

const styles: Record<AlertVariant, string> = {
  info: "border-border bg-card text-foreground",
  success: "border-success/25 bg-success/5 text-foreground",
  warning: "border-warning/30 bg-warning/5 text-foreground",
  danger: "border-danger/25 bg-danger/5 text-foreground",
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
      role="alert"
      className={cn(
        "flex gap-3 rounded-xl border px-4 py-3 shadow-[var(--shadow-soft)]",
        styles[variant],
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-0.5">
        {title ? <p className="text-sm font-semibold">{title}</p> : null}
        <div className="text-sm text-muted">{children}</div>
      </div>
    </div>
  );
}
