/**
 * Shared evidence signals for Fit and Risk — avoids circular imports.
 */

import type { DeterministicFinding } from "@/domain/decision/types";
import type { RequirementMatchStatus } from "@prisma/client";

/** Findings that prove non-compliance — not mere profile gaps. */
export const CONFIRMED_NON_COMPLIANCE_FINDING_CODES = new Set([
  "CERT_EXPLICITLY_NOT_HELD",
  "REVENUE_BELOW",
  "EXPERIENCE_BELOW",
  "GEOGRAPHY_NOT_COVERED",
  "GEO_MISMATCH",
]);

/** Findings that require verification — must NOT become HIGH structured risks. */
export const VERIFICATION_ONLY_FINDING_CODES = new Set([
  "CERT_UNKNOWN",
  "CERT_MISSING",
  "REVENUE_UNKNOWN",
  "EXPERIENCE_UNKNOWN",
  "EXPERIENCE_LEVEL_ONLY",
  "GEOGRAPHY_UNKNOWN",
]);

const EXPLICIT_NEGATIVE_EVIDENCE =
  /\b(not_held:|explicitly\s+(?:lack|does\s+not\s+hold|states\s+.*not)|does\s+not\s+meet|below\s+(?:the\s+)?(?:required\s+)?threshold|cannot\s+provide|unable\s+to\s+provide|no\s+(?:stated\s+)?24\s*\/\s*7|not\s+listed.*not\s+held)\b/i;

export function hasExplicitNonComplianceEvidence(input: {
  matchStatus: RequirementMatchStatus;
  evidence: string | null;
  findings: DeterministicFinding[];
  requirementIndex: number;
}): boolean {
  for (const f of input.findings) {
    if (f.requirementIndex !== input.requirementIndex) continue;
    if (CONFIRMED_NON_COMPLIANCE_FINDING_CODES.has(f.code)) return true;
  }
  if (input.matchStatus === "FAILED" && input.evidence && EXPLICIT_NEGATIVE_EVIDENCE.test(input.evidence)) {
    return true;
  }
  return false;
}

export function isObjectivelyExpiredEvidence(
  text: string | null | undefined,
  asOf: Date = new Date(),
): boolean {
  if (!text?.trim()) return false;
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T23:59:59.000Z`);
    return !Number.isNaN(d.getTime()) && d.getTime() < asOf.getTime();
  }
  const eu = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
  if (eu) {
    const d = new Date(Date.UTC(Number(eu[3]), Number(eu[2]) - 1, Number(eu[1]), 23, 59, 59));
    return !Number.isNaN(d.getTime()) && d.getTime() < asOf.getTime();
  }
  return false;
}
