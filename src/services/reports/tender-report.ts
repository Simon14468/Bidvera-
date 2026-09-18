import { requireCompanyId } from "@/auth/session";
import type { TenderIntelligenceBreakdown } from "@/domain/tender-intelligence";
import { defaultLocale } from "@/i18n/config";
import {
  NOT_AVAILABLE,
  assertCanonicalReportIntegrity,
  deriveCanonicalReportSections,
  formatDeadlineDisplay,
  FULL_REPORT_FEATURE_ACCESS,
  type CanonicalReportSections,
} from "@/services/reports/report-canonical-view";
import {
  assertPdfCanonicalConsistency,
  buildReportDisplayContent,
} from "@/services/reports/report-display-content";
import type { TenderReport } from "@/services/reports/types";
import { getCanonicalTenderAnalysis } from "@/application/canonical-tender-analysis";
import { parseCanonicalDeadlineIso } from "@/domain/tender-requirements/tender-deadline";
import type { CanonicalTenderAnalysis } from "@/domain/tender-intelligence";
import {
  getPremiumFeatureAccess,
  projectIntelligenceForEntitlements,
  type PremiumFeatureAccess,
} from "@/services/entitlements/intelligence-projection";
import type { DecisionOutcomeView } from "@/domain/decision-outcome-learning";

export type { TenderReport } from "@/services/reports/types";

/**
 * Build report payload from an already-loaded canonical analysis.
 * Avoids duplicate DB reads when the result page already fetched canonical data.
 */
export function buildTenderReportFromCanonical(
  canonical: CanonicalTenderAnalysis,
  options: {
    premiumAccess: PremiumFeatureAccess;
    decisionOutcome: DecisionOutcomeView | null;
  },
): TenderReport {
  const { premiumAccess, decisionOutcome } = options;

  const matched = canonical.requirements.filter((r) => r.status === "MATCHED");
  const failed = canonical.requirements.filter((r) => r.status === "FAILED");
  const uncertain = canonical.requirements.filter(
    (r) => r.status === "UNCERTAIN" || r.status === "MISSING",
  );
  const criticalRisks = canonical.risks.filter(
    (r) => r.severity === "HIGH" || r.severity === "CRITICAL",
  );

  const intelligenceForCustomer = canonical.intelligence
    ? (() => {
        const { analysisTrace: _hidden, ...rest } = canonical.intelligence;
        void _hidden;
        return rest as TenderIntelligenceBreakdown;
      })()
    : null;

  const projectedIntelligence = projectIntelligenceForEntitlements(
    intelligenceForCustomer,
    premiumAccess,
  );

  return {
    tenderId: canonical.tenderId,
    companyId: canonical.companyId,
    title: canonical.title,
    client: canonical.client,
    deadline: canonical.deadline,
    deadlineTimezone: canonical.deadlineTimezone,
    analyzedAt: canonical.analyzedAt,
    decision: canonical.decision,
    fitScore: canonical.fitScore,
    confidence: canonical.confidence,
    reasoning: canonical.reasoning,
    companyKnowledgeOnly: canonical.companyKnowledgeOnly === true,
    fitBreakdown: canonical.fitBreakdown,
    readiness: canonical.readiness,
    intelligence: projectedIntelligence,
    complianceSummary: projectedIntelligence?.complianceSummary ?? null,
    bidScore: canonical.companyKnowledgeOnly ? null : canonical.bidScore,
    historicalSignals: canonical.historicalSignals,
    matched: matched.map(mapReq),
    failed: failed.map(mapReq),
    uncertain: uncertain.map(mapReq),
    criticalRisks: criticalRisks.map((r) => ({
      id: r.id,
      category: r.category,
      description: r.description,
      severity: r.severity,
      sourcePage: r.sourcePage,
      mitigation: r.mitigation,
    })),
    missingDocuments: canonical.missingDocuments.map((d) => ({
      id: d.id,
      documentName: d.documentName,
      reason: d.reason,
      severity: d.severity,
    })),
    evidence: canonical.evidence.map((e) => ({
      id: e.id,
      text: e.evidenceText,
      sourcePage: e.sourcePage,
      sourceSection: e.sourceSection,
      verificationStatus: e.verificationStatus,
    })),
    nextActions: canonical.nextActions.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      priority: a.priority,
    })),
    decisionOutcome,
  };
}

/**
 * Report payload from the ONE canonical analysis.
 * Identical analytical truth for all authorized viewers — never role-personalized.
 */
export async function getTenderReportForCompany(
  tenderId: string,
  companyId: string,
): Promise<TenderReport> {
  const canonical = await getCanonicalTenderAnalysis(tenderId, companyId);
  const { getDecisionOutcomeView } = await import(
    "@/services/decision-outcome-learning"
  );
  const [decisionOutcome, premiumAccess] = await Promise.all([
    getDecisionOutcomeView(companyId, tenderId),
    getPremiumFeatureAccess(companyId),
  ]);

  const report = buildTenderReportFromCanonical(canonical, {
    premiumAccess,
    decisionOutcome,
  });

  // Same fail-closed publication gate as PDF — Web must not release ungated analysis.
  const { assertReportPublicationAllowed, hashCanonicalReleasePayload } =
    await import("@/domain/decision-validation");
  const projectedHash = hashCanonicalReleasePayload(
    (report.intelligence?.complianceMatrix ?? []).map((row) => ({
      id: row.requirementId,
      text: row.requirement,
    })),
  );
  assertReportPublicationAllowed({
    companyKnowledgeOnly: report.companyKnowledgeOnly === true,
    analysisMode: report.intelligence?.analysisMode ?? null,
    complianceStatus: report.intelligence?.complianceStatus ?? null,
    decisionGuardian: report.intelligence?.decisionGuardian ?? null,
    projectedContentHash: projectedHash,
    web: {
      decision: report.decision,
      fitScore: report.fitScore,
      deadlineIso: report.deadline,
      requirementCount:
        report.intelligence?.complianceSummary?.totalRequirements ??
        report.intelligence?.complianceMatrix?.length ??
        0,
    },
    pdf: {
      decision: report.decision,
      fitScore: report.fitScore,
      deadlineIso: report.deadline,
      requirementCount:
        report.intelligence?.complianceSummary?.totalRequirements ??
        report.intelligence?.complianceMatrix?.length ??
        0,
    },
  });

  return report;
}

export async function getTenderReportForSession(tenderId: string) {
  const { companyId } = await requireCompanyId();
  return getTenderReportForCompany(tenderId, companyId);
}

/** Resolve plan-gated report sections for a company (server-side only). */
export async function getReportFeatureAccess(companyId: string) {
  const { hasFeature } = await import("@/services/entitlements");
  const [
    explainableDecision,
    tenderActionPlan,
    advancedAiTrust,
    evidenceIntelligence,
  ] = await Promise.all([
    hasFeature(companyId, "explainable_decision"),
    hasFeature(companyId, "tender_action_plan"),
    hasFeature(companyId, "advanced_ai_trust"),
    hasFeature(companyId, "evidence_intelligence"),
  ]);
  return {
    explainableDecision,
    tenderActionPlan,
    advancedAiTrust,
    evidenceIntelligence,
  };
}

function mapReq(r: {
  id: string;
  description: string;
  category: string;
  sourcePage: number | null;
  sourceSection: string | null;
}) {
  return {
    id: r.id,
    description: r.description,
    category: r.category,
    sourcePage: r.sourcePage,
    sourceSection: r.sourceSection,
  };
}

/**
 * Server-side PDF buffer — maps ONLY canonical TenderReport sections
 * (same derivation as the UI). Does not recalculate scores or requirements.
 * Presentation: premium Bidvera enterprise layout.
 */
export function buildTenderReportPdfFileName(title: string, tenderId: string): string {
  const safeName = title.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 60);
  return `bidvera-report-${safeName || tenderId}.pdf`;
}

export async function buildTenderReportPdf(
  report: TenderReport,
  options?: {
    locale?: import("@/i18n/config").Locale;
    companyName?: string | null;
    appOrigin?: string | null;
    /** Re-parse the PDF after render. Tests only — never the download path. */
    validate?: boolean;
  },
): Promise<Buffer> {
  const { resolvePdfLocale } = await import(
    "@/services/reports/premium-pdf-locale"
  );
  // Arabic UI → English PDF; Latin-script locales keep their language.
  const locale = resolvePdfLocale(options?.locale ?? defaultLocale);
  const featureAccess = await getReportFeatureAccess(report.companyId);
  const sections = deriveCanonicalReportSections(report, {
    explainableDecision: featureAccess.explainableDecision,
    tenderActionPlan: featureAccess.tenderActionPlan,
    advancedAiTrust: featureAccess.advancedAiTrust,
    evidenceIntelligence: featureAccess.evidenceIntelligence,
  });
  assertCanonicalReportIntegrity(sections);
  const content = buildReportDisplayContent(sections, locale);
  assertPdfCanonicalConsistency(report, sections, content);

  // Decision Validation Engine — fail-closed publication gate (no Guardian → no PDF)
  const { assertReportPublicationAllowed, hashCanonicalReleasePayload } =
    await import("@/domain/decision-validation");
  const projectedHash = hashCanonicalReleasePayload(
    (report.intelligence?.complianceMatrix ?? []).map((row) => ({
      id: row.requirementId,
      text: row.requirement,
    })),
  );
  assertReportPublicationAllowed({
    companyKnowledgeOnly: report.companyKnowledgeOnly === true,
    analysisMode: report.intelligence?.analysisMode ?? null,
    complianceStatus: report.intelligence?.complianceStatus ?? null,
    decisionGuardian: report.intelligence?.decisionGuardian ?? null,
    projectedContentHash: projectedHash,
    web: {
      decision: report.decision,
      fitScore: report.fitScore,
      deadlineIso: report.deadline,
      requirementCount:
        report.intelligence?.complianceSummary?.totalRequirements ??
        report.intelligence?.complianceMatrix?.length ??
        0,
    },
    pdf: {
      decision: sections.decision,
      fitScore: report.fitScore,
      deadlineIso: sections.deadlineIso,
      requirementCount:
        sections.complianceSummary?.totalRequirements ??
        sections.complianceMatrix.length,
    },
  });

  const { renderPremiumReportPdf } = await import(
    "@/services/reports/premium-pdf-report"
  );
  return renderPremiumReportPdf(sections, {
    ...options,
    locale,
    content,
    validate: options?.validate === true,
  });
}

/** Exposed for regression tests — PDF text content model without PDFKit. */
export function buildTenderReportPdfPlainText(report: TenderReport): string {
  const sections = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
  assertCanonicalReportIntegrity(sections);
  return formatCanonicalReportPlainText(sections);
}

/** @deprecated Prefer renderPremiumReportPdf — kept for plain-layout fallback tests. */
export function renderCanonicalReportPdf(
  sections: CanonicalReportSections,
): Promise<Buffer> {
  return import("@/services/reports/premium-pdf-report").then(({ renderPremiumReportPdf }) =>
    renderPremiumReportPdf(sections),
  );
}

export function formatCanonicalReportPlainText(
  sections: CanonicalReportSections,
): string {
  const lines: string[] = [];
  const push = (s = "") => lines.push(s);

  push("# Bidvera Decision Report");
  push(sections.title);
  if (sections.client) push(`Client: ${sections.client}`);
  push(
    `Deadline: ${
      formatDeadlineDisplay(
        sections.deadlineIso,
        sections.deadlineTimezone,
        sections.deadlineStatus ?? null,
        sections.deadlineIso
          ? `${formatIso(sections.deadlineIso)}${
              sections.deadlineTimezone ? ` (${sections.deadlineTimezone})` : ""
            }`
          : "",
      )
    }`,
  );
  push(`Analyzed: ${formatIso(sections.analyzedAt)}`);
  push();

  push("# Decision summary");
  push(
    `Recommendation: ${
      sections.companyKnowledgeOnly
        ? NOT_AVAILABLE
        : sections.decision
          ? sections.decision.replace("_", "-")
          : sections.fitBreakdown?.scoringAvailable === false
            ? "ANALYSIS INCOMPLETE"
            : NOT_AVAILABLE
    }`,
  );
  push(`Company–Tender Fit: ${sections.fitScoreDisplay}`);
  push(`Confidence: ${sections.confidenceDisplay}`);
  push();

  if (sections.bidScore && sections.bidScoreDisplay) {
    const bs = sections.bidScore;
    push("# Bid Score (priority — not win probability)");
    push(`Bid Score: ${sections.bidScoreDisplay}`);
    push(bs.interpretation);
    push(`Expected Value: ${bs.expectedValue}`);
    push(`Risk: ${bs.riskLevel} · Effort: ${bs.effort}`);
    push(bs.contractValueLabel);
    push(bs.pursuitCostLabel);
    push(bs.winProbabilityLabel);
    const pos = bs.drivers.filter((d) => d.direction === "positive");
    const neg = bs.drivers.filter((d) => d.direction === "negative");
    if (pos.length) {
      push("Positive:");
      for (const d of pos) push(`• + ${d.label}`);
    }
    if (neg.length) {
      push("Negative:");
      for (const d of neg) push(`• − ${d.label}`);
    }
    push(bs.disclaimer);
    push();
  }

  if (sections.fitBreakdown?.dimensions?.length) {
    push("# Company–Tender Fit");
    for (const dim of sections.fitBreakdown.dimensions) {
      const score =
        dim.status === "unknown" || dim.score == null
          ? NOT_AVAILABLE
          : `${dim.score}%`;
      push(`${dim.label}: ${score}`);
    }
    const overall =
      sections.fitBreakdown.scoringAvailable === false ||
      sections.fitBreakdown.overall == null
        ? NOT_AVAILABLE
        : `${sections.fitBreakdown.overall}%`;
    push(`Overall: ${overall}`);
    if (sections.fitBreakdown.recommendation) {
      push(sections.fitBreakdown.recommendation);
    }
    push();
  }

  if (sections.readiness && sections.readinessCounts) {
    push("# Tender Readiness");
    push(
      `Score: ${sections.readinessScoreDisplay ?? NOT_AVAILABLE} (${sections.readinessTotal ?? 0} requirements · ${sections.readinessCounts.ready} ready · ${sections.readinessCounts.verify} verify · ${sections.readinessCounts.missing} missing)`,
    );
    for (const a of sections.readiness.attention) {
      push(`• ${a}`);
    }
    push(`Next step: ${sections.readiness.recommendation}`);
    push();
  }

  if (sections.complianceSummary) {
    const s = sections.complianceSummary;
    push("# Compliance Matrix");
    push(
      `${s.totalRequirements} requirements · ${s.ready} ready · ${s.missing} missing · ${s.verify} verify · ${s.notApplicable} N/A`,
    );
    if (sections.complianceMatrix.length === 0) {
      push("None");
    } else {
      for (const row of sections.complianceMatrix) {
        const loc = row.sourceLocated
          ? [
              row.sourceDocument,
              row.section,
              row.pageNumber != null ? `page ${row.pageNumber}` : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : "Source could not be precisely located";
        const evidence = row.evidence
          ? `Evidence: "${truncate(row.evidence, 180)}"`
          : "No supporting excerpt available";
        push(
          `• [${row.status}] ${row.mandatory ? "Mandatory" : "Optional"} — ${row.requirement} | ${evidence} | ${loc}`,
        );
      }
    }
    push();
  }

  push("# Decision reasoning");
  push(sections.reasoning);
  push();

  push("# Missing requirements");
  if (sections.missingRequirements.length === 0) {
    push("None");
  } else {
    for (const r of sections.missingRequirements) {
      push(
        `• ${r.requirement}${r.mandatory ? " (mandatory)" : ""}${
          r.requiredAction ? ` — ${r.requiredAction}` : ""
        }`,
      );
    }
  }
  push();

  push("# Verification items");
  if (sections.verifyRequirements.length === 0) {
    push("None");
  } else {
    for (const r of sections.verifyRequirements) {
      push(
        `• ${r.requirement}${r.requiredAction ? ` — ${r.requiredAction}` : ""}`,
      );
    }
  }
  push();

  push("# Risks");
  if (sections.risks.length === 0) {
    push("None");
  } else {
    for (const r of sections.risks) {
      if ("explanation" in r) {
        push(`• ${r.severity}: ${r.title} — ${r.explanation}`);
      } else {
        push(`• [${r.severity}] ${r.category}: ${r.description}`);
      }
    }
  }
  push();

  push("# Clarification questions");
  if (sections.clarifications.length === 0) {
    push("None");
  } else {
    for (const q of sections.clarifications) {
      push(`• ${q.question} (Reason: ${q.reason}; Source: ${q.source})`);
    }
  }
  push();

  push("# Evidence");
  if (sections.evidence.length === 0) {
    push("None");
  } else {
    for (const e of sections.evidence) {
      const loc = [e.sourceSection, e.sourcePage != null ? `page ${e.sourcePage}` : null]
        .filter(Boolean)
        .join(" · ");
      push(`• "${truncate(e.text, 280)}"${loc ? ` — ${loc}` : ""}`);
    }
  }
  push();

  push("# Missing documents");
  if (sections.missingDocuments.length === 0) {
    push("None");
  } else {
    for (const d of sections.missingDocuments) {
      push(`• ${d.documentName} — ${d.reason}`);
    }
  }
  push();

  push("# Relevant historical intelligence");
  if (sections.learningSignal?.detected) {
    push(sections.learningSignal.headline);
    push(
      "Additional signal only — not a guarantee. Current tender evidence always takes priority.",
    );
  } else {
    push("No verified historical pattern applies to this opportunity yet.");
  }
  push();

  if (sections.decisionOutcome?.outcome) {
    const o = sections.decisionOutcome;
    push("# Decision outcome");
    push(`Bidvera decision: ${o.bidveraDecisionLabel}`);
    if (o.humanFinalDecisionLabel) {
      push(`Human final decision: ${o.humanFinalDecisionLabel}`);
    }
    push(`Actual outcome: ${o.outcomeLabel}`);
    if (o.outcomeDate) push(`Outcome date: ${o.outcomeDate.slice(0, 10)}`);
    if (o.reasonDetail || o.reasonCode) {
      push(`Outcome reason: ${o.reasonDetail ?? o.reasonCode}`);
    }
    if (o.decisionSuccess) {
      push(
        `Recommendation vs outcome: ${o.recommendationEvaluation ?? o.decisionSuccess}`,
      );
    }
    if (o.attachmentFileName) {
      push(`Supporting document: ${o.attachmentFileName}`);
    }
    push(o.userEvidenceDisclaimer);
    push(o.disclaimer);
    push();
  }

  if (sections.outcomeLearningInsights?.similarOutcomes?.length ||
    sections.outcomeLearningInsights?.statistics?.summary) {
    push("# Outcome-based historical intelligence");
    const ol = sections.outcomeLearningInsights;
    if (ol.statistics?.summary) {
      push(ol.statistics.summary);
      push(
        `Sample: ${ol.statistics.comparableCount} comparable · ${ol.statistics.won} won · ${ol.statistics.lost} lost`,
      );
    } else if (ol.winRateSummary) {
      push(ol.winRateSummary);
    }
    for (const p of ol.similarOutcomes) {
      push(`• ${p.title} — ${p.decisionLabel} → ${p.outcomeLabel}`);
    }
    push(ol.disclaimer);
    push();
  }

  push("# Recommended next actions");
  if (sections.nextActions.length === 0) {
    push("None");
  } else {
    sections.nextActions.forEach((a, i) => {
      push(
        `• ${i + 1}. ${a.title}${a.description ? ` — ${a.description}` : ""}`,
      );
    });
  }

  return lines.join("\n");
}

function formatIso(iso: string | null) {
  if (!iso) return NOT_AVAILABLE;
  const parsed = parseCanonicalDeadlineIso(iso);
  if (!parsed) return iso;
  if (parsed.dateOnly || parsed.hour == null || parsed.minute == null) {
    return parsed.dateYmd;
  }
  const hhmm = `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
  return `${parsed.dateYmd} ${hhmm}`;
}

function truncate(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}
