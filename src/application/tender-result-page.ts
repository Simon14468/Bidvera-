/**
 * Single authoritative read path for the tender result page.
 * One canonical fetch, parallel independent reads, shared projection.
 */

import { assertSameCompany, requireCompanyId } from "@/auth/session";
import { assertCanViewTenderAnalysis, canMutateTenderAnalysis } from "@/auth/tender-access";
import { getCanonicalTenderAnalysis } from "@/application/canonical-tender-analysis";
import {
  buildExplainableDecisionViewFromCanonical,
} from "@/application/explainable-decision";
import { createResultDeliveryTimer } from "@/application/result-delivery-timing";
import { mapTenderDetailFromCanonical } from "@/application/tender-detail-from-canonical";
import { DecisionExplanationMismatchError } from "@/domain/explainable-decision";
import { buildExecutiveSummaryFromReport } from "@/services/reports/executive-summary-view";
import { buildTenderReportFromCanonical } from "@/services/reports/tender-report";
import type { TenderReport } from "@/services/reports/types";
import { getPremiumFeatureAccess } from "@/services/entitlements/intelligence-projection";
import type { PremiumFeatureAccess } from "@/services/entitlements/intelligence-projection";
import { hasFeature } from "@/services/entitlements";
import { getDecisionOutcomeView } from "@/services/decision-outcome-learning";
import {
  getTenderWorkflowSummary,
  listCompanyTeamMembers,
  listTenderWorkflowTasks,
} from "@/services/team-workflow";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import type { Locale } from "@/i18n/config";
import type { ExplainableDecisionView } from "@/domain/explainable-decision";
import type { ExecutiveSummaryView } from "@/services/reports/executive-summary-view";

export type TenderResultInProgress = {
  kind: "in_progress";
  id: string;
  title: string;
  clientName: string | null;
  deadline: string | null;
  analyzedAt: string | null;
  status: string;
  canMutate: boolean;
};

/** Terminal analysis failure with no releasable decision (e.g. Guardian block). */
export type TenderResultFailed = {
  kind: "failed";
  id: string;
  title: string;
  clientName: string | null;
  deadline: string | null;
  analyzedAt: string | null;
  status: string;
  analysisError: string | null;
  analysisPhase: string | null;
  canMutate: boolean;
};

export type TenderResultReady = {
  kind: "ready";
  tender: ReturnType<typeof mapTenderDetailFromCanonical>;
  report: TenderReport;
  executiveSummary: ExecutiveSummaryView;
  premiumAccess: PremiumFeatureAccess;
  explainableView: ExplainableDecisionView | null;
  explainableConsistencyError: string | null;
  decisionOutcomeView: Awaited<ReturnType<typeof getDecisionOutcomeView>>;
  attachmentOptions: Array<{ id: string; fileName: string }>;
  teamEnabled: boolean;
  teamTasks: Awaited<ReturnType<typeof listTenderWorkflowTasks>>;
  teamMembers: Awaited<ReturnType<typeof listCompanyTeamMembers>>;
  teamSummary: Awaited<ReturnType<typeof getTenderWorkflowSummary>>;
  reportFeatureAccess: {
    explainableDecision: boolean;
    tenderActionPlan: boolean;
    advancedAiTrust: boolean;
    evidenceIntelligence: boolean;
    decisionSimulator: boolean;
  };
};

export type TenderResultPageData =
  | TenderResultInProgress
  | TenderResultFailed
  | TenderResultReady;

export async function loadTenderResultPageData(
  tenderId: string,
  locale: Locale,
): Promise<TenderResultPageData> {
  const { auth, companyId } = await requireCompanyId();
  assertCanViewTenderAnalysis(auth.user.role);

  const timer = createResultDeliveryTimer(tenderId, companyId);
  timer.mark("request_start");

  const shell = await prisma.tender.findUnique({
    where: { id: tenderId },
    include: {
      decision: { select: { id: true, createdAt: true, isAiSuggested: true } },
      documents: { take: 1, orderBy: { createdAt: "asc" }, select: { fileName: true } },
      risks: { orderBy: { sortOrder: "asc" }, take: 1, select: { severity: true } },
      nextActions: { orderBy: { sortOrder: "asc" }, take: 1, select: { title: true } },
    },
  });

  if (!shell) {
    throw new AppError(ErrorCode.NOT_FOUND, "Tender not found.", 404);
  }
  assertSameCompany(shell.companyId, companyId);
  timer.mark("shell_read");

  if (!shell.decision) {
    // Guardian / pipeline terminal failures persist FAILED without a decision row.
    // Must not be framed as "analysis in progress" or the UI stays permanently ANALYZING.
    if (shell.analysisStatus === "FAILED") {
      timer.finish({ kind: "failed" });
      return {
        kind: "failed",
        id: shell.id,
        title: shell.title,
        clientName: shell.client,
        deadline: shell.deadline?.toISOString() ?? null,
        analyzedAt: shell.analyzedAt?.toISOString() ?? null,
        status: shell.analysisStatus,
        analysisError: shell.analysisError,
        analysisPhase: shell.analysisPhase,
        canMutate: canMutateTenderAnalysis(auth.user.role),
      };
    }
    timer.finish({ kind: "in_progress" });
    return {
      kind: "in_progress",
      id: shell.id,
      title: shell.title,
      clientName: shell.client,
      deadline: shell.deadline?.toISOString() ?? null,
      analyzedAt: shell.analyzedAt?.toISOString() ?? null,
      status: shell.analysisStatus,
      canMutate: canMutateTenderAnalysis(auth.user.role),
    };
  }

  const [
    canonical,
    premiumAccess,
    decisionOutcomeView,
    attachmentOptions,
    teamEnabled,
  ] = await Promise.all([
    getCanonicalTenderAnalysis(tenderId, companyId),
    getPremiumFeatureAccess(companyId),
    getDecisionOutcomeView(companyId, tenderId),
    prisma.tenderDocument.findMany({
      where: { tenderId, companyId },
      select: { id: true, fileName: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    hasFeature(companyId, "team_collaboration").catch(() => false),
  ]);

  timer.mark("canonical_read");

  const tender = mapTenderDetailFromCanonical({
    canonical,
    premiumAccess,
    shellDecision: shell.decision,
    role: auth.user.role,
  });

  timer.mark("projection");

  const report = buildTenderReportFromCanonical(canonical, {
    premiumAccess,
    decisionOutcome: decisionOutcomeView,
  });

  timer.mark("report_built");

  const reportFeatureAccess = {
    explainableDecision: premiumAccess.explainableDecision,
    tenderActionPlan: premiumAccess.tenderActionPlan,
    advancedAiTrust: premiumAccess.advancedAiTrust,
    evidenceIntelligence: premiumAccess.evidenceIntelligence,
    decisionSimulator: premiumAccess.decisionSimulator,
  };

  const scoringBlocked = tender.analysis?.fitBreakdown?.scoringAvailable === false;
  const executiveSummary =
    !tender.companyKnowledgeOnly && (tender.decision || scoringBlocked)
      ? buildExecutiveSummaryFromReport(report, locale, reportFeatureAccess)
      : null;

  let explainableView: ExplainableDecisionView | null = null;
  let explainableConsistencyError: string | null = null;

  const [teamTasks, teamMembers, teamSummary] = teamEnabled
    ? await Promise.all([
        listTenderWorkflowTasks({
          companyId,
          tenderId,
          role: auth.user.role,
        }),
        listCompanyTeamMembers(companyId),
        getTenderWorkflowSummary({ companyId, tenderId }),
      ])
    : [[], [], { openCriticalCount: 0, openCount: 0, titles: [], note: null }];

  if (
    (tender.decision || scoringBlocked) &&
    !tender.companyKnowledgeOnly &&
    tender.intelligence?.tenderDecisionRecommendation &&
    premiumAccess.explainableDecision
  ) {
    try {
      explainableView = buildExplainableDecisionViewFromCanonical(
        canonical,
        premiumAccess,
        teamTasks.map((t) => ({
          id: t.id,
          title: t.title,
          requirementId: t.requirementId,
          status: t.status,
          department: t.department,
          assigneeUser: t.assigneeUser,
          deadline: t.deadline,
        })),
      );
      timer.mark("explainable_built");
    } catch (error) {
      if (error instanceof DecisionExplanationMismatchError) {
        explainableConsistencyError = error.message;
      } else if (error instanceof AppError && error.code === ErrorCode.FORBIDDEN) {
        // Entitlement revoked mid-request — upgrade notice shown in UI.
      } else {
        throw error;
      }
    }
  }

  timer.mark("response_ready");
  timer.finish({ kind: "ready" });

  if (!executiveSummary) {
    return {
      kind: "in_progress",
      id: tender.id,
      title: tender.title,
      clientName: tender.clientName,
      deadline: tender.deadline,
      analyzedAt: tender.analyzedAt,
      status: tender.status,
      canMutate: tender.canMutate,
    };
  }

  return {
    kind: "ready",
    tender,
    report,
    executiveSummary,
    premiumAccess,
    explainableView,
    explainableConsistencyError,
    decisionOutcomeView,
    attachmentOptions,
    teamEnabled,
    teamTasks,
    teamMembers,
    teamSummary,
    reportFeatureAccess,
  };
}
