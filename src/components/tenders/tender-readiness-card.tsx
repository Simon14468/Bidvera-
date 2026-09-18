"use client";

import { Badge } from "@/components/ui/badge";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { Card, CardContent } from "@/components/ui/card";
import type {
  ReadinessItem,
  ReadinessStatus,
  TenderReadinessBreakdown,
} from "@/domain/decision/tender-readiness";
import { readinessBadgeClass, readinessLabels } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";

const STATUS_ORDER: ReadinessStatus[] = [
  "MISSING",
  "VERIFY",
  "UNKNOWN",
  "READY",
  "NOT_APPLICABLE",
];

function groupItems(items: ReadinessItem[]) {
  return STATUS_ORDER.map((status) => ({
    status,
    items: items.filter((i) => i.status === status),
  })).filter((g) => g.items.length > 0);
}

function priorityTone(priority: ReadinessItem["priority"]) {
  if (priority === "HIGH") return "text-danger";
  if (priority === "MEDIUM") return "text-warning";
  return "text-muted";
}

export function TenderReadinessCard({
  readiness,
  className,
}: {
  readiness: TenderReadinessBreakdown;
  className?: string;
}) {
  const groups = groupItems(readiness.items);
  const scoreLabel =
    readiness.scoringAvailable === false
      ? "UNAVAILABLE"
      : readiness.score == null
        ? "—"
        : formatPercent(readiness.score);
  const scoreWidth =
    readiness.scoringAvailable === false || readiness.score == null
      ? 8
      : Math.max(0, Math.min(100, readiness.score));

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="border-b border-border px-5 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          Tender Readiness
        </p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-4xl font-semibold tracking-tight tabular-nums">
              {scoreLabel}
            </p>
            <p className="mt-1 text-sm text-muted">
              {readiness.total} requirement{readiness.total === 1 ? "" : "s"}
              {" · "}
              {readiness.counts.ready} Ready
              {" · "}
              {readiness.counts.verify} Verify
              {" · "}
              {readiness.counts.missing} Missing
              {readiness.counts.unknown > 0
                ? ` · ${readiness.counts.unknown} Unknown`
                : ""}
            </p>
            <div className="mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${scoreWidth}%` }}
              />
            </div>
          </div>
          <p className="max-w-sm text-xs leading-relaxed text-muted">
            {readiness.disclaimer}
          </p>
        </div>
      </div>

      {readiness.attention.length > 0 ? (
        <div className="border-b border-border bg-warning/[0.05] px-5 py-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            Attention
          </p>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {readiness.attention.map((a) => (
              <li key={a}>• {a}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">
            <span className="font-medium text-foreground">Recommendation: </span>
            {readiness.recommendation}
          </p>
        </div>
      ) : (
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <p className="text-sm text-muted">
            <span className="font-medium text-foreground">Recommendation: </span>
            {readiness.recommendation}
          </p>
        </div>
      )}

      <CardContent className="space-y-6 pt-5">
        {groups.length === 0 ? (
          <p className="text-sm text-muted">
            No identifiable requirements for readiness scoring yet.
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.status}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold tracking-tight">
                  {readinessLabels[group.status]}
                </h3>
                <span className="text-xs tabular-nums text-muted">
                  {group.items.length}
                </span>
              </div>
              <ul className="space-y-3">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-border bg-background px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {item.requirement}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {item.mandatory ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide",
                              priorityTone(item.priority),
                            )}
                          >
                            <StatusIndicator className="size-3" />
                            {item.priority} priority
                          </span>
                        ) : item.priority !== "LOW" ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide",
                              priorityTone(item.priority),
                            )}
                          >
                            <StatusIndicator className="size-3" />
                            {item.priority}
                          </span>
                        ) : null}
                        <Badge statusIcon className={readinessBadgeClass(item.status)}>
                          {readinessLabels[item.status]}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {item.reason}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      Source: {item.source}
                      {item.category ? ` · ${item.category}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
