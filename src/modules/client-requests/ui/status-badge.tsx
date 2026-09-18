import type { ClientRequestStatus } from "@prisma/client";
import { cn } from "@/lib/cn";

const STYLES: Record<ClientRequestStatus, string> = {
  PENDING: "bg-foreground/8 text-muted",
  IN_PROGRESS: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  COMPLETED: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  OVERDUE: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  CANCELLED: "bg-foreground/6 text-muted line-through",
};

const LABELS: Record<ClientRequestStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

export function ClientRequestStatusBadge({
  status,
  className,
}: {
  status: ClientRequestStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        STYLES[status],
        className,
      )}
    >
      {LABELS[status]}
    </span>
  );
}
