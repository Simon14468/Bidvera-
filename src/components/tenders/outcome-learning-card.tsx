"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { OutcomeLearningInsightsBundle } from "@/domain/decision-outcome-learning";
import { cn } from "@/lib/cn";
import { History, Shield } from "lucide-react";
import Link from "next/link";

/** Advisory historical patterns from recorded outcomes — never changes scores. */
export function OutcomeLearningCard({
  insights,
  className,
}: {
  insights: OutcomeLearningInsightsBundle | null | undefined;
  className?: string;
}) {
  if (!insights?.computed) return null;
  const hasPatterns =
    insights.similarOutcomes.length > 0 ||
    insights.statistics?.summary ||
    insights.winRateSummary ||
    insights.recurringLossReasons.length > 0 ||
    insights.recurringSuccessPatterns.length > 0;

  if (!hasPatterns) return null;

  return (
    <Card className={cn("border-primary/20 bg-primary/[0.03]", className)}>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold tracking-tight">
              Outcome-based historical intelligence
            </h2>
          </div>
          <Badge
            statusIcon
            className="border-primary/20 bg-primary/10 text-xs text-primary"
          >
            Advisory only — traceable to prior tenders
          </Badge>
        </div>

        {insights.statistics?.summary ? (
          <p className="text-sm font-medium text-foreground">
            {insights.statistics.summary}
            {!insights.statistics.sufficientSample ? (
              <span className="ms-1 text-xs font-normal text-muted">
                (limited sample — interpret cautiously)
              </span>
            ) : null}
          </p>
        ) : insights.winRateSummary ? (
          <p className="text-sm font-medium text-foreground">{insights.winRateSummary}</p>
        ) : null}

        {insights.statistics && insights.statistics.comparableCount > 0 ? (
          <p className="text-xs text-muted">
            Sample: {insights.statistics.comparableCount} comparable · {insights.statistics.won}{" "}
            won · {insights.statistics.lost} lost
            {insights.statistics.withdrawn > 0
              ? ` · ${insights.statistics.withdrawn} withdrawn`
              : ""}
            {insights.statistics.winRatePercent != null
              ? ` · win rate ${insights.statistics.winRatePercent}% (decisive outcomes only)`
              : ""}
          </p>
        ) : null}

        {insights.similarOutcomes.length > 0 ? (
          <ul className="space-y-2">
            {insights.similarOutcomes.map((p) => (
              <li
                key={p.tenderId}
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
              >
                <p className="font-medium text-foreground">
                  <Link
                    href={`/tenders/${p.tenderId}`}
                    className="text-primary hover:underline"
                  >
                    {p.title}
                  </Link>
                </p>
                <p className="mt-1 text-muted">
                  {p.decisionLabel} → {p.outcomeLabel}
                  {p.outcomeDate ? ` · ${p.outcomeDate.slice(0, 10)}` : ""}
                </p>
                {p.reasonSummary ? (
                  <p className="mt-1 text-xs text-muted">Reason: {p.reasonSummary}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted">{p.traceNote}</p>
              </li>
            ))}
          </ul>
        ) : null}

        {insights.recurringLossReasons.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Recurring loss reasons
            </p>
            <ul className="mt-1 list-disc ps-5 text-sm text-muted">
              {insights.recurringLossReasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {insights.recurringSuccessPatterns.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Successful patterns
            </p>
            <ul className="mt-1 list-disc ps-5 text-sm text-muted">
              {insights.recurringSuccessPatterns.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="flex items-start gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-muted">
          <Shield className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          <span>{insights.disclaimer}</span>
        </p>
      </CardContent>
    </Card>
  );
}
