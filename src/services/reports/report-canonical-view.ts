/**
 * Canonical report section derivation — shared by UI report view and PDF.
 * Never recalculates Fit / Readiness / Bid Score / requirements; only slices
 * the TenderReport payload from getCanonicalTenderAnalysis.
 */

import type { DecisionOutcomeView } from "@/domain/decision-outcome-learning";
import type { ExplainableDecision } from "@/domain/explainable-decision";
import type { TenderActionPlanBundle } from "@/domain/tender-action-plan";
import type { VerificationIntelligenceBundle } from "@/domain/evidence-verification";
import { assertCanonicalFitConsistency } from "@/domain/decision/fit-consistency";
import type { ComplianceRow, StructuredRisk } from "@/domain/tender-intelligence";
import type { TenderReport } from "@/services/reports/types";
import { deriveExplainableDecisionForReport } from "@/services/reports/explainable-report";

export const PLACEHOLDER_EVIDENCE =
  "No supporting excerpt available — marked UNKNOWN.";

export const NOT_AVAILABLE = "Not available";

export function formatDeadlineDisplay(
  deadlineIso: string | null,
  _deadlineTimezone: string | null,
  deadlineStatus: CanonicalReportSections["deadlineStatus"],
  formattedWhenPresent: string,
): string {
  if (deadlineIso) return formattedWhenPresent;
  if (deadlineStatus === "CONFLICT") return "Conflict — Verify";
  if (deadlineStatus === "INCOMPLETE") return "Unavailable — deadline not in package";
  if (deadlineStatus === "UNKNOWN") return "Unavailable";
  return "Unknown — Verify";
}

export type CanonicalReportSections = {
  companyKnowledgeOnly: boolean;
  title: string;
  client: string | null;
  deadlineIso: string | null;
  deadlineTimezone: string | null;
  deadlineStatus?: "OK" | "UNKNOWN" | "CONFLICT" | "INCOMPLETE" | null;
  deadlineReason?: string | null;
  analyzedAt: string | null;
  decision: TenderReport["decision"];
  fitScoreDisplay: string;
  confidenceDisplay: string;
  reasoning: string;
  bidScore: TenderReport["bidScore"];
  bidScoreDisplay: string | null;
  fitBreakdown: TenderReport["fitBreakdown"];
  readiness: TenderReport["readiness"];
  readinessScoreDisplay: string | null;
  readinessTotal: number | null;
  readinessCounts: NonNullable<TenderReport["readiness"]>["counts"] | null;
  complianceSummary: TenderReport["complianceSummary"];
  complianceMatrix: ComplianceRow[];
  missingRequirements: ComplianceRow[];
  verifyRequirements: ComplianceRow[];
  readyRequirements: ComplianceRow[];
  risks: Array<
    | StructuredRisk
    | {
        id: string;
        category: string;
        description: string;
        severity: string;
        sourcePage: number | null;
        mitigation: string | null;
      }
  >;
  clarifications: NonNullable<
    NonNullable<TenderReport["intelligence"]>["clarificationQuestions"]
  >;
  evidence: TenderReport["evidence"];
  missingDocuments: TenderReport["missingDocuments"];
  nextActions: TenderReport["nextActions"];
  learningSignal: NonNullable<TenderReport["intelligence"]>["learningSignal"];
  decisionMemoryInsights: NonNullable<
    TenderReport["intelligence"]
  >["decisionMemoryInsights"];
  outcomeLearningInsights: NonNullable<
    TenderReport["intelligence"]
  >["outcomeLearningInsights"];
  decisionOutcome: DecisionOutcomeView | null;
  verificationIntelligence: VerificationIntelligenceBundle | null;
  explainableDecision: ExplainableDecision | null;
  actionPlan: TenderActionPlanBundle | null;
  canonicalTotalRequirements: number | null;
};

export type ReportFeatureAccess = {
  explainableDecision?: boolean;
  tenderActionPlan?: boolean;
  advancedAiTrust?: boolean;
  evidenceIntelligence?: boolean;
};

/** Explicit allow-all for regression tests only — production must resolve live entitlements. */
export const FULL_REPORT_FEATURE_ACCESS: Required<ReportFeatureAccess> = {
  explainableDecision: true,
  tenderActionPlan: true,
  advancedAiTrust: true,
  evidenceIntelligence: true,
};

/**
 * Derive every report section from the same TenderReport the UI receives.
 * Missing documents stay separate from tender requirements.
 */
export function deriveCanonicalReportSections(
  report: TenderReport,
  access: ReportFeatureAccess = {},
): CanonicalReportSections {
  const matrix = report.intelligence?.complianceMatrix ?? [];
  const companyKnowledgeOnly = report.companyKnowledgeOnly === true;
  const scoringUnavailable =
    companyKnowledgeOnly || report.fitBreakdown?.scoringAvailable === false;

  const fitScoreDisplay =
    scoringUnavailable || report.fitScore == null
      ? NOT_AVAILABLE
      : `${report.fitScore}%`;

  let bidScoreDisplay: string | null = null;
  if (report.bidScore && !companyKnowledgeOnly) {
    bidScoreDisplay =
      report.bidScore.scoringAvailable === false
        ? NOT_AVAILABLE
        : `${report.bidScore.score}/100 — ${report.bidScore.priorityLabel}`;
  }

  let readinessScoreDisplay: string | null = null;
  if (report.readiness && !companyKnowledgeOnly) {
    readinessScoreDisplay =
      report.readiness.scoringAvailable === false || report.readiness.score == null
        ? NOT_AVAILABLE
        : `${report.readiness.score}%`;
  }

  const evidence = report.evidence.filter(
    (e) => e.text && e.text !== PLACEHOLDER_EVIDENCE,
  );

  const deadlineStatus =
    report.intelligence?.canonicalSnapshot?.metadata.deadlineStatus ??
    report.intelligence?.canonicalSnapshot?.metadata.packageIdentity?.deadline.status ??
    null;
  const rawDeadline =
    deadlineStatus === "CONFLICT" || deadlineStatus === "INCOMPLETE"
      ? report.intelligence?.canonicalSnapshot?.metadata.deadlineIso ?? null
      : report.deadline;
  const deadlineIso =
    rawDeadline && /^\d{4}-\d{2}-\d{2}$/.test(rawDeadline)
      ? rawDeadline
      : rawDeadline && /T00:00:00(\.000)?Z$/i.test(rawDeadline)
        ? rawDeadline.slice(0, 10)
        : rawDeadline;
  const deadlineTimezone =
    deadlineIso && !deadlineIso.includes("T") ? null : report.deadlineTimezone;
  const deadlineReason =
    report.intelligence?.canonicalSnapshot?.metadata.packageIdentity?.deadline.reason ??
    null;

  return {
    companyKnowledgeOnly,
    title: report.title,
    client: report.client,
    deadlineIso,
    deadlineTimezone,
    deadlineStatus,
    deadlineReason,
    analyzedAt: report.analyzedAt,
    // Incomplete package: never surface BID / REVIEW / NO_BID
    decision: scoringUnavailable ? null : report.decision,
    fitScoreDisplay,
    confidenceDisplay: report.confidence ?? NOT_AVAILABLE,
    reasoning: report.reasoning?.trim() ? report.reasoning : NOT_AVAILABLE,
    bidScore: companyKnowledgeOnly ? null : report.bidScore,
    bidScoreDisplay,
    fitBreakdown: companyKnowledgeOnly ? null : report.fitBreakdown,
    readiness: companyKnowledgeOnly ? null : report.readiness,
    readinessScoreDisplay,
    readinessTotal:
      companyKnowledgeOnly ||
      scoringUnavailable ||
      !report.readiness
        ? null
        : (report.readiness.totalRequirements ?? report.readiness.total),
    readinessCounts:
      companyKnowledgeOnly || scoringUnavailable || !report.readiness
        ? null
        : report.readiness.counts,
    complianceSummary: companyKnowledgeOnly ? null : report.complianceSummary,
    complianceMatrix: companyKnowledgeOnly ? [] : matrix,
    missingRequirements: companyKnowledgeOnly
      ? []
      : matrix.filter((r) => r.status === "MISSING"),
    verifyRequirements: companyKnowledgeOnly
      ? []
      : matrix.filter((r) => r.status === "VERIFY"),
    readyRequirements: companyKnowledgeOnly
      ? []
      : matrix.filter((r) => r.status === "READY"),
    risks:
      companyKnowledgeOnly || scoringUnavailable
        ? []
        : (report.intelligence?.risks ?? report.criticalRisks),
    clarifications: companyKnowledgeOnly
      ? []
      : (report.intelligence?.clarificationQuestions ?? []),
    evidence,
    missingDocuments: report.missingDocuments,
    nextActions: report.nextActions,
    learningSignal: report.intelligence?.learningSignal ?? null,
    decisionMemoryInsights:
      report.intelligence?.decisionMemoryInsights ?? null,
    outcomeLearningInsights:
      report.intelligence?.outcomeLearningInsights ?? null,
    decisionOutcome: report.decisionOutcome ?? null,
    verificationIntelligence:
      companyKnowledgeOnly || access.evidenceIntelligence !== true
        ? null
        : (report.intelligence?.verificationIntelligence ?? null),
    explainableDecision:
      companyKnowledgeOnly || access.explainableDecision !== true
        ? null
        : deriveExplainableDecisionForReport(report, {
            includeAdvancedAiTrust: access.advancedAiTrust === true,
            includeEvidenceIntelligence: access.evidenceIntelligence === true,
          }),
    actionPlan:
      companyKnowledgeOnly || access.tenderActionPlan !== true
        ? null
        : report.intelligence?.actionPlan?.computed
          ? report.intelligence.actionPlan
          : null,
    canonicalTotalRequirements: companyKnowledgeOnly
      ? 0
      : (report.intelligence?.canonicalSnapshot?.counts.totalRequirements ??
        report.complianceSummary?.totalRequirements ??
        matrix.length),
  };
}

/** Invariant checks shared by UI/PDF regression tests. */
export function assertCanonicalReportIntegrity(
  sections: CanonicalReportSections,
): void {
  const summary = sections.complianceSummary;
  if (!summary) return;

  const authoritativeTotal =
    sections.canonicalTotalRequirements ?? summary.totalRequirements;

  if (authoritativeTotal !== sections.complianceMatrix.length) {
    throw new Error(
      `PDF/UI integrity: snapshot/summary.total=${authoritativeTotal} matrix=${sections.complianceMatrix.length}`,
    );
  }
  if (summary.totalRequirements !== authoritativeTotal) {
    throw new Error(
      `PDF/UI integrity: summary.total=${summary.totalRequirements} snapshot=${authoritativeTotal}`,
    );
  }
  if (summary.missing !== sections.missingRequirements.length) {
    throw new Error(
      `PDF/UI integrity: summary.missing=${summary.missing} rows=${sections.missingRequirements.length}`,
    );
  }
  if (summary.verify !== sections.verifyRequirements.length) {
    throw new Error(
      `PDF/UI integrity: summary.verify=${summary.verify} rows=${sections.verifyRequirements.length}`,
    );
  }
  if (summary.ready !== sections.readyRequirements.length) {
    throw new Error(
      `PDF/UI integrity: summary.ready=${summary.ready} rows=${sections.readyRequirements.length}`,
    );
  }
  if (
    sections.readinessTotal != null &&
    sections.readinessTotal !== summary.totalRequirements
  ) {
    throw new Error(
      `PDF/UI integrity: readiness.total=${sections.readinessTotal} summary.total=${summary.totalRequirements}`,
    );
  }
  if (sections.verificationIntelligence) {
    const vi = sections.verificationIntelligence;
    if (vi.summary.total !== sections.complianceMatrix.length) {
      throw new Error(
        `PDF/UI integrity: verification.total=${vi.summary.total} matrix=${sections.complianceMatrix.length}`,
      );
    }
  }
  if (
    sections.fitBreakdown &&
    sections.fitScoreDisplay &&
    sections.fitScoreDisplay !== NOT_AVAILABLE
  ) {
    const parsed = Number.parseInt(sections.fitScoreDisplay.replace(/[^\d]/g, ""), 10);
    if (
      Number.isFinite(parsed) &&
      sections.fitBreakdown.overall != null &&
      sections.fitBreakdown.overall !== parsed
    ) {
      throw new Error(
        `PDF/UI integrity: fit display ${parsed}% != breakdown.overall ${sections.fitBreakdown.overall}%`,
      );
    }
    assertCanonicalFitConsistency({
      fitScore: sections.fitBreakdown.overall,
      fitBreakdown: sections.fitBreakdown,
      reasoning: sections.reasoning,
      label: "report-sections",
    });
  }
  if (sections.readinessCounts) {
    const c = sections.readinessCounts;
    if (
      c.ready !== summary.ready ||
      c.missing !== summary.missing ||
      c.verify !== summary.verify
    ) {
      throw new Error(
        "PDF/UI integrity: readiness counts diverge from compliance summary",
      );
    }
  }
}
