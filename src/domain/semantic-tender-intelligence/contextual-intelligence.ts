/**
 * Rejected meaningful content stays as structured context — never silently deleted.
 */

import type { ContextualIntelligenceRecord } from "@/domain/tender-intelligence/canonical-snapshot";
import type { InterpretedSemanticStatement, SemanticExclusionCode } from "./types";

function kindForRejected(
  stmt: InterpretedSemanticStatement,
): ContextualIntelligenceRecord["kind"] {
  if (
    stmt.exclusionCode === "EXCLUDED_VERSION_CONFLICT" ||
    stmt.exclusionCode === "EXCLUDED_VERSION_REVIEW"
  ) {
    return "VERSION_CONFLICT";
  }
  if (stmt.clausePurpose === "BUYER_OBLIGATION") return "BUYER_DUTY";
  if (
    stmt.clausePurpose === "PROCEDURAL_RULE" ||
    stmt.exclusionCode === "EXCLUDED_PORTAL_OPERATION" ||
    stmt.documentPurpose === "PORTAL_GUIDE"
  ) {
    return "PROCEDURAL";
  }
  if (
    stmt.clausePurpose === "POST_AWARD_OBLIGATION" ||
    stmt.exclusionCode === "EXCLUDED_POST_AWARD"
  ) {
    return "POST_AWARD";
  }
  if (stmt.documentPurpose === "POLICY_OR_CODE" || stmt.exclusionCode === "EXCLUDED_POLICY_CONTEXT") {
    return "POLICY_CONTEXT";
  }
  if (stmt.clausePurpose === "EVALUATION") return "EVALUATION";
  if (
    stmt.clausePurpose === "AMENDMENT" ||
    stmt.clausePurpose === "CLARIFICATION" ||
    stmt.clausePurpose === "Q_AND_A"
  ) {
    return "AMENDMENT";
  }
  if (
    stmt.exclusionCode === "AMBIGUOUS_ACTOR" ||
    stmt.exclusionCode === "AMBIGUOUS_PHASE" ||
    stmt.exclusionCode === "AMBIGUOUS_APPLICABILITY"
  ) {
    return "AMBIGUOUS";
  }
  return "NON_REQUIREMENT";
}

export function toContextualIntelligence(
  rejected: InterpretedSemanticStatement[],
  metadata: Array<{
    text: string;
    exclusionCode: SemanticExclusionCode | null;
    provenance: { sourceDocument: string | null };
  }>,
  limit = 80,
): ContextualIntelligenceRecord[] {
  const fromMeta = metadata.map((m) => ({
    kind: "METADATA" as const,
    text: m.text.slice(0, 240),
    exclusionCode: m.exclusionCode,
    sourceDocument: m.provenance.sourceDocument,
  }));
  const fromRejected = rejected
    .filter((r) => r.requirementText.trim().length >= 12 && r.exclusionCode)
    .map((r) => ({
      kind: kindForRejected(r),
      text: r.requirementText.slice(0, 240),
      exclusionCode: r.exclusionCode,
      sourceDocument: r.provenance.sourceDocument,
    }));
  return [...fromMeta, ...fromRejected].slice(0, limit);
}
