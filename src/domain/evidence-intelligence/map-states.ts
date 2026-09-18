/**
 * Map canonical verification + evidence rows → Evidence Intelligence states.
 */

import type { ReadinessStatus } from "@/domain/decision/tender-readiness";
import type {
  CanonicalEvidenceRecord,
  RequirementVerificationStatus,
} from "@/domain/evidence-verification";
import { isRealEvidenceText } from "@/domain/evidence-verification";
import type { EvidenceIntelligenceState, EvidenceSourceKind } from "./types";
import type { EvidenceValidityState } from "./types";

export function mapEvidenceSourceKind(
  evidence: CanonicalEvidenceRecord | null,
): EvidenceSourceKind {
  if (!evidence) return "UNKNOWN";
  if (evidence.teamTaskId && evidence.verificationStatus === "VERIFIED") {
    return "TEAM_VERIFIED";
  }
  if (evidence.documentName) {
    return "COMPANY_DOCUMENT";
  }
  if (evidence.verificationStatus === "INFERRED") {
    return "COMPANY_PROFILE";
  }
  return "UNKNOWN";
}

export function mapProvenanceConfidence(
  evidence: CanonicalEvidenceRecord | null,
): "VERIFIED" | "INFERRED" | "UNKNOWN" {
  if (!evidence) return "UNKNOWN";
  if (evidence.teamTaskId && evidence.verificationStatus === "VERIFIED") {
    return "VERIFIED";
  }
  if (evidence.verificationStatus === "INFERRED") return "INFERRED";
  if (evidence.verificationStatus === "VERIFIED") return "VERIFIED";
  return "UNKNOWN";
}

export function mapEvidenceIntelligenceState(input: {
  requirementVerificationStatus: RequirementVerificationStatus;
  evidence: CanonicalEvidenceRecord | null;
  readinessStatus: ReadinessStatus;
  validityState: EvidenceValidityState;
}): EvidenceIntelligenceState {
  if (input.evidence?.verificationStatus === "REJECTED") {
    return "INVALID";
  }

  if (
    input.validityState === "EXPIRED" &&
    isRealEvidenceText(input.evidence?.evidenceText ?? null)
  ) {
    return "EXPIRED";
  }

  if (input.requirementVerificationStatus === "VERIFIED") {
    return "VERIFIED";
  }

  if (input.requirementVerificationStatus === "NOT_APPLICABLE") {
    return "UNKNOWN";
  }

  if (input.requirementVerificationStatus === "MISSING_EVIDENCE") {
    return "MISSING";
  }

  const hasExcerpt = isRealEvidenceText(input.evidence?.evidenceText ?? null);
  if (hasExcerpt && input.requirementVerificationStatus === "NEEDS_VERIFICATION") {
    return "FOUND_UNVERIFIED";
  }

  if (input.readinessStatus === "UNKNOWN") {
    return "UNKNOWN";
  }

  if (!hasExcerpt) {
    return "MISSING";
  }

  return "UNKNOWN";
}

export function readinessImpactLabel(status: ReadinessStatus): string {
  switch (status) {
    case "READY":
      return "Ready — pending verification where required";
    case "MISSING":
      return "Missing — may reduce readiness score";
    case "VERIFY":
      return "Verify — blocks confirmed readiness";
    case "NOT_APPLICABLE":
      return "Not applicable";
    case "UNKNOWN":
      return "Unknown — insufficient data for readiness";
    default:
      return status;
  }
}

export function decisionImpactNote(input: {
  evidenceState: EvidenceIntelligenceState;
  readinessStatus: ReadinessStatus;
  mandatory: boolean;
}): string | null {
  if (input.evidenceState === "VERIFIED" && input.readinessStatus === "READY") {
    return "Verified evidence supports readiness; decision engine weighs this with fit and risks.";
  }
  if (input.evidenceState === "FOUND_UNVERIFIED") {
    return "Evidence found but not verified — does not satisfy the requirement for decision purposes.";
  }
  if (input.evidenceState === "MISSING" && input.mandatory) {
    return "Mandatory requirement lacks company evidence — may drive CONDITIONAL GO or NO-BID.";
  }
  if (input.evidenceState === "INVALID") {
    return "Rejected evidence cannot support the requirement — treat as unresolved.";
  }
  if (input.evidenceState === "EXPIRED") {
    return "Evidence appears expired — renewal required before it can support a bid.";
  }
  if (input.evidenceState === "UNKNOWN") {
    return "Insufficient traceable evidence — decision treats this factor as uncertain.";
  }
  return null;
}
