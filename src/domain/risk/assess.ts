/**
 * Canonical Tender Risk Assessment — Fit → Evidence State → Risk.
 * A tender requirement is never automatically a risk.
 */

import type { RequirementFitStatus } from "@/domain/decision/requirement-fit-status";
import { mapFitStatusToEvidenceState } from "@/domain/decision/requirement-fit-status";
import type { DeterministicFinding } from "@/domain/decision/types";
import type { RequirementVerificationStatus } from "@/domain/evidence-verification";
import {
  CONFIRMED_NON_COMPLIANCE_FINDING_CODES,
  VERIFICATION_ONLY_FINDING_CODES,
  hasExplicitNonComplianceEvidence,
} from "@/domain/risk/evidence-signals";
import type {
  ComplianceEvidenceState,
  RiskCategory,
  RiskSeverity,
} from "@/domain/risk/types";
import type { RequirementMatchStatus } from "@prisma/client";

export type RiskAssessmentInput = {
  requirementId: string;
  description: string;
  category: string;
  semanticKind?: string | null;
  mandatory: boolean;
  obligationStrength?: "MANDATORY" | "CONDITIONAL" | "OPTIONAL" | "INFORMATIONAL" | null;
  fitStatus: RequirementFitStatus | null;
  evidenceConflict?: boolean;
  matchStatus: RequirementMatchStatus;
  evidence: string | null;
  /** Company evidence provenance excerpt / source — never tender citation alone. */
  companySourceDocument?: string | null;
  companyEvidenceExcerpt?: string | null;
  verificationStatus: RequirementVerificationStatus;
  finding: DeterministicFinding | null;
  requirementCriticality: "HIGH" | "MEDIUM" | "LOW";
  humanVerified?: boolean;
  humanRejected?: boolean;
  /** When true, conditional applicability could not be established. */
  applicabilityUnknown?: boolean;
};

export type RequirementRiskAssessment = {
  /** Emit a structured risk record. */
  include: boolean;
  severity: RiskSeverity | null;
  category: RiskCategory;
  categoryLabel: string;
  evidenceState: ComplianceEvidenceState;
  fitStatus: RequirementFitStatus | null;
  verificationState: RequirementVerificationStatus;
  explanation: string;
  whyRisky: string;
  impact: string;
  recommendedAction: string;
  /** Groups semantically identical underlying business risks. */
  underlyingKey: string;
  material: boolean;
};

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function isInformationalOrOptional(input: RiskAssessmentInput): boolean {
  if (input.obligationStrength === "INFORMATIONAL") return true;
  if (input.obligationStrength === "OPTIONAL") return true;
  if (/^INFORMATIONAL$/i.test(input.category)) return true;
  if (
    input.semanticKind === "INFORMATIONAL_FACT" ||
    input.semanticKind === "EVALUATION_CRITERION" ||
    input.semanticKind === "CLARIFICATION_PROCEDURAL"
  ) {
    return true;
  }
  return !input.mandatory && /preferred|optional|evaluation/i.test(input.category);
}

function isDeadlineOrProcedural(input: RiskAssessmentInput): boolean {
  return (
    input.semanticKind === "DEADLINE" ||
    input.semanticKind === "CLARIFICATION_PROCEDURAL" ||
    /\b(deadline|submission|procedural)\b/i.test(`${input.category} ${input.description}`)
  );
}

/** Map requirement semantics → risk category. */
export function deriveRiskCategory(input: {
  category: string;
  description: string;
  semanticKind?: string | null;
  evidenceConflict?: boolean;
  fitStatus?: RequirementFitStatus | null;
}): RiskCategory {
  if (input.evidenceConflict) return "EVIDENCE_VERIFICATION";
  if (input.fitStatus === "NEEDS_VERIFICATION" && !input.semanticKind) {
    // fall through to semantic
  }

  const kind = input.semanticKind ?? "";
  const blob = `${input.category} ${input.description}`.toLowerCase();

  if (kind === "DEADLINE" || kind === "CLARIFICATION_PROCEDURAL" || /\bdeadline|submission process\b/.test(blob)) {
    return "DEADLINE_PROCEDURAL";
  }
  if (
    kind === "ELIGIBILITY_REQUIREMENT" ||
    kind === "GUARANTEE_SECURITY_REQUIREMENT" ||
    /\b(eligib|qualif|certificat|iso\s?\d+|experience|turnover|domicile)\b/.test(blob)
  ) {
    if (/\b(turnover|revenue|financial|bond|guarantee|caution)\b/.test(blob)) {
      return kind === "GUARANTEE_SECURITY_REQUIREMENT" || /\b(bond|guarantee|caution)\b/.test(blob)
        ? "FINANCIAL_COMMERCIAL"
        : "FINANCIAL_COMMERCIAL";
    }
    if (/\b(certificat|iso\s?\d+|cyber essentials|chas)\b/.test(blob)) {
      return "COMPLIANCE";
    }
    return "ELIGIBILITY";
  }
  if (kind === "FINANCIAL_COMMERCIAL_CONDITION" || /\b(turnover|revenue|payment|price|financial)\b/.test(blob)) {
    return "FINANCIAL_COMMERCIAL";
  }
  if (kind === "CONTRACTUAL_OBLIGATION" || /\b(contractual|penalt|liabilit|insurance|warranty)\b/.test(blob)) {
    return "CONTRACTUAL";
  }
  if (
    kind === "TECHNICAL_REQUIREMENT" ||
    kind === "PERFORMANCE_OBLIGATION" ||
    /\b(technical|spec|deliver|capability|24\s*\/\s*7)\b/.test(blob)
  ) {
    return "TECHNICAL_DELIVERY";
  }
  if (kind === "REQUIRED_DOCUMENT" || kind === "ADMINISTRATIVE_REQUIREMENT") {
    return "COMPLIANCE";
  }
  if (input.fitStatus === "NEEDS_VERIFICATION") return "EVIDENCE_VERIFICATION";
  return "COMPLIANCE";
}

export function riskCategoryLabel(category: RiskCategory): string {
  switch (category) {
    case "ELIGIBILITY":
      return "Eligibility risk";
    case "TECHNICAL_DELIVERY":
      return "Technical delivery risk";
    case "FINANCIAL_COMMERCIAL":
      return "Financial/commercial risk";
    case "CONTRACTUAL":
      return "Contractual risk";
    case "DEADLINE_PROCEDURAL":
      return "Deadline/procedural risk";
    case "EVIDENCE_VERIFICATION":
      return "Evidence/verification risk";
    case "COMPLIANCE":
    default:
      return "Compliance risk";
  }
}

function hasCompanyProvenance(input: RiskAssessmentInput): boolean {
  const doc = input.companySourceDocument?.trim();
  const excerpt = input.companyEvidenceExcerpt?.trim() ?? input.evidence?.trim();
  if (!doc || !excerpt) return false;
  if (/^tender\b/i.test(doc)) return false;
  return true;
}

function materialConsequence(category: RiskCategory, finding: DeterministicFinding | null): boolean {
  if (finding?.forcesDecision === "NO_BID") return true;
  if (finding && CONFIRMED_NON_COMPLIANCE_FINDING_CODES.has(finding.code)) return true;
  return (
    category === "ELIGIBILITY" ||
    category === "FINANCIAL_COMMERCIAL" ||
    category === "COMPLIANCE"
  );
}

/**
 * Severity for confirmed gaps — mandatory alone never forces CRITICAL.
 * HIGH/CRITICAL only when the gap materially blocks compliance/eligibility.
 */
export function calibrateConfirmedGapSeverity(input: {
  mandatory: boolean;
  category: RiskCategory;
  finding: DeterministicFinding | null;
  requirementCriticality: "HIGH" | "MEDIUM" | "LOW";
}): RiskSeverity {
  const finding = input.finding;
  if (finding?.severity === "CRITICAL" || finding?.forcesDecision === "NO_BID") {
    return "CRITICAL";
  }
  if (materialConsequence(input.category, finding) && input.mandatory) {
    return finding?.severity === "HIGH" || input.requirementCriticality === "HIGH"
      ? "HIGH"
      : "HIGH";
  }
  if (input.category === "TECHNICAL_DELIVERY" && input.mandatory) {
    return "HIGH";
  }
  if (input.category === "CONTRACTUAL" && input.mandatory) {
    return "MEDIUM";
  }
  if (!input.mandatory) {
    return input.requirementCriticality === "HIGH" ? "MEDIUM" : "LOW";
  }
  return "MEDIUM";
}

/**
 * Verification / conflict risks — never HIGH/CRITICAL for missing evidence alone.
 */
export function calibrateVerificationSeverity(input: {
  mandatory: boolean;
  evidenceConflict: boolean;
  category: RiskCategory;
}): RiskSeverity {
  if (input.evidenceConflict && input.mandatory && materialConsequence(input.category, null)) {
    return "MEDIUM";
  }
  if (input.evidenceConflict) return "MEDIUM";
  if (input.mandatory) return "MEDIUM";
  return "LOW";
}

export function underlyingRiskKey(input: {
  category: RiskCategory;
  description: string;
  findingCode?: string | null;
  evidenceConflict?: boolean;
}): string {
  if (input.evidenceConflict) {
    return `conflict:${input.category}:${normalizeKey(input.description)}`;
  }
  const cert = input.description.match(
    /\b(ISO\s?\d+|Cyber Essentials(?:\sPlus)?|CHAS|SafeContractor)\b/i,
  );
  if (cert) return `cert:${normalizeKey(cert[1]!)}`;
  const years = input.description.match(/(\d+)\s*\+?\s*years?/i);
  if (years && /\bexperience\b/i.test(input.description)) {
    return `experience:${years[1]}:${input.category}`;
  }
  if (input.findingCode && CONFIRMED_NON_COMPLIANCE_FINDING_CODES.has(input.findingCode)) {
    // Same finding code + category = same underlying business risk
    return `finding:${input.findingCode}:${input.category}`;
  }
  if (input.findingCode) {
    return `finding:${input.findingCode}:${normalizeKey(input.description).slice(0, 40)}`;
  }
  return `${input.category}:${normalizeKey(input.description)}`;
}

/**
 * Assess one requirement into a canonical risk decision.
 * CONFIRMED_FIT → no negative risk.
 * Missing evidence → verification risk only (never confirmed non-compliance).
 */
export function assessRequirementRisk(input: RiskAssessmentInput): RequirementRiskAssessment {
  const category = deriveRiskCategory({
    category: input.category,
    description: input.description,
    semanticKind: input.semanticKind,
    evidenceConflict: input.evidenceConflict,
    fitStatus: input.fitStatus,
  });
  const categoryLabel = riskCategoryLabel(category);
  const verificationState = input.verificationStatus;

  if (
    input.fitStatus === "NOT_APPLICABLE" ||
    (isInformationalOrOptional(input) && input.fitStatus !== "CONFIRMED_GAP")
  ) {
    return {
      include: false,
      severity: null,
      category,
      categoryLabel,
      evidenceState: "NOT_APPLICABLE",
      fitStatus: input.fitStatus ?? "NOT_APPLICABLE",
      verificationState,
      explanation: "Informational or non-material requirement — not assessed as a compliance risk.",
      whyRisky: "",
      impact: "",
      recommendedAction: "",
      underlyingKey: underlyingRiskKey({ category, description: input.description }),
      material: false,
    };
  }

  if (input.applicabilityUnknown || input.obligationStrength === "CONDITIONAL") {
    if (input.applicabilityUnknown) {
      return {
        include: true,
        severity: "LOW",
        category: "EVIDENCE_VERIFICATION",
        categoryLabel: riskCategoryLabel("EVIDENCE_VERIFICATION"),
        evidenceState: "NEEDS_VERIFICATION",
        fitStatus: input.fitStatus ?? "NEEDS_VERIFICATION",
        verificationState,
        explanation:
          "Conditional requirement — applicability could not be established from available evidence.",
        whyRisky:
          "Condition applicability is unknown; risk remains uncertain until the tender condition is confirmed.",
        impact: "May become material only if the condition applies.",
        recommendedAction: "Confirm whether the condition applies before treating as a compliance gap.",
        underlyingKey: underlyingRiskKey({
          category: "EVIDENCE_VERIFICATION",
          description: input.description,
        }),
        material: false,
      };
    }
  }

  // Prefer Fit as authority for evidence state
  let evidenceState: ComplianceEvidenceState;
  if (input.fitStatus) {
    evidenceState = mapFitStatusToEvidenceState(input.fitStatus, {
      humanVerified: input.humanVerified,
      evidenceConflict: input.evidenceConflict,
    });
    // Conflicts stay NEEDS_VERIFICATION for risk messaging (UNKNOWN is for sparse conflict state)
    if (input.evidenceConflict) {
      evidenceState = "NEEDS_VERIFICATION";
    }
  } else {
    evidenceState = "NEEDS_VERIFICATION";
    if (input.humanRejected) {
      evidenceState = "CONFIRMED_NON_COMPLIANT";
    } else if (
      hasExplicitNonComplianceEvidence({
        matchStatus: input.matchStatus,
        evidence: input.companyEvidenceExcerpt ?? input.evidence,
        findings: input.finding ? [input.finding] : [],
        requirementIndex: 0,
      })
    ) {
      evidenceState = "CONFIRMED_NON_COMPLIANT";
    }
  }

  // CONFIRMED_FIT → never create a negative compliance risk
  if (input.fitStatus === "CONFIRMED_FIT" || evidenceState === "CONFIRMED_COMPLIANT") {
    return {
      include: false,
      severity: null,
      category,
      categoryLabel,
      evidenceState: evidenceState === "CONFIRMED_COMPLIANT" ? evidenceState : "NEEDS_VERIFICATION",
      fitStatus: "CONFIRMED_FIT",
      verificationState,
      explanation: "Company fit confirmed — no negative compliance risk from this requirement.",
      whyRisky: "",
      impact: "",
      recommendedAction: "",
      underlyingKey: underlyingRiskKey({ category, description: input.description }),
      material: false,
    };
  }

  // Evidence conflict → verification/conflict risk (never silent, never auto CRITICAL)
  if (input.evidenceConflict) {
    const severity = calibrateVerificationSeverity({
      mandatory: input.mandatory,
      evidenceConflict: true,
      category,
    });
    return {
      include: true,
      severity,
      category: "EVIDENCE_VERIFICATION",
      categoryLabel: riskCategoryLabel("EVIDENCE_VERIFICATION"),
      evidenceState: "NEEDS_VERIFICATION",
      fitStatus: "NEEDS_VERIFICATION",
      verificationState,
      explanation:
        "Conflicting company evidence sources — cannot confirm fit or gap without manual review.",
      whyRisky:
        "Multiple company evidence sources disagree; treating as verification/conflict risk until resolved.",
      impact: input.mandatory
        ? "Unresolved conflict on a mandatory requirement may delay or invalidate a bid decision."
        : "Unresolved conflict may affect confidence in this requirement.",
      recommendedAction: "Reconcile conflicting evidence sources before final bid/no-bid decision.",
      underlyingKey: underlyingRiskKey({
        category: "EVIDENCE_VERIFICATION",
        description: input.description,
        evidenceConflict: true,
      }),
      material: input.mandatory,
    };
  }

  // CONFIRMED_GAP → risk only when material
  if (input.fitStatus === "CONFIRMED_GAP" || evidenceState === "CONFIRMED_NON_COMPLIANT") {
    // Never claim non-compliance without company provenance or definitive finding
    const findingOk =
      input.finding != null &&
      CONFIRMED_NON_COMPLIANCE_FINDING_CODES.has(input.finding.code);
    const provenanceOk = hasCompanyProvenance(input) || Boolean(input.companyEvidenceExcerpt?.trim());
    if (!findingOk && !provenanceOk && !input.humanRejected) {
      // Downgrade — cannot prove gap
      const severity = calibrateVerificationSeverity({
        mandatory: input.mandatory,
        evidenceConflict: false,
        category: "EVIDENCE_VERIFICATION",
      });
      return {
        include: true,
        severity,
        category: "EVIDENCE_VERIFICATION",
        categoryLabel: riskCategoryLabel("EVIDENCE_VERIFICATION"),
        evidenceState: "NEEDS_VERIFICATION",
        fitStatus: "NEEDS_VERIFICATION",
        verificationState,
        explanation: "Gap signal lacks definitive company provenance — verification required.",
        whyRisky: "Insufficient traceable company evidence to treat as confirmed non-compliance.",
        impact: "Uncertainty remains until company evidence is verified.",
        recommendedAction: "Attach company evidence with provenance before treating as a confirmed gap.",
        underlyingKey: underlyingRiskKey({
          category: "EVIDENCE_VERIFICATION",
          description: input.description,
        }),
        material: false,
      };
    }

    if (isInformationalOrOptional(input) && !input.mandatory) {
      return {
        include: true,
        severity: "LOW",
        category,
        categoryLabel,
        evidenceState: "CONFIRMED_NON_COMPLIANT",
        fitStatus: "CONFIRMED_GAP",
        verificationState,
        explanation: input.finding?.description ?? "Optional requirement not met by company evidence.",
        whyRisky: "Confirmed gap on a non-mandatory item — limited bid-blocking impact.",
        impact: "May affect scoring or preference but does not alone block eligibility.",
        recommendedAction: "Document mitigation or accept as a known gap.",
        underlyingKey: underlyingRiskKey({
          category,
          description: input.description,
          findingCode: input.finding?.code,
        }),
        material: false,
      };
    }

    if (isDeadlineOrProcedural(input) && category === "DEADLINE_PROCEDURAL") {
      return {
        include: true,
        severity: input.mandatory ? "HIGH" : "MEDIUM",
        category: "DEADLINE_PROCEDURAL",
        categoryLabel: riskCategoryLabel("DEADLINE_PROCEDURAL"),
        evidenceState: "CONFIRMED_NON_COMPLIANT",
        fitStatus: "CONFIRMED_GAP",
        verificationState,
        explanation: input.finding?.description ?? input.description,
        whyRisky: "Confirmed procedural/deadline gap that may affect submission validity.",
        impact: "Late or non-compliant submission process can invalidate the bid.",
        recommendedAction: "Resolve procedural gap before submission.",
        underlyingKey: underlyingRiskKey({
          category: "DEADLINE_PROCEDURAL",
          description: input.description,
          findingCode: input.finding?.code,
        }),
        material: true,
      };
    }

    const severity = calibrateConfirmedGapSeverity({
      mandatory: input.mandatory,
      category,
      finding: input.finding,
      requirementCriticality: input.requirementCriticality,
    });

    const whyParts: string[] = [];
    if (input.finding) {
      whyParts.push(`${input.finding.code}: ${input.finding.description}`);
    }
    if (input.companyEvidenceExcerpt ?? input.evidence) {
      whyParts.push(`Company evidence: ${(input.companyEvidenceExcerpt ?? input.evidence)!.slice(0, 160)}`);
    }

    return {
      include: true,
      severity,
      category,
      categoryLabel,
      evidenceState: "CONFIRMED_NON_COMPLIANT",
      fitStatus: "CONFIRMED_GAP",
      verificationState,
      explanation:
        input.finding?.description ??
        `Confirmed company gap against: ${input.description.slice(0, 120)}`,
      whyRisky: whyParts.join(" · ") || "Canonical Fit Status is CONFIRMED_GAP with supporting company evidence.",
      impact: input.mandatory
        ? "Material gap may block eligibility, compliance, or ability to deliver under the tender."
        : "Confirmed gap may reduce competitiveness or compliance confidence.",
      recommendedAction:
        "Resolve confirmed gap or document explicit mitigation/waiver before bidding.",
      underlyingKey: underlyingRiskKey({
        category,
        description: input.description,
        findingCode: input.finding?.code,
      }),
      material: input.mandatory || materialConsequence(category, input.finding),
    };
  }

  // NEEDS_VERIFICATION / UNKNOWN — verification risk only; never HIGH/CRITICAL from missing evidence
  if (
    evidenceState === "NEEDS_VERIFICATION" ||
    evidenceState === "UNKNOWN" ||
    input.fitStatus === "NEEDS_VERIFICATION" ||
    input.fitStatus == null
  ) {
    // Verification-only findings must not become confirmed risks
    if (input.finding && VERIFICATION_ONLY_FINDING_CODES.has(input.finding.code)) {
      // fall through to verification risk
    }

    const severity = calibrateVerificationSeverity({
      mandatory: input.mandatory,
      evidenceConflict: false,
      category: "EVIDENCE_VERIFICATION",
    });

    // Optional/informational: skip emitting clutter unless mandatory
    if (!input.mandatory && isInformationalOrOptional(input)) {
      return {
        include: false,
        severity: null,
        category: "EVIDENCE_VERIFICATION",
        categoryLabel: riskCategoryLabel("EVIDENCE_VERIFICATION"),
        evidenceState: "NEEDS_VERIFICATION",
        fitStatus: input.fitStatus ?? "NEEDS_VERIFICATION",
        verificationState,
        explanation: "Optional item pending verification — not a material compliance risk.",
        whyRisky: "",
        impact: "",
        recommendedAction: "Verification recommended if pursuing evaluation credit.",
        underlyingKey: underlyingRiskKey({
          category: "EVIDENCE_VERIFICATION",
          description: input.description,
        }),
        material: false,
      };
    }

    return {
      include: input.mandatory || category === "ELIGIBILITY" || category === "FINANCIAL_COMMERCIAL",
      severity,
      category: "EVIDENCE_VERIFICATION",
      categoryLabel: riskCategoryLabel("EVIDENCE_VERIFICATION"),
      evidenceState: "NEEDS_VERIFICATION",
      fitStatus: input.fitStatus ?? "NEEDS_VERIFICATION",
      verificationState,
      explanation:
        input.finding?.description ??
        "Insufficient company evidence to confirm fit or gap — verification required.",
      whyRisky:
        "Missing or incomplete company evidence is uncertainty, not confirmed non-compliance.",
      impact: input.mandatory
        ? "Unresolved verification on a mandatory requirement may delay a confident bid decision."
        : "Uncertainty may affect scoring confidence.",
      recommendedAction:
        "Verify against company records and tender wording before treating as a gap.",
      underlyingKey: underlyingRiskKey({
        category: "EVIDENCE_VERIFICATION",
        description: input.description,
        findingCode: input.finding?.code,
      }),
      material: false,
    };
  }

  return {
    include: false,
    severity: null,
    category,
    categoryLabel,
    evidenceState,
    fitStatus: input.fitStatus,
    verificationState,
    explanation: "No material risk assessed.",
    whyRisky: "",
    impact: "",
    recommendedAction: "",
    underlyingKey: underlyingRiskKey({ category, description: input.description }),
    material: false,
  };
}

/** Merge duplicate underlying risks — keep highest severity, link requirement ids. */
export function dedupeRiskAssessments<
  T extends {
    underlyingKey: string;
    severity: RiskSeverity | null;
    requirementId: string | null;
    title: string;
  },
>(
  items: T[],
): Array<T & { linkedRequirementIds: string[] }> {
  const rank: Record<RiskSeverity, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };
  const byKey = new Map<string, T & { linkedRequirementIds: string[] }>();

  for (const item of items) {
    const key = canonicalRiskIdentity({
      underlyingKey: item.underlyingKey,
      title: item.title,
      requirementId: item.requirementId,
    });
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...item,
        linkedRequirementIds: item.requirementId ? [item.requirementId] : [],
      });
      continue;
    }
    if (item.requirementId && !existing.linkedRequirementIds.includes(item.requirementId)) {
      existing.linkedRequirementIds.push(item.requirementId);
    }
    const a = item.severity ? rank[item.severity] : 0;
    const b = existing.severity ? rank[existing.severity] : 0;
    if (a > b) {
      byKey.set(key, {
        ...item,
        linkedRequirementIds: existing.linkedRequirementIds,
      });
    }
  }
  return [...byKey.values()];
}

/**
 * Canonical risk identity for dedupe + consistency.
 * Prefer underlyingKey (issue identity). Fall back to title + requirement context
 * so bare category titles never falsely collide distinct issues.
 */
export function canonicalRiskIdentity(input: {
  underlyingKey?: string | null;
  title: string;
  fitStatus?: string | null;
  evidenceState?: string | null;
  requirementId?: string | null;
  linkedRequirementIds?: string[] | null;
}): string {
  const key = input.underlyingKey?.trim();
  if (key) return key;

  const linked = [...(input.linkedRequirementIds ?? [])].filter(Boolean).sort();
  const reqCtx =
    input.requirementId?.trim() ||
    (linked.length > 0 ? linked.join(",") : "");
  return [
    input.fitStatus ?? "",
    input.evidenceState ?? "",
    normalizeKey(input.title),
    reqCtx,
  ].join(":");
}

/** Runtime invariants — rejects logically invalid risk states. */
export function assertRiskConsistency(
  risks: Array<{
    title: string;
    severity: RiskSeverity | string;
    evidenceState?: ComplianceEvidenceState | null;
    fitStatus?: RequirementFitStatus | null;
    requirementId?: string | null;
    linkedRequirementIds?: string[];
    whyRisky?: string | null;
    explanation?: string | null;
    sourceDocument?: string | null;
    underlyingKey?: string | null;
  }>,
): void {
  const seenKeys = new Set<string>();
  for (const r of risks) {
    const sev = String(r.severity).toUpperCase();
    if (!["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(sev)) {
      throw new Error(`Unsupported risk severity: ${r.severity}`);
    }

    if (r.fitStatus === "CONFIRMED_FIT" && r.evidenceState === "CONFIRMED_NON_COMPLIANT") {
      throw new Error(
        `CONFIRMED_FIT cannot produce confirmed compliance failure: "${r.title.slice(0, 60)}"`,
      );
    }

    if (
      r.evidenceState === "CONFIRMED_NON_COMPLIANT" &&
      r.fitStatus === "NEEDS_VERIFICATION"
    ) {
      throw new Error(
        `NEEDS_VERIFICATION cannot be CONFIRMED_NON_COMPLIANT: "${r.title.slice(0, 60)}"`,
      );
    }

    if (
      r.evidenceState === "NEEDS_VERIFICATION" &&
      (sev === "HIGH" || sev === "CRITICAL") &&
      !/conflict|contradict/i.test(`${r.whyRisky ?? ""} ${r.explanation ?? ""}`)
    ) {
      throw new Error(
        `NEEDS_VERIFICATION must not be ${sev} without material conflict justification: "${r.title.slice(0, 60)}"`,
      );
    }

    if (
      !r.requirementId &&
      !(r.linkedRequirementIds && r.linkedRequirementIds.length > 0) &&
      !r.sourceDocument
    ) {
      throw new Error(`Risk without canonical requirement or source: "${r.title.slice(0, 60)}"`);
    }

    if (r.fitStatus === "CONFIRMED_GAP" && /may be risky/i.test(r.explanation ?? "")) {
      throw new Error(`Generic risk explanation not allowed: "${r.title.slice(0, 60)}"`);
    }

    const dedupeKey = canonicalRiskIdentity({
      underlyingKey: r.underlyingKey,
      title: r.title,
      fitStatus: r.fitStatus,
      evidenceState: r.evidenceState,
      requirementId: r.requirementId,
      linkedRequirementIds: r.linkedRequirementIds,
    });
    if (seenKeys.has(dedupeKey)) {
      throw new Error(`Duplicate risk for same underlying issue: "${r.title.slice(0, 60)}"`);
    }
    seenKeys.add(dedupeKey);
  }
}
