"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  blockingLabel,
  enrichActionWithTeamTask,
  formatActionOwner,
  formatDepartment,
  priorityEmoji,
  statusDisplayLabel,
  type ActionPlanTeamTaskView,
} from "@/domain/tender-action-plan/presentation";
import type { TenderActionItem, TenderActionPlanBundle } from "@/domain/tender-action-plan";
import { cn } from "@/lib/cn";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ListChecks,
  User,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { SourceViewerButton } from "./source-viewer";

type TenderActionPlanPanelProps = {
  tenderId: string;
  bundle: TenderActionPlanBundle;
  decisionLabel?: string | null;
  teamTasks?: ActionPlanTeamTaskView[];
  simulationItems?: TenderActionItem[];
};

function ExecutiveActionRow({
  item,
  ownerLabel,
  blockLabel,
}: {
  item: TenderActionItem;
  ownerLabel: string;
  blockLabel: string | null;
}) {
  return (
    <li className="flex gap-3 rounded-lg border border-border/70 bg-surface/30 px-3 py-2.5">
      <span className="shrink-0 text-base leading-none" aria-hidden>
        {priorityEmoji(item.priority)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{item.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <User className="size-3" aria-hidden />
            {ownerLabel}
          </span>
          {blockLabel ? (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                item.blocking ? "text-warning" : "text-muted",
              )}
            >
              {item.blocking ? (
                <AlertTriangle className="size-3 shrink-0" aria-hidden />
              ) : null}
              {blockLabel}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function ActionDetailCard({
  tenderId,
  item,
  teamTask,
}: {
  tenderId: string;
  item: TenderActionItem;
  teamTask: ActionPlanTeamTaskView | null;
}) {
  const owner = formatActionOwner(item, teamTask);

  return (
    <div className="rounded-lg border border-border/80 bg-surface/40 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium text-foreground">
          {priorityEmoji(item.priority)} {item.title}
        </p>
        <Badge variant="outline" className="text-[10px] uppercase">
          {statusDisplayLabel(item.status)}
        </Badge>
      </div>

      <p className="mt-2 text-muted">
        <span className="font-medium text-foreground/80">Why: </span>
        {item.whyNeeded}
      </p>

      {(item.requirementText || item.description) && item.linkedRequirementId ? (
        <div className="mt-3 rounded-md border border-border/60 bg-background/50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Canonical requirement
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
            {item.requirementText || item.description}
          </p>
        </div>
      ) : item.description ? (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{item.description}</p>
      ) : null}

      <dl className="mt-3 grid gap-1.5 text-xs text-muted">
        <div className="flex gap-2">
          <dt className="shrink-0 font-medium text-foreground/80">Owner:</dt>
          <dd>{owner}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 font-medium text-foreground/80">Source:</dt>
          <dd className="min-w-0 break-words whitespace-pre-wrap">{item.sourceTrace || "UNKNOWN"}</dd>
        </div>
        {item.dueDate ? (
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-foreground/80">Deadline:</dt>
            <dd>{new Date(item.dueDate).toLocaleDateString(undefined, { dateStyle: "medium" })}</dd>
          </div>
        ) : null}
        {item.verificationRequired ? (
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-foreground/80">Evidence:</dt>
            <dd>Verification required before this action is resolved.</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="shrink-0 font-medium text-foreground/80">Expected outcome:</dt>
          <dd>{item.expectedOutcome}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 font-medium text-foreground/80">After completion:</dt>
          <dd>{item.afterCompletion}</dd>
        </div>
      </dl>

      {(item.linkedRequirementId || item.linkedEvidenceId) ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {item.linkedRequirementId ? (
            <SourceViewerButton
              tenderId={tenderId}
              requirementId={item.linkedRequirementId}
              evidenceId={item.linkedEvidenceId ?? undefined}
              label="View requirement source"
            />
          ) : null}
        </div>
      ) : null}

      {teamTask ? (
        <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs">
          <p className="font-semibold text-primary">Team Decision Workflow</p>
          <p className="mt-1 text-muted">
            Assigned to {teamTask.assigneeLabel ?? formatDepartment(teamTask.department ?? "Team")}
          </p>
          <p className="text-muted">Status: {teamTask.status.replace(/_/g, " ")}</p>
          {teamTask.responseText ? (
            <p className="mt-1 text-foreground">Response: {teamTask.responseText}</p>
          ) : null}
          {teamTask.verificationState ? (
            <p className="text-muted">Verification: {teamTask.verificationState}</p>
          ) : null}
          <Link
            href="#team-workflow"
            className="mt-2 inline-block font-medium text-primary hover:underline"
          >
            Open team workflow →
          </Link>
          <p className="mt-1 text-[10px] text-muted">
            Completing a team task does not change the decision directly — evidence must be verified
            and the Decision Engine re-run.
          </p>
        </div>
      ) : item.linkedTeamTaskId ? null : item.ownerLabel ? (
        <p className="mt-2 text-xs text-muted">
          Use Team Decision Workflow to assign verification to {formatDepartment(item.ownerLabel)}.
        </p>
      ) : null}
    </div>
  );
}

export function TenderActionPlanPanel({
  tenderId,
  bundle,
  decisionLabel,
  teamTasks = [],
  simulationItems = [],
}: TenderActionPlanPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const realOpen = useMemo(
    () =>
      bundle.items.filter(
        (i) =>
          !i.simulationOnly &&
          i.status !== "COMPLETED" &&
          i.status !== "CANCELLED",
      ),
    [bundle.items],
  );

  const topActions = useMemo(() => realOpen.slice(0, 3), [realOpen]);

  if (realOpen.length === 0 && simulationItems.length === 0) {
    return null;
  }

  const deadlineDisplay = bundle.deadlineUrgency.tenderDeadline
    ? bundle.deadlineUrgency.daysRemaining != null
      ? `${bundle.deadlineUrgency.daysRemaining} day(s) remaining`
      : "Deadline set"
    : "Deadline unavailable";

  return (
    <Card id="action-plan" className="overflow-hidden ring-1 ring-primary/15">
      <CardHeader className="border-b border-border bg-primary/[0.04] px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ListChecks className="size-4 text-primary" aria-hidden />
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                What should I do now?
              </p>
            </div>
            {decisionLabel ? (
              <p className="mt-2 text-lg font-semibold tracking-tight">{decisionLabel}</p>
            ) : null}
            <p className="mt-1 text-sm text-muted">
              {realOpen.length} action{realOpen.length === 1 ? "" : "s"} required
            </p>
          </div>
          <div className="text-right text-xs text-muted">
            <div className="inline-flex items-center gap-1.5">
              <CalendarClock className="size-3.5" aria-hidden />
              {deadlineDisplay}
            </div>
            {bundle.deadlineUrgency.urgencyNote ? (
              <p className="mt-1 max-w-[200px] text-warning">{bundle.deadlineUrgency.urgencyNote}</p>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-4 py-4 sm:px-6">
        {topActions.length > 0 ? (
          <ul className="space-y-2" aria-label="Top actions">
            {topActions.map((item) => {
              const teamTask = enrichActionWithTeamTask(item, teamTasks);
              return (
                <ExecutiveActionRow
                  key={item.id}
                  item={item}
                  ownerLabel={formatActionOwner(item, teamTask)}
                  blockLabel={blockingLabel(item)}
                />
              );
            })}
          </ul>
        ) : null}

        {realOpen.length > topActions.length || expanded ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                <ChevronUp className="size-4" aria-hidden />
                Hide action details
              </>
            ) : (
              <>
                <ChevronDown className="size-4" aria-hidden />
                View all {realOpen.length} actions
              </>
            )}
          </Button>
        ) : null}

        {expanded ? (
          <div className="space-y-3 border-t border-border pt-4">
            {realOpen.map((item) => (
              <ActionDetailCard
                key={item.id}
                tenderId={tenderId}
                item={item}
                teamTask={enrichActionWithTeamTask(item, teamTasks)}
              />
            ))}
          </div>
        ) : null}

        {simulationItems.length > 0 ? (
          <section className="rounded-xl border border-dashed border-warning/40 bg-warning/[0.04] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-warning">
              Simulation only
            </p>
            <p className="mt-1 text-xs text-muted">
              Hypothetical improvements — not the actual decision or action plan.
            </p>
            <ul className="mt-2 space-y-2">
              {simulationItems.map((item) => (
                <li key={item.id} className="text-sm text-foreground">
                  {item.title}
                  <span className="block text-xs text-muted">{item.description}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-[11px] leading-relaxed text-muted">{bundle.disclaimer}</p>
      </CardContent>
    </Card>
  );
}
