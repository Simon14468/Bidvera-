import { cn } from "@/lib/cn";

const DRAFT_STYLES: Record<string, string> = {
  VERIFY: "bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/25",
  DRAFT_READY: "bg-sky-500/15 text-sky-900 dark:text-sky-200 border border-sky-500/20",
  APPROVED: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  EDITED: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  REJECTED: "bg-foreground/8 text-muted line-through",
};

const DRAFT_LABELS: Record<string, string> = {
  VERIFY: "Needs verification",
  DRAFT_READY: "AI draft — not verified",
  APPROVED: "Approved",
  EDITED: "Edited & accepted",
  REJECTED: "Rejected",
};

const MANDATORY_STYLES: Record<string, string> = {
  MANDATORY: "bg-red-500/10 text-red-800 dark:text-red-200",
  OPTIONAL: "bg-foreground/8 text-muted",
  UNKNOWN: "bg-foreground/6 text-muted",
};

export function DraftStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        DRAFT_STYLES[status] ?? DRAFT_STYLES.VERIFY,
        className,
      )}
    >
      {DRAFT_LABELS[status] ?? status.replaceAll("_", " ")}
    </span>
  );
}

export function MandatoryBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        MANDATORY_STYLES[status] ?? MANDATORY_STYLES.UNKNOWN,
      )}
    >
      {status === "MANDATORY"
        ? "Mandatory"
        : status === "OPTIONAL"
          ? "Optional"
          : "Mandatory unknown"}
    </span>
  );
}

export function QuestionTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex rounded-md bg-foreground/6 px-2 py-0.5 text-[11px] font-medium text-muted">
      {type.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}
