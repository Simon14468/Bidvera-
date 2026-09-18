/**
 * Executive readiness summary for Evidence Intelligence UI.
 */

import type {
  EvidenceIntelligenceState,
  EvidenceReadinessSummary,
  RequirementEvidenceIntelligenceRow,
} from "./types";

const NEEDS_REVIEW_STATES: EvidenceIntelligenceState[] = [
  "FOUND_UNVERIFIED",
  "EXPIRED",
  "INVALID",
  "UNKNOWN",
];

export function buildEvidenceReadinessSummary(
  rows: RequirementEvidenceIntelligenceRow[],
): EvidenceReadinessSummary {
  const scorable = rows.filter(
    (r) => r.requirementVerificationStatus !== "NOT_APPLICABLE",
  );

  const supported = scorable.filter((r) => r.evidenceState === "VERIFIED").length;
  const missingEvidence = scorable.filter((r) => r.evidenceState === "MISSING").length;
  const needVerification = scorable.filter((r) =>
    NEEDS_REVIEW_STATES.includes(r.evidenceState),
  ).length;

  return {
    totalRequirements: scorable.length,
    supported,
    needVerification,
    missingEvidence,
  };
}

export function verificationDisplayLabel(input: {
  evidenceState: EvidenceIntelligenceState;
  requirementVerificationStatus: RequirementEvidenceIntelligenceRow["requirementVerificationStatus"];
}): string {
  if (input.evidenceState === "VERIFIED") return "Human verified";
  if (input.evidenceState === "FOUND_UNVERIFIED") return "Needs verification";
  if (input.evidenceState === "MISSING") return "Missing evidence";
  if (input.evidenceState === "EXPIRED") return "Expired — renew and verify";
  if (input.evidenceState === "INVALID") return "Rejected — unsupported";
  if (input.requirementVerificationStatus === "NOT_APPLICABLE") return "Not applicable";
  return "Unknown — review required";
}

export function evidenceDisplayTitle(
  row: RequirementEvidenceIntelligenceRow,
): string {
  if (row.evidence?.title?.trim()) return row.evidence.title.trim();
  if (row.evidence?.excerpt?.trim()) {
    const t = row.evidence.excerpt.trim();
    return t.length > 60 ? `${t.slice(0, 57)}…` : t;
  }
  return "No evidence on file";
}

export function sourceDisplayLabel(row: RequirementEvidenceIntelligenceRow): string {
  if (row.evidence?.sourceLocation?.trim()) return row.evidence.sourceLocation.trim();
  if (row.locationLabel?.trim()) return row.locationLabel.trim();
  if (row.evidence?.sourceDocument?.trim()) return row.evidence.sourceDocument.trim();
  return "Source unknown";
}
