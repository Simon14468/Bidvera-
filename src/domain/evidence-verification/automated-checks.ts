/**
 * Conservative automated evidence checks — advisory reasons only.
 * Never upgrades status to VERIFIED; never invents evidence.
 */

import type { ReadinessStatus } from "@/domain/decision/tender-readiness";
import type { CanonicalEvidenceRecord } from "@/domain/evidence-verification/types";

const EXPIRED_PATTERNS = [
  /\bexpir(?:ed|y|ation)\b/i,
  /\bvalid\s+until\b/i,
  /\bvalidity\s+.*\b20\d{2}\b/i,
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+20\d{2}\b/i,
];

const CERT_PATTERNS = [
  /\biso\s*\d+/i,
  /\bcertif(?:icate|ication)\b/i,
  /\baccredit(?:ation|ed)\b/i,
];

export type AutomatedCheckResult = {
  flags: string[];
  suggestedReason: string | null;
};

export function runAutomatedEvidenceChecks(input: {
  requirementDescription: string;
  requirementValue: string | null;
  readinessStatus: ReadinessStatus;
  evidence: CanonicalEvidenceRecord | null;
}): AutomatedCheckResult {
  const flags: string[] = [];
  const text = input.evidence?.evidenceText?.trim() ?? "";
  const combined = `${input.requirementDescription} ${input.requirementValue ?? ""} ${text}`;

  if (!text) {
    if (input.readinessStatus === "MISSING") {
      flags.push("no_evidence_excerpt");
    }
    return {
      flags,
      suggestedReason:
        flags.length > 0 ? "No supporting evidence excerpt is linked to this requirement." : null,
    };
  }

  if (input.evidence && !input.evidence.teamTaskId) {
    if (input.evidence.verificationStatus === "INFERRED") {
      flags.push("ai_interpretation_only");
    }
    if (input.evidence.verificationStatus === "UNKNOWN") {
      flags.push("unverified_provenance");
    }
  }

  for (const p of EXPIRED_PATTERNS) {
    if (p.test(combined)) {
      flags.push("validity_date_review");
      break;
    }
  }

  if (CERT_PATTERNS.some((p) => p.test(input.requirementDescription))) {
    if (!CERT_PATTERNS.some((p) => p.test(text))) {
      flags.push("certification_not_confirmed_in_excerpt");
    }
  }

  if (input.requirementValue?.trim()) {
    const val = input.requirementValue.trim().toLowerCase();
    if (val.length >= 3 && !text.toLowerCase().includes(val.slice(0, Math.min(20, val.length)))) {
      flags.push("required_value_not_found_in_excerpt");
    }
  }

  const suggestedReason =
    flags.length === 0
      ? null
      : flags.includes("ai_interpretation_only")
        ? "Evidence is an AI or profile interpretation — human verification required."
        : flags.includes("no_evidence_excerpt")
          ? "No supporting evidence excerpt is linked to this requirement."
          : flags.includes("validity_date_review")
            ? "Validity or expiry dates require human confirmation."
            : flags.includes("certification_not_confirmed_in_excerpt")
              ? "Certification requirement — excerpt does not explicitly confirm the certificate."
              : "Evidence requires human verification before it can be treated as confirmed.";

  return { flags, suggestedReason };
}
