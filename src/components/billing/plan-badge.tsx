import { cn } from "@/lib/cn";
import type { PlanBadgeTone } from "@/services/billing/plan-identity";

const toneClass: Record<PlanBadgeTone, string> = {
  premium:
    "border-emerald-500/35 bg-gradient-to-b from-emerald-500/20 to-amber-500/15 text-emerald-700 dark:text-emerald-300",
  trial:
    "border-sky-500/35 bg-sky-500/10 text-sky-800 dark:text-sky-300",
  free:
    "border-border bg-card text-muted",
  neutral:
    "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
};

/**
 * Compact plan chip. Pass server-resolved identity only —
 * never derive the label from query params or client storage.
 */
export function PlanBadge({
  label,
  tone,
  title,
  className,
  size = "sm",
}: {
  label: string;
  tone: PlanBadgeTone;
  title?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      title={title ?? label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border font-semibold uppercase tracking-[0.08em]",
        size === "sm" ? "h-5 px-1.5 text-[10px] leading-none" : "h-6 px-2 text-[11px] leading-none",
        toneClass[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
