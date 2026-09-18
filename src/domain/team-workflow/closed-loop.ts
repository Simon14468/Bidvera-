/**
 * Closed-loop team evidence helpers — pure functions.
 * Never invents evidence; never auto-verifies.
 */

import { createHash } from "crypto";
import type {
  RequirementMatchStatus,
  TeamEvidenceVerificationStatus,
  TeamWorkflowTaskKind,
} from "@prisma/client";

export function canVerifyTeamEvidence(role: string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

/** Completing a task without verification is only allowed when nothing decision-critical is linked. */
export function requiresVerificationBeforeComplete(input: {
  kind: TeamWorkflowTaskKind;
  requirementId: string | null;
  riskId: string | null;
  missingDocId: string | null;
}): boolean {
  if (input.requirementId || input.riskId || input.missingDocId) return true;
  return (
    input.kind === "REQUIREMENT_GAP" ||
    input.kind === "EVIDENCE_REQUEST" ||
    input.kind === "MISSING_DOCUMENT" ||
    input.kind === "RISK_MITIGATION"
  );
}

export function isVerifiedEvidence(
  status: TeamEvidenceVerificationStatus,
): boolean {
  return status === "VERIFIED";
}

/**
 * Build provenance text for requirement.evidence — never invents company facts.
 */
export function buildVerifiedRequirementEvidenceText(input: {
  responseText: string;
  evidenceNote: string | null;
  taskId: string;
  verifiedById: string;
  verifiedAt: Date;
  attachmentNames?: string[];
}): string {
  const parts = [
    `Team-verified response (task ${input.taskId})`,
    `Verified by ${input.verifiedById} at ${input.verifiedAt.toISOString()}`,
    input.responseText.trim().slice(0, 1500),
  ];
  if (input.evidenceNote?.trim()) {
    parts.push(`Evidence note: ${input.evidenceNote.trim().slice(0, 500)}`);
  }
  if (input.attachmentNames?.length) {
    parts.push(`Attachments: ${input.attachmentNames.join(", ")}`);
  }
  return parts.join(" | ");
}

/**
 * Idempotency hash for closed-loop re-run — same verified payload → no-op.
 */
export function buildClosedLoopHash(input: {
  taskId: string;
  responseText: string;
  evidenceNote: string | null;
  appliedRequirementStatus: RequirementMatchStatus | null;
  attachmentChecksums: string[];
}): string {
  const payload = [
    input.taskId,
    input.responseText.trim(),
    input.evidenceNote?.trim() ?? "",
    input.appliedRequirementStatus ?? "",
    ...input.attachmentChecksums.slice().sort(),
  ].join("\n");
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Default requirement status when verifier confirms evidence closes a gap.
 * Verifier may override; never invent MATCHED without VERIFIED verdict.
 */
export function defaultAppliedRequirementStatus(input: {
  kind: TeamWorkflowTaskKind;
  currentStatus: RequirementMatchStatus | null;
  verdict: "VERIFIED" | "REJECTED";
}): RequirementMatchStatus | null {
  if (input.verdict === "REJECTED") return null;
  if (!input.currentStatus) return "MATCHED";
  if (
    input.currentStatus === "MISSING" ||
    input.currentStatus === "UNCERTAIN" ||
    input.currentStatus === "FAILED"
  ) {
    return "MATCHED";
  }
  return input.currentStatus;
}

export function meaningfulDecisionChange(input: {
  priorDecision: string;
  nextDecision: string;
  priorReadiness: number | null;
  nextReadiness: number | null;
  priorFit: number | null;
  nextFit: number | null;
}): boolean {
  if (input.priorDecision !== input.nextDecision) return true;
  if (
    input.priorReadiness !== input.nextReadiness &&
    (input.priorReadiness != null || input.nextReadiness != null)
  ) {
    const a = input.priorReadiness ?? -1;
    const b = input.nextReadiness ?? -1;
    if (Math.abs(a - b) >= 1) return true;
  }
  if (
    input.priorFit != null &&
    input.nextFit != null &&
    Math.abs(input.priorFit - input.nextFit) >= 1
  ) {
    return true;
  }
  return false;
}
