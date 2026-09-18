/**
 * Map canonical requirement + evidence state → user-facing verification status.
 * Never treats AI/INFERRED evidence as VERIFIED without human (team) provenance.
 */

import type { ReadinessStatus } from "@/domain/decision/tender-readiness";
import { runAutomatedEvidenceChecks } from "@/domain/evidence-verification/automated-checks";
import { isRealEvidenceText } from "@/domain/evidence-verification/select-evidence";
import type {
  CanonicalEvidenceRecord,
  RequirementVerificationStatus,
} from "@/domain/evidence-verification/types";

export function deriveRequirementVerificationStatus(input: {
  readinessStatus: ReadinessStatus;
  evidence: CanonicalEvidenceRecord | null;
  requirementDescription: string;
  requirementValue: string | null;
  storedReason?: string | null;
}): { status: RequirementVerificationStatus; reason: string | null } {
  if (input.readinessStatus === "NOT_APPLICABLE") {
    return { status: "NOT_APPLICABLE", reason: "Requirement marked not applicable." };
  }

  const humanVerified =
    Boolean(input.evidence?.teamTaskId) &&
    input.evidence?.verificationStatus === "VERIFIED";

  if (humanVerified) {
    return {
      status: "VERIFIED",
      reason:
        input.storedReason ??
        input.evidence?.verificationReason ??
        "Verified by authorized reviewer via team workflow.",
    };
  }

  const hasExcerpt = isRealEvidenceText(input.evidence?.evidenceText ?? null);

  if (!hasExcerpt && input.readinessStatus === "MISSING") {
    return {
      status: "MISSING_EVIDENCE",
      reason: "No evidence excerpt is linked and the requirement appears missing.",
    };
  }

  if (!hasExcerpt && (input.readinessStatus === "VERIFY" || input.readinessStatus === "UNKNOWN")) {
    return {
      status: "MISSING_EVIDENCE",
      reason: "Verification blocked — no evidence excerpt available.",
    };
  }

  const automated = runAutomatedEvidenceChecks({
    requirementDescription: input.requirementDescription,
    requirementValue: input.requirementValue,
    readinessStatus: input.readinessStatus,
    evidence: input.evidence,
  });

  if (input.readinessStatus === "READY" && !humanVerified) {
    return {
      status: "NEEDS_VERIFICATION",
      reason:
        automated.suggestedReason ??
        "Requirement appears ready but evidence has not been human-verified.",
    };
  }

  return {
    status: "NEEDS_VERIFICATION",
    reason:
      input.storedReason ??
      automated.suggestedReason ??
      "Evidence requires human verification.",
  };
}

export function formatLocationLabel(input: {
  sourceDocument: string | null;
  pageNumber: number | null;
  section: string | null;
}): string | null {
  if (input.pageNumber == null && !input.section?.trim() && !input.sourceDocument) {
    return null;
  }
  const parts = [
    input.sourceDocument,
    input.section ? `Section ${input.section}` : null,
    input.pageNumber != null ? `Page ${input.pageNumber}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
