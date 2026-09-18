"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { SimilarCompanyLearningSignal } from "@/domain/learning";
import { cn } from "@/lib/cn";
import { History, Shield } from "lucide-react";

/** User-facing historical signal — no ML lifecycle jargon. */
export function LearningSignalCard({
  signal,
  className,
}: {
  signal: SimilarCompanyLearningSignal | null | undefined;
  className?: string;
}) {
  if (!signal?.detected) return null;

  return (
    <Card
      className={cn(
        "border-primary/20 bg-primary/[0.03]",
        !signal.influenceAllowed && "border-warning/25 bg-warning/[0.04]",
        className,
      )}
    >
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="size-4 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold tracking-tight">
              Relevant historical intelligence
            </h2>
          </div>
          <Badge
            statusIcon
            className={cn(
              "text-xs",
              signal.influenceAllowed
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-warning/25 bg-warning/10 text-warning",
            )}
          >
            {signal.influenceAllowed
              ? "Additional signal — not a guarantee"
              : "Current tender evidence takes priority"}
          </Badge>
        </div>
        <p className="text-sm font-medium text-foreground">{signal.headline}</p>
        <p className="text-sm leading-relaxed text-muted">
          Similar historical outcomes may provide a relevant signal for this
          opportunity. This does not predict that your company will succeed or
          fail, and never reveals other companies or their documents.
        </p>
        {!signal.influenceAllowed && signal.suppressedReason ? (
          <p className="text-sm text-muted">{signal.suppressedReason}</p>
        ) : null}
        <p className="flex items-start gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-muted">
          <Shield className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          <span>
            Current tender evidence and your company profile always take priority
            over historical patterns.
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
