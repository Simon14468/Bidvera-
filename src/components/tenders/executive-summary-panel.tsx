"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DecisionType } from "@/domain/types";
import type { Dictionary } from "@/i18n/dictionaries";
import { decisionBadgeClass } from "@/lib/labels";
import { cn } from "@/lib/cn";
import type { ExecutiveSummaryView } from "@/services/reports/executive-summary-view";
import { AlertTriangle, ChevronDown, ChevronUp, ListChecks } from "lucide-react";

type TenderDetailCopy = Dictionary["app"]["tenderDetail"];

type ExecutiveSummaryPanelProps = {
  summary: ExecutiveSummaryView;
  copy: TenderDetailCopy;
  showDetails: boolean;
  onViewDetails: () => void;
  onHideDetails: () => void;
};

function decisionAccent(decision: DecisionType | null): string {
  if (decision === "BID") return "border-success/30 ring-success/20";
  if (decision === "REVIEW") return "border-warning/30 ring-warning/20";
  if (decision === "NO_BID") return "border-danger/30 ring-danger/20";
  return "border-warning/30 ring-warning/20";
}

function decisionHeroBg(decision: DecisionType | null): string {
  if (decision === "BID") return "bg-success/[0.06]";
  if (decision === "REVIEW") return "bg-warning/[0.07]";
  if (decision === "NO_BID") return "bg-danger/[0.06]";
  return "bg-warning/[0.07]";
}

function incompleteBadgeClass(): string {
  return "bg-warning/10 text-warning border-warning/25";
}

export function ExecutiveSummaryPanel({
  summary,
  copy,
  showDetails,
  onViewDetails,
  onHideDetails,
}: ExecutiveSummaryPanelProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden ring-1",
        decisionAccent(summary.decision),
      )}
    >
      <div
        className={cn(
          "border-b border-border px-4 py-5 sm:px-6",
          decisionHeroBg(summary.decision),
        )}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
          {copy.executiveSummary}
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <Badge
              statusIcon
              className={cn(
                "px-3 py-1.5 text-lg font-semibold tracking-tight sm:text-xl",
                summary.decision
                  ? decisionBadgeClass(summary.decision)
                  : incompleteBadgeClass(),
              )}
            >
              {summary.decisionLabel}
            </Badge>
            {summary.shortExplanation ? (
              <p className="mt-3 text-sm leading-relaxed text-foreground sm:text-base">
                {summary.shortExplanation}
              </p>
            ) : null}
          </div>
          <dl className="flex shrink-0 gap-6 text-sm sm:gap-8">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                {copy.overallFit}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl">
                {summary.fitScoreDisplay}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">
                {copy.confidence}
              </dt>
              <dd className="mt-1 text-lg font-semibold sm:text-xl">
                {summary.confidenceDisplay}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <CardContent className="space-y-5 px-4 py-5 sm:px-6">
        {summary.criticalAlerts.length > 0 ? (
          <section
            className="rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3"
            aria-label={copy.criticalAlerts}
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-warning">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              {copy.criticalAlerts}
            </div>
            <ul className="mt-2 space-y-1.5 text-sm text-foreground">
              {summary.criticalAlerts.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-warning" aria-hidden>
                    •
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {summary.topReasons.length > 0 ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              {copy.topReasons}
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm text-foreground">
              {summary.topReasons.map((reason) => (
                <li key={reason} className="flex gap-2">
                  <span className="text-primary" aria-hidden>
                    •
                  </span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {summary.nextActions.length > 0 ? (
          <section>
            <div className="flex items-center gap-2">
              <ListChecks className="size-3.5 text-primary" aria-hidden />
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                {copy.whatToDoNext}
              </h3>
            </div>
            <ol className="mt-2 space-y-1.5 text-sm text-foreground">
              {summary.nextActions.map((action, index) => (
                <li key={action} className="flex gap-2">
                  <span className="font-semibold tabular-nums text-primary">
                    {index + 1}.
                  </span>
                  <span>{action}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted">
          {summary.disclaimer}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {!showDetails ? (
            <Button
              type="button"
              variant="primary"
              size="md"
              className="w-full sm:w-auto"
              onClick={onViewDetails}
            >
              <ChevronDown className="size-4" aria-hidden />
              {copy.viewDetails}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="md"
              className="w-full sm:w-auto"
              onClick={onHideDetails}
            >
              <ChevronUp className="size-4" aria-hidden />
              {copy.hideDetails}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
