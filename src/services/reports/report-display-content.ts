/**
 * Shared report display strings — used by web view, PDF, and integrity checks.
 * Built ONLY from CanonicalReportSections; never recalculates scores or requirements.
 */

import {
  formatSourceLocation,
  NO_COMPANY_EVIDENCE_MESSAGE,
} from "@/domain/provenance";
import type { RequirementVerificationStatus } from "@/domain/evidence-verification";
import type { ComplianceRow } from "@/domain/tender-intelligence";
import type { Locale } from "@/i18n/config";
import { defaultLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getDecisionLabel } from "@/lib/labels";
import {
  NOT_AVAILABLE,
  deriveCanonicalReportSections,
  FULL_REPORT_FEATURE_ACCESS,
  type CanonicalReportSections,
} from "@/services/reports/report-canonical-view";
import type { TenderReport } from "@/services/reports/types";
import {
  buildTopReasons,
  evidenceStateExplainLabel,
  formatSourceLine,
  type ExplainableDecision,
} from "@/domain/explainable-decision";
import {
  formatActionPlanReportLine,
  selectTopActions,
} from "@/domain/tender-action-plan/presentation";

/** User-facing recommendation when the package cannot support Bid/No-Bid. */
export const ANALYSIS_INCOMPLETE_LABEL = "ANALYSIS INCOMPLETE";

function reportIncompleteAnalysis(sections: CanonicalReportSections): boolean {
  return (
    sections.fitBreakdown?.scoringAvailable === false ||
    (sections.complianceSummary?.totalRequirements === 0 && sections.decision == null)
  );
}

export type ComplianceRowDisplay = {
  id: string;
  status: string;
  mandatoryLabel: string;
  requirement: string;
  evidenceQuoted: string | null;
  companyEvidenceLine: string;
  sourceLine: string;
};

export type VerificationChainDisplay = {
  requirementId: string;
  status: RequirementVerificationStatus;
  statusLabel: string;
  requirement: string;
  reason: string | null;
  locationLine: string | null;
  excerptLine: string | null;
  verifierLine: string | null;
};

export type ReportDisplayContent = {
  locale: Locale;
  decisionLabel: string;
  fitScoreDisplay: string;
  confidenceDisplay: string;
  bidScoreDisplay: string | null;
  readinessScoreDisplay: string | null;
  readinessCountsLine: string | null;
  complianceSummaryLine: string | null;
  executiveComplianceLine: string | null;
  reasoning: string;
  missingRequirementLines: string[];
  verifyRequirementLines: string[];
  riskLines: string[];
  clarificationLines: string[];
  evidenceLines: string[];
  missingDocumentLines: string[];
  nextActionLines: string[];
  sourceLines: string[];
  complianceRows: ComplianceRowDisplay[];
  fitDimensionScores: Array<{ key: string; label: string; scoreDisplay: string }>;
  fitOverallDisplay: string | null;
  fitRequirementsNote: string | null;
  fitRecommendation: string | null;
  readinessAttentionLines: string[];
  readinessNextStepLine: string | null;
  historicalLines: string[];
  bidScoreMetaLine: string | null;
  bidScorePositiveDrivers: string[];
  bidScoreNegativeDrivers: string[];
  bidScoreDisclaimer: string | null;
  verificationSummaryLine: string | null;
  verificationDisclaimer: string | null;
  verificationChains: VerificationChainDisplay[];
  explainableWhyHeadline: string | null;
  explainableTopReasonLines: string[];
  explainableBlockerLines: string[];
  explainableRequirementLines: string[];
  explainableEvidenceLines: string[];
  explainableRiskLines: string[];
  explainableFitLines: string[];
  explainableReadinessLines: string[];
  explainableMemoryLines: string[];
  explainableUnknownLines: string[];
  explainableActionLines: string[];
  actionPlanLines: string[];
  actionPlanDeadlineLine: string | null;
  actionPlanUrgencyLine: string | null;
};

type ReportCopy = ReturnType<typeof getDictionary>["app"]["report"];

function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function buildExplainableDisplayContent(explanation: ExplainableDecision | null): {
  explainableWhyHeadline: string | null;
  explainableTopReasonLines: string[];
  explainableBlockerLines: string[];
  explainableRequirementLines: string[];
  explainableEvidenceLines: string[];
  explainableRiskLines: string[];
  explainableFitLines: string[];
  explainableReadinessLines: string[];
  explainableMemoryLines: string[];
  explainableUnknownLines: string[];
  explainableActionLines: string[];
} {
  const empty = {
    explainableWhyHeadline: null,
    explainableTopReasonLines: [],
    explainableBlockerLines: [],
    explainableRequirementLines: [],
    explainableEvidenceLines: [],
    explainableRiskLines: [],
    explainableFitLines: [],
    explainableReadinessLines: [],
    explainableMemoryLines: [],
    explainableUnknownLines: [],
    explainableActionLines: [],
  };
  if (!explanation) return empty;

  const formatItem = (item: { what: string; why: string; status: string | null; impact: string; source: { located: boolean }; referenceOnly?: boolean }) => {
    const status =
      item.status && ["MISSING", "FOUND_UNVERIFIED", "VERIFIED", "EXPIRED", "INVALID", "UNKNOWN"].includes(item.status)
        ? evidenceStateExplainLabel(item.status)
        : item.status;
    const parts = [item.what, status ? `Status: ${status}` : null, `Impact: ${item.impact}`, item.referenceOnly ? "(Historical context only)" : null].filter(Boolean);
    return truncate(parts.join(" — "), 320);
  };

  const topReasons = buildTopReasons(explanation);
  const blockers = explanation.sections.keyReasons.filter((i) => i.category === "BLOCKER");

  return {
    explainableWhyHeadline: explanation.executiveSummary.whyHeadline,
    explainableTopReasonLines: topReasons.map((r) => truncate(r.text, 240)),
    explainableBlockerLines: blockers.map((b) => formatItem(b)),
    explainableRequirementLines: explanation.sections.requirements.slice(0, 12).map((r) => `${formatItem(r)} · ${formatSourceLine(r)}`),
    explainableEvidenceLines: explanation.sections.evidence.slice(0, 12).map((e) => `${formatItem(e)} · ${formatSourceLine(e)}`),
    explainableRiskLines: explanation.sections.risks.slice(0, 8).map(formatItem),
    explainableFitLines: explanation.sections.companyFit.slice(0, 6).map(formatItem),
    explainableReadinessLines: explanation.sections.readiness.slice(0, 6).map(formatItem),
    explainableMemoryLines: explanation.sections.historicalSignals.map(
      (m) => `[Historical signal] ${formatItem(m)}`,
    ),
    explainableUnknownLines: explanation.sections.unknowns.map(formatItem),
    explainableActionLines: explanation.sections.actions.map((a) => truncate(a.what, 240)),
  };
}

function formatComplianceSource(row: ComplianceRow, t: ReportCopy): string {
  if (!row.sourceLocated) return t.sourceNotLocated;
  return [row.sourceDocument, row.section, row.pageNumber != null ? t.page.replace("{n}", String(row.pageNumber)) : null]
    .filter(Boolean)
    .join(" · ");
}

function formatUnavailableScore(display: string | null): string | null {
  if (!display || display === NOT_AVAILABLE) return NOT_AVAILABLE;
  return display;
}

function verificationStatusLabel(
  status: RequirementVerificationStatus,
  t: ReportCopy,
): string {
  switch (status) {
    case "VERIFIED":
      return t.verificationStatusVerified;
    case "NEEDS_VERIFICATION":
      return t.verificationStatusNeedsVerification;
    case "MISSING_EVIDENCE":
      return t.verificationStatusMissingEvidence;
    case "NOT_APPLICABLE":
      return t.verificationStatusNotApplicable;
    default:
      return status;
  }
}

/** Build every user-visible string the PDF/web report displays from canonical sections. */
export function buildReportDisplayContent(
  sections: CanonicalReportSections,
  locale: Locale = defaultLocale,
): ReportDisplayContent {
  const t = getDictionary(locale).app.report;

  const decisionLabel = sections.decision
    ? getDecisionLabel(sections.decision, locale)
    : sections.companyKnowledgeOnly
      ? "—"
      : sections.fitBreakdown?.scoringAvailable === false ||
          reportIncompleteAnalysis(sections)
        ? ANALYSIS_INCOMPLETE_LABEL
        : NOT_AVAILABLE;

  const readinessCountsLine =
    sections.readinessCounts && !sections.companyKnowledgeOnly
      ? t.readinessCounts
          .replace("{ready}", String(sections.readinessCounts.ready))
          .replace("{verify}", String(sections.readinessCounts.verify))
          .replace("{missing}", String(sections.readinessCounts.missing))
      : null;

  const complianceSummary = sections.complianceSummary;
  const complianceSummaryLine = complianceSummary
    ? `${complianceSummary.totalRequirements} ${t.requirements.toLowerCase()} · ${complianceSummary.ready} ${t.ready.toLowerCase()} · ${complianceSummary.missing} ${t.missing.toLowerCase()} · ${complianceSummary.verify} ${t.verify.toLowerCase()} · ${complianceSummary.notApplicable} ${t.notApplicable.toLowerCase()} · ${complianceSummary.sources} ${t.withSources.toLowerCase()}`
    : null;

  const executiveComplianceLine = complianceSummary
    ? `${complianceSummary.totalRequirements} ${t.requirements.toLowerCase()} · ${complianceSummary.ready} ${t.ready} · ${complianceSummary.verify} ${t.verify} · ${complianceSummary.missing} ${t.missing}`
    : null;

  const missingRequirementLines = sections.missingRequirements.map(
    (r) =>
      `${r.requirement}${r.mandatory ? t.mandatoryParen : ""}${
        r.requiredAction ? ` — ${r.requiredAction}` : ""
      }`,
  );

  const verifyRequirementLines = sections.verifyRequirements.map(
    (r) =>
      `${r.requirement}${r.requiredAction ? ` — ${r.requiredAction}` : ""}`,
  );

  const riskLines = sections.risks.map((r) => {
    if ("explanation" in r) {
      return `${r.severity}: ${r.title} — ${r.explanation}`;
    }
    return `[${r.severity}] ${r.category}: ${r.description}`;
  });

  const clarificationLines = sections.clarifications.map(
    (q) => `${q.question} (${q.reason})`,
  );

  const evidenceLines = sections.evidence.map((e) => {
    const loc = [e.sourceSection, e.sourcePage != null ? t.page.replace("{n}", String(e.sourcePage)) : null]
      .filter(Boolean)
      .join(" · ");
    return `“${truncate(e.text, 260)}”${loc ? ` — ${loc}` : ""}`;
  });

  const missingDocumentLines = sections.missingDocuments.map(
    (d) => `${d.documentName} — ${d.reason}`,
  );

  const nextActionLines = (() => {
    const plan = sections.actionPlan;
    if (plan?.computed) {
      const open = selectTopActions(
        plan.items.filter((i) => !i.simulationOnly),
        8,
      );
      if (open.length > 0) {
        return open.map((item, i) => formatActionPlanReportLine(item, i));
      }
    }
    return sections.nextActions.map(
      (a, i) => `${i + 1}. ${a.title}${a.description ? ` — ${a.description}` : ""}`,
    );
  })();

  const actionPlanLines = sections.actionPlan?.computed
    ? selectTopActions(
        sections.actionPlan.items.filter((i) => !i.simulationOnly),
        10,
      ).map((item, i) => formatActionPlanReportLine(item, i))
    : [];

  const actionPlanDeadlineLine = sections.actionPlan?.deadlineUrgency.tenderDeadline
    ? sections.actionPlan.deadlineUrgency.daysRemaining != null
      ? `Tender deadline: ${sections.actionPlan.deadlineUrgency.tenderDeadline.slice(0, 10)} (${sections.actionPlan.deadlineUrgency.daysRemaining} day(s) remaining)`
      : `Tender deadline: ${sections.actionPlan.deadlineUrgency.tenderDeadline.slice(0, 10)}`
    : sections.deadlineIso
      ? `Tender deadline: ${sections.deadlineIso.slice(0, 10)}`
      : sections.deadlineStatus === "CONFLICT"
        ? `Deadline: Conflict — Verify${sections.deadlineReason ? ` — ${sections.deadlineReason}` : ""}`
        : sections.deadlineStatus === "INCOMPLETE"
          ? `Deadline: Unavailable — deadline not in package${sections.deadlineReason ? ` — ${sections.deadlineReason}` : ""}`
          : sections.deadlineStatus === "UNKNOWN"
            ? `Deadline unavailable${sections.deadlineReason ? ` — ${sections.deadlineReason}` : ""}`
            : "Deadline unavailable";

  const actionPlanUrgencyLine = sections.actionPlan?.deadlineUrgency.urgencyNote ?? null;

  const sourceLines = sections.complianceMatrix
    .filter((row) => row.sourceLocated)
    .map((row) => {
      const loc = formatComplianceSource(row, t);
      return `${truncate(row.requirement, 80)} — ${loc}`;
    })
    .slice(0, 40);

  const complianceRows: ComplianceRowDisplay[] = sections.complianceMatrix.map(
    (row) => ({
      id: row.id,
      status: row.status,
      mandatoryLabel: row.mandatory ? t.mandatory : t.optional,
      requirement: row.requirement,
      evidenceQuoted: row.evidence ? truncate(row.evidence, 160) : null,
      companyEvidenceLine:
        row.companyEvidence?.excerpt ??
        row.companyEvidenceMessage ??
        NO_COMPANY_EVIDENCE_MESSAGE,
      sourceLine: `${t.source.replace(/:$/, "")}: ${
        row.tenderSource
          ? formatSourceLocation(row.tenderSource)
          : formatComplianceSource(row, t)
      }`,
    }),
  );

  const fitDimensionScores =
    sections.fitBreakdown?.dimensions.map((dim) => ({
      key: dim.key,
      label: dim.label,
      scoreDisplay:
        dim.status === "unknown" || dim.score == null
          ? t.unknown
          : `${dim.score}%`,
    })) ?? [];

  const fitOverallDisplay =
    sections.fitBreakdown &&
    (sections.fitBreakdown.scoringAvailable === false ||
      sections.fitBreakdown.overall == null)
      ? t.unknown
      : sections.fitBreakdown?.overall != null
        ? `${sections.fitBreakdown.overall}%`
        : null;

  const requirementsDimension = sections.fitBreakdown?.dimensions.find(
    (d) => d.key === "requirements",
  );
  const fitRequirementsNote =
    fitOverallDisplay &&
    fitOverallDisplay !== t.unknown &&
    requirementsDimension?.score != null
      ? `Overall company–tender fit (${fitOverallDisplay}) reflects multi-dimensional alignment. Requirements score (${requirementsDimension.score}%) measures evidence coverage of canonical requirements only.`
      : null;

  const historicalLines: string[] = [];
  if (sections.learningSignal?.detected) {
    historicalLines.push(sections.learningSignal.headline);
    historicalLines.push(t.historicalBody);
    historicalLines.push(t.historicalPriority);
    if (
      !sections.learningSignal.influenceAllowed &&
      sections.learningSignal.suppressedReason
    ) {
      historicalLines.push(sections.learningSignal.suppressedReason);
    }
  }

  let bidScoreMetaLine: string | null = null;
  let bidScorePositiveDrivers: string[] = [];
  let bidScoreNegativeDrivers: string[] = [];
  let bidScoreDisclaimer: string | null = null;
  if (sections.bidScore && !sections.companyKnowledgeOnly) {
    const bs = sections.bidScore;
    bidScoreMetaLine = `${bs.expectedValue} EV · ${bs.riskLevel} risk · ${bs.effort} effort`;
    bidScorePositiveDrivers = bs.drivers
      .filter((d) => d.direction === "positive")
      .map((d) => d.label);
    bidScoreNegativeDrivers = bs.drivers
      .filter((d) => d.direction === "negative")
      .map((d) => d.label);
    bidScoreDisclaimer = bs.disclaimer;
  }

  const vi = sections.verificationIntelligence;
  const verificationSummaryLine =
    vi && !sections.companyKnowledgeOnly
      ? t.verificationSummary
          .replace("{verified}", String(vi.summary.verified))
          .replace("{needs}", String(vi.summary.needsVerification))
          .replace("{missing}", String(vi.summary.missingEvidence))
          .replace("{na}", String(vi.summary.notApplicable))
      : null;
  const verificationDisclaimer = vi?.disclaimer ?? t.evidenceVerificationDisclaimer;
  const verificationChains: VerificationChainDisplay[] =
    vi?.chains.map((chain) => ({
      requirementId: chain.requirementId,
      status: chain.verificationStatus,
      statusLabel: verificationStatusLabel(chain.verificationStatus, t),
      requirement: chain.requirement,
      reason: chain.verificationReason,
      locationLine: chain.locationLabel,
      excerptLine: chain.evidenceExcerpt
        ? truncate(chain.evidenceExcerpt, 220)
        : null,
      verifierLine:
        chain.verifierLabel && chain.verifiedAt
          ? `${t.verifierLabel} ${chain.verifierLabel} · ${t.verifiedAtLabel} ${chain.verifiedAt}`
          : chain.verifierLabel
            ? `${t.verifierLabel} ${chain.verifierLabel}`
            : null,
    })) ?? [];

  const explainableFields = buildExplainableDisplayContent(sections.explainableDecision);

  return {
    locale,
    decisionLabel,
    fitScoreDisplay: sections.fitScoreDisplay,
    confidenceDisplay: sections.confidenceDisplay,
    bidScoreDisplay: sections.bidScoreDisplay,
    readinessScoreDisplay: formatUnavailableScore(sections.readinessScoreDisplay),
    readinessCountsLine,
    complianceSummaryLine,
    executiveComplianceLine,
    reasoning: sections.reasoning,
    missingRequirementLines,
    verifyRequirementLines,
    riskLines,
    clarificationLines,
    evidenceLines,
    missingDocumentLines,
    nextActionLines,
    sourceLines,
    complianceRows,
    fitDimensionScores,
    fitOverallDisplay,
    fitRequirementsNote,
    fitRecommendation: sections.fitBreakdown?.recommendation ?? null,
    readinessAttentionLines: sections.readiness?.attention ?? [],
    readinessNextStepLine: sections.readiness
      ? `${t.nextStep.replace(/:$/, "")}: ${sections.readiness.recommendation}`
      : null,
    historicalLines,
    bidScoreMetaLine,
    bidScorePositiveDrivers,
    bidScoreNegativeDrivers,
    bidScoreDisclaimer,
    verificationSummaryLine,
    verificationDisclaimer,
    verificationChains,
    actionPlanLines,
    actionPlanDeadlineLine,
    actionPlanUrgencyLine,
    ...explainableFields,
  };
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Fail PDF generation if display content diverges from canonical sections/report.
 * Re-derives content and compares; also guards against legacy report list usage.
 */
export function assertPdfCanonicalConsistency(
  report: TenderReport,
  sections: CanonicalReportSections,
  content: ReportDisplayContent,
): void {
  const rederived = deriveSectionsMatch(report, sections);
  void rederived;

  const rebuilt = buildReportDisplayContent(sections, content.locale);
  if (stableJson(rebuilt) !== stableJson(content)) {
    throw new Error(
      "PDF generation blocked: display content does not match canonical sections",
    );
  }

  if (content.missingRequirementLines.length !== sections.missingRequirements.length) {
    throw new Error("PDF integrity: missing requirement line count mismatch");
  }
  for (let i = 0; i < sections.missingRequirements.length; i++) {
    const row = sections.missingRequirements[i]!;
    if (!content.missingRequirementLines[i]!.includes(row.requirement)) {
      throw new Error(`PDF integrity: missing requirement text mismatch for ${row.id}`);
    }
  }

  if (content.complianceRows.length !== sections.complianceMatrix.length) {
    throw new Error("PDF integrity: compliance matrix row count mismatch");
  }
  for (let i = 0; i < sections.complianceMatrix.length; i++) {
    const row = sections.complianceMatrix[i]!;
    const display = content.complianceRows[i]!;
    if (display.id !== row.id || display.requirement !== row.requirement) {
      throw new Error(`PDF integrity: compliance row ${row.id} mismatch`);
    }
    if (display.status !== row.status) {
      throw new Error(`PDF integrity: compliance status mismatch for ${row.id}`);
    }
    const expectedSource =
      row.tenderSource != null
        ? formatSourceLocation(row.tenderSource)
        : null;
    if (expectedSource && !display.sourceLine.includes(expectedSource.split(" · ")[0] ?? expectedSource)) {
      const docName = row.tenderSource?.documentName;
      if (docName && !display.sourceLine.includes(docName)) {
        throw new Error(`PDF integrity: compliance source mismatch for ${row.id}`);
      }
    }
    const expectedCompany =
      row.companyEvidence?.excerpt ??
      row.companyEvidenceMessage ??
      NO_COMPANY_EVIDENCE_MESSAGE;
    if (display.companyEvidenceLine !== expectedCompany) {
      throw new Error(`PDF integrity: company evidence mismatch for ${row.id}`);
    }
  }

  if (
    sections.complianceSummary &&
    content.executiveComplianceLine &&
    !content.executiveComplianceLine.includes(
      String(sections.complianceSummary.totalRequirements),
    )
  ) {
    throw new Error("PDF integrity: executive compliance totals mismatch");
  }

  if (
    sections.bidScore &&
    content.bidScoreDisplay &&
    content.bidScoreDisplay !== NOT_AVAILABLE &&
    !content.bidScoreDisplay.includes(String(sections.bidScore.score))
  ) {
    throw new Error("PDF integrity: bid score display mismatch");
  }

  if (sections.verificationIntelligence) {
    if (
      content.verificationChains.length !==
      sections.verificationIntelligence.chains.length
    ) {
      throw new Error("PDF integrity: verification chain count mismatch");
    }
    for (let i = 0; i < sections.verificationIntelligence.chains.length; i++) {
      const chain = sections.verificationIntelligence.chains[i]!;
      const display = content.verificationChains[i]!;
      if (
        display.requirementId !== chain.requirementId ||
        display.status !== chain.verificationStatus
      ) {
        throw new Error(
          `PDF integrity: verification chain mismatch for ${chain.requirementId}`,
        );
      }
    }
  }

  assertLegacyListsUnused(report, sections);
}

function deriveSectionsMatch(
  report: TenderReport,
  sections: CanonicalReportSections,
): CanonicalReportSections {
  const again = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
  const keys: (keyof CanonicalReportSections)[] = [
    "title",
    "client",
    "decision",
    "fitScoreDisplay",
    "confidenceDisplay",
    "bidScoreDisplay",
    "readinessScoreDisplay",
    "readinessTotal",
    "reasoning",
  ];
  for (const key of keys) {
    if (stableJson(sections[key]) !== stableJson(again[key])) {
      throw new Error(`PDF integrity: canonical sections field "${key}" diverges from report`);
    }
  }
  if (sections.complianceMatrix.length !== again.complianceMatrix.length) {
    throw new Error("PDF integrity: compliance matrix length diverges from report");
  }
  return again;
}

/** PDF must never read legacy engine lists when intelligence matrix exists. */
function assertLegacyListsUnused(
  report: TenderReport,
  sections: CanonicalReportSections,
): void {
  if (!report.intelligence?.complianceMatrix?.length) return;
  const matrixReqs = new Set(
    sections.complianceMatrix.map((r) => r.requirement),
  );
  for (const legacy of [...report.failed, ...report.uncertain, ...report.matched]) {
    if (
      legacy.description &&
      !matrixReqs.has(legacy.description) &&
      sections.missingRequirements.some((r) => r.requirement === legacy.description)
    ) {
      throw new Error(
        "PDF integrity: legacy requirement list disagrees with compliance matrix",
      );
    }
  }
}
