/**
 * Evidence-based risk classification — uncertainty alone never becomes HIGH/CRITICAL.
 */

import type { ReadinessStatus } from "@/domain/decision/tender-readiness";
import type { RequirementFitStatus } from "@/domain/decision/requirement-fit-status";
import { mapFitStatusToEvidenceState } from "@/domain/decision/requirement-fit-status";
import type { DeterministicFinding } from "@/domain/decision/types";
import type { RequirementVerificationStatus } from "@/domain/evidence-verification";
import type { ComplianceEvidenceState, RiskSeverity } from "@/domain/risk/types";
import {
  calibrateConfirmedGapSeverity,
  calibrateVerificationSeverity,
  deriveRiskCategory,
} from "@/domain/risk/assess";
import {
  CONFIRMED_NON_COMPLIANCE_FINDING_CODES,
  VERIFICATION_ONLY_FINDING_CODES,
  hasExplicitNonComplianceEvidence,
  isObjectivelyExpiredEvidence,
} from "@/domain/risk/evidence-signals";

export {
  CONFIRMED_NON_COMPLIANCE_FINDING_CODES,
  VERIFICATION_ONLY_FINDING_CODES,
  hasExplicitNonComplianceEvidence,
  isObjectivelyExpiredEvidence,
};

export function classifyComplianceEvidenceState(input: {
  readinessStatus: ReadinessStatus;
  matchStatus: import("@prisma/client").RequirementMatchStatus;
  verificationStatus: RequirementVerificationStatus;
  mandatory: boolean;
  evidence: string | null;
  findings: DeterministicFinding[];
  requirementIndex: number;
  humanRejected?: boolean;
  evidenceExcerpt?: string | null;
  /** Canonical Fit — authoritative when present. */
  fitStatus?: RequirementFitStatus | null;
  evidenceConflict?: boolean;
  humanVerified?: boolean;
}): ComplianceEvidenceState {
  // Fit layer is the root authority when available
  if (input.fitStatus) {
    if (input.fitStatus === "CONFIRMED_FIT") {
      return mapFitStatusToEvidenceState(input.fitStatus, {
        humanVerified: input.humanVerified,
        evidenceConflict: input.evidenceConflict,
      });
    }
    if (input.fitStatus === "CONFIRMED_GAP") {
      return "CONFIRMED_NON_COMPLIANT";
    }
    if (input.fitStatus === "NOT_APPLICABLE") return "NOT_APPLICABLE";
    if (input.evidenceConflict) return "NEEDS_VERIFICATION";
    return "NEEDS_VERIFICATION";
  }

  if (input.readinessStatus === "NOT_APPLICABLE") return "NOT_APPLICABLE";

  if (
    input.verificationStatus === "VERIFIED" &&
    input.readinessStatus === "READY" &&
    !input.humanRejected
  ) {
    return "CONFIRMED_COMPLIANT";
  }

  if (
    input.humanRejected ||
    hasExplicitNonComplianceEvidence({
      matchStatus: input.matchStatus,
      evidence: input.evidence,
      findings: input.findings,
      requirementIndex: input.requirementIndex,
    }) ||
    (input.mandatory &&
      isObjectivelyExpiredEvidence(input.evidenceExcerpt ?? input.evidence) &&
      /\b(certificat\w*|attestation|clearance|licen[cs]e)\b/i.test(
        `${input.evidenceExcerpt ?? ""} ${input.evidence ?? ""}`,
      ))
  ) {
    return "CONFIRMED_NON_COMPLIANT";
  }

  if (input.readinessStatus === "UNKNOWN") return "UNKNOWN";

  if (
    input.readinessStatus === "VERIFY" ||
    input.readinessStatus === "MISSING" ||
    input.verificationStatus === "NEEDS_VERIFICATION" ||
    input.verificationStatus === "MISSING_EVIDENCE"
  ) {
    return "NEEDS_VERIFICATION";
  }

  if (input.readinessStatus === "READY") {
    return "NEEDS_VERIFICATION";
  }

  return "UNKNOWN";
}

/**
 * Severity for evidence states.
 * Missing evidence alone must never become HIGH/CRITICAL.
 * Mandatory alone does not force CRITICAL.
 */
export function classifyRiskSeverity(input: {
  evidenceState: ComplianceEvidenceState;
  mandatory: boolean;
  finding: DeterministicFinding | null;
  requirementCriticality: "HIGH" | "MEDIUM" | "LOW";
  category?: string;
  description?: string;
  semanticKind?: string | null;
}): RiskSeverity | null {
  if (input.evidenceState === "NEEDS_VERIFICATION" || input.evidenceState === "UNKNOWN") {
    return calibrateVerificationSeverity({
      mandatory: input.mandatory,
      evidenceConflict: false,
      category: "EVIDENCE_VERIFICATION",
    });
  }

  if (input.evidenceState !== "CONFIRMED_NON_COMPLIANT") return null;

  const riskCategory = deriveRiskCategory({
    category: input.category ?? "",
    description: input.description ?? "",
    semanticKind: input.semanticKind,
  });

  return calibrateConfirmedGapSeverity({
    mandatory: input.mandatory,
    category: riskCategory,
    finding: input.finding,
    requirementCriticality: input.requirementCriticality,
  });
}

export function complianceNoteForState(
  evidenceState: ComplianceEvidenceState,
  mandatory: boolean,
): { risk: string | null; requiredAction: string | null } {
  switch (evidenceState) {
    case "CONFIRMED_COMPLIANT":
      return { risk: null, requiredAction: null };
    case "CONFIRMED_NON_COMPLIANT":
      return {
        risk: mandatory
          ? "Confirmed non-compliance — may affect eligibility or ability to satisfy this requirement."
          : "Confirmed gap against this requirement.",
        requiredAction: "Resolve or mitigate before final bid/no-bid decision.",
      };
    case "NEEDS_VERIFICATION":
      return {
        risk: null,
        requiredAction: mandatory
          ? "Verification required — confirm against company records and tender wording."
          : "Verification recommended before relying on this requirement.",
      };
    case "UNKNOWN":
      return {
        risk: null,
        requiredAction: "Insufficient information — gather tender or company evidence before deciding.",
      };
    case "NOT_APPLICABLE":
      return { risk: null, requiredAction: null };
    default:
      return { risk: null, requiredAction: null };
  }
}

export function findingToStructuredSeverity(finding: DeterministicFinding): RiskSeverity | null {
  if (VERIFICATION_ONLY_FINDING_CODES.has(finding.code)) return null;
  if (CONFIRMED_NON_COMPLIANCE_FINDING_CODES.has(finding.code)) {
    return finding.severity === "CRITICAL" ? "CRITICAL" : "HIGH";
  }
  if (finding.severity === "CRITICAL" && finding.forcesDecision === "NO_BID") {
    return "CRITICAL";
  }
  if (finding.severity === "HIGH" && finding.forcesDecision === "NO_BID") {
    return "HIGH";
  }
  return null;
}
