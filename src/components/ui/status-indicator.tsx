import { cn } from "@/lib/cn";

export type StatusTone = "positive" | "medium" | "negative" | "neutral";

const toneClass: Record<StatusTone, string> = {
  positive: "bg-success",
  medium: "bg-warning",
  negative: "bg-danger",
  neutral: "bg-muted",
};

/**
 * Bidvera status indicator — brand mark silhouette.
 * Shape from /icons/status-indicator.png (new Bidvera identity);
 * color from semantic tone or currentColor via CSS mask.
 */
export function StatusIndicator({
  tone = "inherit",
  className,
}: {
  tone?: StatusTone | "inherit";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 size-3.5 align-middle",
        tone === "inherit" ? "bg-current" : toneClass[tone],
        className,
      )}
      style={{
        WebkitMaskImage: "url(/icons/status-indicator.png)",
        maskImage: "url(/icons/status-indicator.png)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}
