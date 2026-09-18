"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  evidenceStateExplainLabel,
  formatSourceLine,
  type ExplainableDecisionItem,
  type ExplainableDecisionView,
} from "@/domain/explainable-decision";
import { cn } from "@/lib/cn";
import { AlertTriangle, ChevronDown, ChevronUp, Scale } from "lucide-react";
import { useState } from "react";
import { SourceViewerButton } from "./source-viewer";

type ExplainableDecisionPanelProps = {
  tenderId: string;
  view?: ExplainableDecisionView | null;
  consistencyError?: string | null;
};

const TONE_DOT = {
  negative: "text-danger",
  warning: "text-warning",
  positive: "text-success",
} as const;

const TONE_EMOJI = {
  negative: "🔴",
  warning: "🟡",
  positive: "🟢",
} as const;

function decisionBadgeClass(label: string): string {
  if (label === "GO") return "bg-success/15 text-success border-success/30";
  if (label === "CONDITIONAL GO") return "bg-warning/15 text-warning border-warning/30";
  return "bg-danger/15 text-danger border-danger/30";
}

function DetailItem({
  tenderId,
  item,
}: {
  tenderId: string;
  item: ExplainableDecisionItem & {
    workflowLink?: ExplainableDecisionView["teamWorkflowLinks"][number] | null;
  };
}) {
  const statusLabel =
    item.status && (item.category === "MISSING_EVIDENCE" || item.category === "UNVERIFIED_EVIDENCE")
      ? evidenceStateExplainLabel(item.status)
      : item.status;

  return (
    <div className="rounded-lg border border-border/80 bg-surface/40 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium text-foreground">{item.what}</p>
        {item.referenceOnly ? (
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            Historical context
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 text-muted">{item.why}</p>
      <dl className="mt-2 grid gap-1 text-xs text-muted">
        {statusLabel ? (
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-foreground/80">Status:</dt>
            <dd>{statusLabel}</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="shrink-0 font-medium text-foreground/80">Impact:</dt>
          <dd>{item.impact}</dd>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <dt className="shrink-0 font-medium text-foreground/80">Source:</dt>
          <dd>{formatSourceLine(item)}</dd>
          {(item.requirementId || item.evidenceId) && item.source.located ? (
            <SourceViewerButton
              tenderId={tenderId}
              requirementId={item.requirementId ?? undefined}
              evidenceId={item.evidenceId}
              view={item.source.kind === "COMPANY_EVIDENCE" ? "company" : "tender"}
              label="Open source"
            />
          ) : null}
        </div>
      </dl>
      {item.workflowLink ? (
        <div className="mt-2 rounded-md border border-warning/25 bg-warning/5 px-2.5 py-2 text-xs">
          <p className="font-medium text-warning">Team workflow</p>
          <p className="mt-0.5 text-muted">
            {item.workflowLink.assigneeLabel
              ? `Assigned to ${item.workflowLink.assigneeLabel}`
              : item.workflowLink.department
                ? `Assigned to ${item.workflowLink.department}`
                : "Assigned to team"}
          </p>
          <p className="text-muted">Status: {item.workflowLink.statusLabel}</p>
          <p className="mt-1 text-[10px] text-muted">
            Task presence does not verify the requirement — canonical verification only.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function DetailSection({
  title,
  items,
  tenderId,
  emptyLabel = "None identified.",
}: {
  title: string;
  items: Array<
    ExplainableDecisionItem & {
      workflowLink?: ExplainableDecisionView["teamWorkflowLinks"][number] | null;
    }
  >;
  tenderId: string;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return (
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</h3>
        <p className="text-sm text-muted">{emptyLabel}</p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <DetailItem key={item.id} tenderId={tenderId} item={item} />
        ))}
      </div>
    </section>
  );
}

export function ExplainableDecisionPanel({
  tenderId,
  view,
  consistencyError,
}: ExplainableDecisionPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (consistencyError) {
    return (
      <Card className="border-danger/40">
        <CardContent className="flex items-start gap-3 pt-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-danger">Explanation unavailable</p>
            <p className="mt-1 text-sm text-muted">{consistencyError}</p>
            <p className="mt-2 text-xs text-muted">
              Bidvera blocked misleading reasoning because the stored decision and explanation
              diverged. Re-run analysis or contact support.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!view) return null;

  const { executiveSummary, sections, itemsWithWorkflow } = view;

  const blockers = sections.keyReasons.filter(
    (i) => i.category === "BLOCKER" || i.impactRole === "DIRECT_DECISION_DRIVER",
  );

  const itemById = new Map(itemsWithWorkflow.map((i) => [i.id, i]));

  function resolveItems(sectionItems: ExplainableDecisionItem[]) {
    return sectionItems.map((i) => itemById.get(i.id) ?? i);
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <Scale className="size-4 text-primary" aria-hidden />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Explainable Decision
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Decision
          </p>
          <Badge className={cn("text-base px-3 py-1 font-bold", decisionBadgeClass(view.displayLabel))}>
            {view.displayLabel}
          </Badge>
          <p className="text-xs uppercase tracking-wide text-muted">Current canonical decision</p>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">Why?</p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {executiveSummary.whyHeadline}
          </p>
          {executiveSummary.hardBlockerCount > 0 ? (
            <p className="mt-1 text-sm text-muted">
              {executiveSummary.hardBlockerCount}{" "}
              {executiveSummary.hardBlockerCount === 1
                ? "hard blocker remains"
                : "hard blockers remain"}
              .
            </p>
          ) : null}
          {(executiveSummary.canonicalNeedsVerification ?? 0) > 0 ? (
            <p className="mt-1 text-sm text-muted">
              {executiveSummary.canonicalNeedsVerification} canonical requirement
              {executiveSummary.canonicalNeedsVerification === 1 ? "" : "s"} require
              verification
              {executiveSummary.canonicalTotalRequirements
                ? ` (of ${executiveSummary.canonicalTotalRequirements} total)`
                : ""}
              .
            </p>
          ) : null}
          {executiveSummary.reviewItemCount > 0 &&
          executiveSummary.reviewItemCount !==
            (executiveSummary.canonicalNeedsVerification ?? executiveSummary.reviewItemCount) ? (
            <p className="mt-1 text-sm text-muted">
              {executiveSummary.reviewItemCount} main decision driver
              {executiveSummary.reviewItemCount === 1 ? "" : "s"} require verification.
            </p>
          ) : null}
        </div>

        {view.topReasons.length > 0 ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              Top Reasons
            </p>
            <ul className="mt-2 space-y-1.5">
              {view.topReasons.map((reason, idx) => (
                <li key={`${reason.category}-${idx}`} className="flex gap-2 text-sm">
                  <span aria-hidden>{TONE_EMOJI[reason.tone]}</span>
                  <span className={cn(TONE_DOT[reason.tone], "text-foreground")}>{reason.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              Hide details
              <ChevronUp className="size-4" aria-hidden />
            </>
          ) : (
            <>
              View Details
              <ChevronDown className="size-4" aria-hidden />
            </>
          )}
        </Button>

        {expanded ? (
          <div className="space-y-6 border-t border-border pt-4">
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">
                1. Decision
              </h3>
              <p className="text-sm font-semibold">{view.displayLabel}</p>
              <p className="text-sm text-muted">{executiveSummary.whyHeadline}</p>
            </section>
            <DetailSection
              title="2. Top Reasons"
              items={resolveItems(sections.keyReasons.slice(0, 8))}
              tenderId={tenderId}
            />
            <DetailSection title="3. Blockers" items={resolveItems(blockers)} tenderId={tenderId} />
            <DetailSection
              title="4. Requirements"
              items={resolveItems(sections.requirements)}
              tenderId={tenderId}
            />
            <DetailSection title="5. Evidence" items={resolveItems(sections.evidence)} tenderId={tenderId} />
            <DetailSection title="6. Risks" items={resolveItems(sections.risks)} tenderId={tenderId} />
            <DetailSection
              title="7. Company Fit"
              items={resolveItems(sections.companyFit)}
              tenderId={tenderId}
            />
            <DetailSection
              title="8. Readiness"
              items={resolveItems(sections.readiness)}
              tenderId={tenderId}
            />
            <DetailSection
              title="9. Decision Memory"
              items={resolveItems(sections.historicalSignals)}
              tenderId={tenderId}
              emptyLabel="No historical decision memory for this tender."
            />
            <DetailSection title="10. Unknowns" items={resolveItems(sections.unknowns)} tenderId={tenderId} />
            <DetailSection title="11. Recommended Actions" items={resolveItems(sections.actions)} tenderId={tenderId} />
            <p className="text-[10px] text-muted">{view.disclaimer}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
