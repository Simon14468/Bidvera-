"use client";

import { ExecutiveSummaryPanel } from "@/components/tenders/executive-summary-panel";
import { TenderActionPlanPanel } from "@/components/tenders/tender-action-plan-panel";
import { Button } from "@/components/ui/button";
import type { ActionPlanTeamTaskView } from "@/domain/tender-action-plan/presentation";
import type { TenderActionPlanBundle } from "@/domain/tender-action-plan";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ExecutiveSummaryView } from "@/services/reports/executive-summary-view";
import { ChevronUp } from "lucide-react";
import { useCallback, useId, useState } from "react";

type TenderDetailCopy = Dictionary["app"]["tenderDetail"];

type TenderAnalysisWorkspaceProps = {
  summary: ExecutiveSummaryView;
  copy: TenderDetailCopy;
  tenderId: string;
  actionPlan?: TenderActionPlanBundle | null;
  actionPlanTeamTasks?: ActionPlanTeamTaskView[];
  actionPlanUpgradeNotice?: React.ReactNode;
  children: React.ReactNode;
};

export function TenderAnalysisWorkspace({
  summary,
  copy,
  tenderId,
  actionPlan,
  actionPlanTeamTasks = [],
  actionPlanUpgradeNotice = null,
  children,
}: TenderAnalysisWorkspaceProps) {
  const [showDetails, setShowDetails] = useState(false);
  const detailsId = useId();

  const openDetails = useCallback(() => {
    setShowDetails(true);
    requestAnimationFrame(() => {
      document.getElementById(detailsId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [detailsId]);

  return (
    <div className="space-y-6">
      <ExecutiveSummaryPanel
        summary={summary}
        copy={copy}
        showDetails={showDetails}
        onViewDetails={openDetails}
        onHideDetails={() => setShowDetails(false)}
      />

      {actionPlan?.computed ? (
        <TenderActionPlanPanel
          tenderId={tenderId}
          bundle={actionPlan}
          decisionLabel={summary.decisionLabel}
          teamTasks={actionPlanTeamTasks}
        />
      ) : actionPlanUpgradeNotice ? (
        actionPlanUpgradeNotice
      ) : null}

      {showDetails ? (
        <div id={detailsId} className="space-y-8 animate-fade-in">
          <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {copy.detailedAnalysisTitle}
              </h2>
              <p className="mt-1 text-sm text-muted">{copy.detailedAnalysisHint}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 self-start sm:self-auto"
              onClick={() => setShowDetails(false)}
              aria-expanded
              aria-controls={detailsId}
            >
              <ChevronUp className="size-4" aria-hidden />
              {copy.hideDetails}
            </Button>
          </div>
          {children}
        </div>
      ) : null}
    </div>
  );
}
