import { Card, CardContent } from "@/components/ui/card";
import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import type { BidScoreBreakdown } from "@/domain/bid-score";
import { cn } from "@/lib/cn";

/**
 * Bid Score + Expected Value — prioritization only.
 * Never frames the score as win probability or guaranteed revenue.
 */
export function BidScoreCard({
  bidScore,
  className,
}: {
  bidScore: BidScoreBreakdown;
  className?: string;
}) {
  const positives = bidScore.drivers.filter((d) => d.direction === "positive");
  const negatives = bidScore.drivers.filter((d) => d.direction === "negative");
  const scoringUnavailable = bidScore.scoringAvailable === false;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="space-y-5 pt-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Bid Score
            </p>
            <p className="mt-1 inline-flex flex-wrap items-center gap-2 text-2xl font-semibold tabular-nums tracking-tight">
              <StatusIndicator
                tone={scoringUnavailable ? "neutral" : priorityTone(bidScore.priority)}
                className="size-5"
              />
              <span>
                {scoringUnavailable ? (
                  <span className="text-xl">UNAVAILABLE</span>
                ) : (
                  <>
                    {bidScore.score}/100
                    <span className="ms-2 text-base font-medium text-muted">
                      — {bidScore.priorityLabel}
                    </span>
                  </>
                )}
              </span>
            </p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
              {bidScore.interpretation}
            </p>
          </div>
          <div className="grid min-w-[11rem] grid-cols-2 gap-2 text-sm sm:grid-cols-1">
            <Meta
              label="Expected Value"
              value={bidScore.expectedValue}
              tone={qualitativeTone(bidScore.expectedValue, "value")}
            />
            <Meta
              label="Risk"
              value={bidScore.riskLevel}
              tone={qualitativeTone(bidScore.riskLevel, "risk")}
            />
            <Meta
              label="Effort"
              value={bidScore.effort}
              tone={qualitativeTone(bidScore.effort, "effort")}
            />
            <Meta
              label="Priority"
              value={bidScore.priorityLabel.replace(/ Priority$/, "")}
              tone={priorityTone(bidScore.priority)}
            />
          </div>
        </div>

        <div className="grid gap-2 text-xs text-muted sm:grid-cols-3">
          <p>{bidScore.contractValueLabel}</p>
          <p>{bidScore.pursuitCostLabel}</p>
          <p>{bidScore.winProbabilityLabel}</p>
        </div>

        {(positives.length > 0 || negatives.length > 0) && (
          <div className="grid gap-4 sm:grid-cols-2">
            <DriverList title="Positive" items={positives.map((d) => d.label)} tone="positive" />
            <DriverList title="Negative" items={negatives.map((d) => d.label)} tone="negative" />
          </div>
        )}

        {bidScore.certaintyNote ? (
          <p className="text-xs text-muted">{bidScore.certaintyNote}</p>
        ) : null}
        <p className="text-xs text-muted">{bidScore.disclaimer}</p>
        {bidScore.expectedValueNote ? (
          <p className="text-xs text-muted">{bidScore.expectedValueNote}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function priorityTone(
  priority: BidScoreBreakdown["priority"],
): StatusTone {
  switch (priority) {
    case "VERY_HIGH":
    case "HIGH":
      return "positive";
    case "MEDIUM":
      return "medium";
    case "LOW":
    case "VERY_LOW":
      return "negative";
  }
}

function qualitativeTone(
  level: string,
  kind: "value" | "risk" | "effort",
): StatusTone {
  const u = level.toUpperCase();
  if (u === "UNKNOWN") return "neutral";
  if (kind === "value") {
    if (u === "HIGH") return "positive";
    if (u === "MEDIUM") return "medium";
    return "negative";
  }
  // Risk / effort: HIGH is attention/negative
  if (u === "LOW") return "positive";
  if (u === "MEDIUM") return "medium";
  return "negative";
}

function Meta({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: StatusTone;
}) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 inline-flex items-center gap-1.5 font-semibold tabular-nums",
          tone === "positive" && "text-success",
          tone === "medium" && "text-warning",
          tone === "negative" && "text-danger",
          tone === "neutral" && "text-muted",
        )}
      >
        <StatusIndicator tone={tone} className="size-3" />
        {value}
      </p>
    </div>
  );
}

function DriverList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "negative";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </p>
      <ul className="mt-2 space-y-1.5 text-sm text-muted">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-1.5">
            <StatusIndicator
              tone={tone === "positive" ? "positive" : "negative"}
              className="mt-0.5 size-3"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
