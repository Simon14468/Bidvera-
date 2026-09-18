/**
 * Build canonical structured risks — Fit → Evidence State → Risk Assessment.
 */

import type { RequirementFitStatus } from "@/domain/decision/requirement-fit-status";
import type { DeterministicFinding } from "@/domain/decision/types";
import type { ReadinessStatus } from "@/domain/decision/tender-readiness";
import type { RequirementVerificationStatus } from "@/domain/evidence-verification";
import {
  assessRequirementRisk,
  assertRiskConsistency,
  dedupeRiskAssessments,
  deriveRiskCategory,
  underlyingRiskKey,
} from "@/domain/risk/assess";
import {
  classifyComplianceEvidenceState,
  complianceNoteForState,
  findingToStructuredSeverity,
} from "@/domain/risk/classify";
import { sanitizeAiRiskSeverity } from "@/domain/risk/sanitize-ai-risk";
import type { CanonicalStructuredRisk, RiskSeverity } from "@/domain/risk/types";
import type { ComplianceRow, StructuredRisk } from "@/domain/tender-intelligence/types";
import type { RequirementMatchStatus } from "@prisma/client";

export type RiskRequirementInput = {
  id: string;
  category: string;
  description: string;
  mandatory: boolean;
  status: RequirementMatchStatus;
  evidence: string | null;
  fitStatus?: RequirementFitStatus | null;
  evidenceConflict?: boolean;
  semanticKind?: string | null;
  sourceDocument?: string | null;
  page?: number | "UNKNOWN" | null;
  section?: string | null;
  fitProvenanceExcerpt?: string | null;
};

export type RiskBuildInput = {
  matrix: ComplianceRow[];
  requirements: RiskRequirementInput[];
  findings: DeterministicFinding[];
  existingRisks: Array<{
    id: string;
    category: string;
    description: string;
    severity: string;
    sourcePage: number | null;
    mitigation: string | null;
  }>;
  documentName: string | null;
  asOf?: Date;
};

function toStructuredRisk(risk: CanonicalStructuredRisk): StructuredRisk {
  return {
    id: risk.id,
    title: risk.title,
    category: risk.category,
    severity: risk.severity === "CRITICAL" ? "HIGH" : risk.severity,
    explanation: risk.explanation,
    impact: risk.impact,
    recommendedAction: risk.recommendedAction,
    source: risk.source,
    requirementId: risk.requirementId,
    linkedRequirementIds: risk.linkedRequirementIds,
    evidenceState: risk.evidenceState,
    fitStatus: risk.fitStatus,
    verificationState: risk.verificationState,
    whyRisky: risk.whyRisky,
    severityCanonical: risk.severity,
    riskCategory: risk.riskCategory,
    underlyingKey: risk.underlyingKey,
  };
}

function findingForRequirement(
  findings: DeterministicFinding[],
  requirementIndex: number,
): DeterministicFinding | null {
  return findings.find((f) => f.requirementIndex === requirementIndex) ?? null;
}

function isCompanyProvenanceDoc(doc: string | null | undefined): boolean {
  if (!doc?.trim()) return false;
  return !/^tender\b/i.test(doc.trim());
}

export function enrichComplianceRowRiskFields(input: {
  row: Omit<ComplianceRow, "evidenceState" | "risk" | "requiredAction">;
  requirement: RiskRequirementInput;
  requirementIndex: number;
  readinessStatus: ReadinessStatus;
  verificationStatus: RequirementVerificationStatus;
  findings: DeterministicFinding[];
  humanRejected?: boolean;
  evidenceExcerpt?: string | null;
  notes?: string | null;
}): Pick<ComplianceRow, "evidenceState" | "risk" | "requiredAction"> {
  const evidenceState = classifyComplianceEvidenceState({
    readinessStatus: input.readinessStatus,
    matchStatus: input.requirement.status,
    verificationStatus: input.verificationStatus,
    mandatory: input.requirement.mandatory,
    evidence: input.requirement.evidence,
    findings: input.findings,
    requirementIndex: input.requirementIndex,
    humanRejected: input.humanRejected,
    evidenceExcerpt: input.evidenceExcerpt,
    fitStatus: input.requirement.fitStatus,
    evidenceConflict: input.requirement.evidenceConflict,
  });

  const stateNotes = complianceNoteForState(evidenceState, input.requirement.mandatory);
  return {
    evidenceState,
    risk: stateNotes.risk,
    requiredAction: stateNotes.requiredAction ?? input.notes ?? null,
  };
}

/**
 * Canonical Risk Assessment Engine entry point.
 * Consumes Fit Status — never invents risks from tender text alone.
 */
export function buildCanonicalStructuredRisks(input: RiskBuildInput): StructuredRisk[] {
  const draft: Array<
    CanonicalStructuredRisk & {
      underlyingKey: string;
      severity: RiskSeverity | null;
    }
  > = [];
  let idx = 0;

  const coveredRequirementIds = new Set<string>();

  for (let i = 0; i < input.matrix.length; i++) {
    const row = input.matrix[i]!;
    const req = input.requirements.find((r) => r.id === row.requirementId);
    if (!req) continue;

    const linkedFinding = findingForRequirement(input.findings, i);
    const companyDoc =
      (isCompanyProvenanceDoc(req.sourceDocument) ? req.sourceDocument : null) ??
      (row.companyEvidence?.documentName ?? null);
    const companyExcerpt =
      req.fitProvenanceExcerpt ??
      row.companyEvidence?.excerpt ??
      (isCompanyProvenanceDoc(req.sourceDocument) ? req.evidence : null);

    const assessment = assessRequirementRisk({
      requirementId: req.id,
      description: req.description,
      category: req.category,
      semanticKind: req.semanticKind ?? null,
      mandatory: req.mandatory,
      fitStatus: req.fitStatus ?? null,
      evidenceConflict: req.evidenceConflict ?? false,
      matchStatus: req.status,
      evidence: req.evidence,
      companySourceDocument: companyDoc,
      companyEvidenceExcerpt: companyExcerpt,
      verificationStatus: row.verificationStatus ?? "NEEDS_VERIFICATION",
      finding: linkedFinding
        ? { ...linkedFinding, requirementIndex: 0 }
        : null,
      requirementCriticality: row.priority,
      humanRejected: false,
      humanVerified: row.verificationStatus === "VERIFIED",
    });

    // Keep matrix evidenceState aligned with Fit-driven assessment
    if (!row.evidenceState) {
      row.evidenceState = assessment.evidenceState;
    }
    if (assessment.evidenceState === "CONFIRMED_NON_COMPLIANT" && !row.risk) {
      row.risk = assessment.explanation;
    }

    if (!assessment.include || !assessment.severity) continue;

    coveredRequirementIds.add(req.id);

    const pageNum =
      typeof req.page === "number"
        ? req.page
        : row.pageNumber;

    draft.push({
      id: `risk-${++idx}`,
      requirementId: row.requirementId,
      linkedRequirementIds: [row.requirementId],
      title: row.requirement.slice(0, 120),
      category: assessment.categoryLabel,
      riskCategory: assessment.category,
      severity: assessment.severity,
      evidenceState: assessment.evidenceState,
      fitStatus: assessment.fitStatus,
      verificationState: assessment.verificationState,
      explanation: assessment.explanation,
      whyRisky: assessment.whyRisky,
      impact: assessment.impact,
      recommendedAction: assessment.recommendedAction,
      underlyingKey: assessment.underlyingKey,
      source: {
        document: companyDoc ?? row.sourceDocument,
        page: pageNum,
        section: req.section ?? row.section,
        excerpt: companyExcerpt ?? row.evidence,
        basis: companyDoc ? "COMPANY_INFORMATION" : row.sourceBasis,
        located: Boolean(companyDoc || row.sourceLocated),
      },
    });
  }

  // Findings not already covered — only confirmed non-compliance findings
  for (const f of input.findings) {
    const severity = findingToStructuredSeverity(f);
    if (!severity) continue;
    const req =
      f.requirementIndex != null ? input.requirements[f.requirementIndex] : null;
    if (req && coveredRequirementIds.has(req.id)) continue;
    if (req?.fitStatus === "CONFIRMED_FIT") continue;
    if (req?.fitStatus === "NEEDS_VERIFICATION" || req?.fitStatus === "NOT_APPLICABLE") {
      continue;
    }

    const assessment = req
      ? assessRequirementRisk({
          requirementId: req.id,
          description: req.description,
          category: req.category,
          semanticKind: req.semanticKind ?? null,
          mandatory: req.mandatory,
          fitStatus: req.fitStatus ?? "CONFIRMED_GAP",
          evidenceConflict: req.evidenceConflict ?? false,
          matchStatus: req.status,
          evidence: req.evidence,
          companySourceDocument: req.sourceDocument,
          companyEvidenceExcerpt: req.fitProvenanceExcerpt ?? req.evidence,
          verificationStatus: "NEEDS_VERIFICATION",
          finding: { ...f, requirementIndex: 0 },
          requirementCriticality: "HIGH",
        })
      : null;

    if (assessment && !assessment.include) continue;

    draft.push({
      id: `risk-f-${++idx}`,
      requirementId: req?.id ?? null,
      linkedRequirementIds: req?.id ? [req.id] : [],
      title: req?.description.slice(0, 120) ?? f.category,
      category: assessment?.categoryLabel ?? `${f.category} risk`,
      riskCategory: assessment?.category,
      severity: assessment?.severity ?? severity,
      evidenceState: assessment?.evidenceState ?? "CONFIRMED_NON_COMPLIANT",
      fitStatus: assessment?.fitStatus ?? (req?.fitStatus ?? null),
      verificationState: "NEEDS_VERIFICATION",
      explanation: assessment?.explanation ?? f.description,
      whyRisky: assessment?.whyRisky ?? `${f.code}: ${f.description}`,
      impact:
        assessment?.impact ??
        "Confirmed rule-based blocker identified from company profile and tender requirements.",
      recommendedAction:
        assessment?.recommendedAction ??
        "Review with bid team — confirmed gap requires resolution or explicit waiver.",
      underlyingKey:
        assessment?.underlyingKey ?? `finding:${f.code}:${f.category}`,
      source: {
        document: req?.sourceDocument ?? input.documentName,
        page: typeof req?.page === "number" ? req.page : null,
        section: req?.section ?? null,
        excerpt: req?.evidence ?? null,
        basis: "COMPANY_INFORMATION",
        located: Boolean(req?.sourceDocument),
      },
    });
  }

  // Legacy/AI/persisted risks — sanitize; never invent CONFIRMED_NON_COMPLIANT without Fit gap.
  // Title must describe the underlying issue (never bare category like "certification"),
  // and underlyingKey must match assessment identity so cross-source duplicates collapse.
  for (const r of input.existingRisks) {
    const sanitized = sanitizeAiRiskSeverity(r.severity, r.description);
    if (sanitized !== "CRITICAL" && sanitized !== "HIGH") continue;

    // If every requirement is CONFIRMED_FIT / NOT_APPLICABLE, do not promote AI risk
    const allFitOk =
      input.requirements.length > 0 &&
      input.requirements.every(
        (req) =>
          req.fitStatus === "CONFIRMED_FIT" ||
          req.fitStatus === "NOT_APPLICABLE" ||
          req.fitStatus == null,
      );
    const hasConfirmedGap = input.requirements.some((req) => req.fitStatus === "CONFIRMED_GAP");
    if (allFitOk && !hasConfirmedGap && input.requirements.some((req) => req.fitStatus === "CONFIRMED_FIT")) {
      continue;
    }

    // Downgrade invent-y AI risks that lack a linked confirmed gap to verification MEDIUM
    const severity: RiskSeverity = hasConfirmedGap ? sanitized : "MEDIUM";
    const evidenceState = hasConfirmedGap
      ? ("CONFIRMED_NON_COMPLIANT" as const)
      : ("NEEDS_VERIFICATION" as const);

    const riskCategory = deriveRiskCategory({
      category: r.category,
      description: r.description,
    });
    const issueTitle = (r.description?.trim() || r.category).slice(0, 120);
    const underlyingKey = underlyingRiskKey({
      category: riskCategory,
      description: r.description || r.category,
    });

    draft.push({
      id: r.id,
      requirementId: null,
      linkedRequirementIds: [],
      title: issueTitle,
      category: r.category,
      riskCategory,
      severity,
      evidenceState,
      fitStatus: hasConfirmedGap ? "CONFIRMED_GAP" : "NEEDS_VERIFICATION",
      verificationState: "NEEDS_VERIFICATION",
      explanation: r.description,
      whyRisky: r.description ?? r.category ?? "Recorded tender risk",
      impact: hasConfirmedGap
        ? "Recorded tender risk aligned with a confirmed company gap."
        : "Recorded analysis note — treated as verification until confirmed against Fit.",
      recommendedAction: r.mitigation ?? "Review before final bid/no-bid decision.",
      underlyingKey,
      source: {
        document: input.documentName,
        page: r.sourcePage,
        section: null,
        excerpt: null,
        basis: r.sourcePage ? "DIRECT_SOURCE" : "AI_INTERPRETATION",
        located: r.sourcePage != null,
      },
    });
  }

  const included = draft.filter((r) => r.severity != null) as Array<
    CanonicalStructuredRisk & { underlyingKey: string; severity: RiskSeverity }
  >;

  const deduped = dedupeRiskAssessments(
    included.map((r) => ({
      ...r,
      underlyingKey: r.underlyingKey ?? r.id,
      severity: r.severity,
      requirementId: r.requirementId,
      title: r.title,
    })),
  );

  const risks: CanonicalStructuredRisk[] = deduped.map((r, i) => ({
    ...r,
    id: r.id || `risk-${i + 1}`,
    linkedRequirementIds: r.linkedRequirementIds,
    severity: r.severity!,
  }));

  assertRiskConsistency(
    risks.map((r) => ({
      title: r.title,
      severity: r.severity,
      evidenceState: r.evidenceState,
      fitStatus: r.fitStatus,
      requirementId: r.requirementId,
      linkedRequirementIds: r.linkedRequirementIds,
      whyRisky: r.whyRisky,
      explanation: r.explanation,
      sourceDocument: r.source.document,
      underlyingKey: r.underlyingKey,
    })),
  );

  return risks.map(toStructuredRisk);
}

/** Count material identified risks (HIGH/CRITICAL confirmed only). */
export function countIdentifiedRisks(risks: StructuredRisk[]): number {
  return risks.filter(
    (r) =>
      (r.severity === "HIGH" ||
        r.severityCanonical === "CRITICAL" ||
        r.severityCanonical === "HIGH") &&
      r.evidenceState === "CONFIRMED_NON_COMPLIANT",
  ).length;
}

/** Confirmed HIGH/CRITICAL risks for Decision blockers — excludes verification-only. */
export function isConfirmedHighRisk(r: StructuredRisk): boolean {
  if (r.evidenceState && r.evidenceState !== "CONFIRMED_NON_COMPLIANT") return false;
  return (
    r.severity === "HIGH" ||
    r.severityCanonical === "HIGH" ||
    r.severityCanonical === "CRITICAL"
  );
}
