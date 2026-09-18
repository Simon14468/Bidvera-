/**
 * Evidence rules — CONFIRMED_FIT/GAP require evidence; NEEDS_VERIFICATION ≠ HIGH/CRITICAL risk.
 */

import { failure } from "../helpers";
import type { DecisionGuardianInput, GuardianValidationFailure } from "../types";

export function checkEvidenceRules(
  input: DecisionGuardianInput,
): GuardianValidationFailure[] {
  const out: GuardianValidationFailure[] = [];

  for (const req of input.requirements) {
    const fit = (req.fitStatus ?? "").toUpperCase();
    const hasTenderEvidence = Boolean(req.evidenceText?.trim());
    const hasCompanyEvidence =
      req.hasCompanyEvidence === true || Boolean(req.companyEvidenceText?.trim());

    if (fit === "CONFIRMED_FIT") {
      if (!hasCompanyEvidence && !hasTenderEvidence) {
        out.push(
          failure({
            validationCode: "EVIDENCE_MISSING_FOR_CONFIRMED_FIT",
            severity: "CRITICAL",
            check: "evidence-rules",
            explanation: `CONFIRMED_FIT on ${req.id} without valid company/tender evidence.`,
            affectedCanonicalItemId: req.id,
            sourceProvenance: req.sourceSection ?? null,
          }),
        );
      } else if (!hasCompanyEvidence) {
        // Fit against company capability requires company evidence; tender text alone is insufficient
        out.push(
          failure({
            validationCode: "EVIDENCE_MISSING_FOR_CONFIRMED_FIT",
            severity: "HIGH",
            check: "evidence-rules",
            explanation: `CONFIRMED_FIT on ${req.id} lacks verified company evidence (tender text alone is not company capability).`,
            affectedCanonicalItemId: req.id,
            sourceProvenance: req.sourceSection ?? null,
          }),
        );
      }
    }

    if (fit === "CONFIRMED_GAP") {
      if (!hasCompanyEvidence && !hasTenderEvidence) {
        out.push(
          failure({
            validationCode: "EVIDENCE_MISSING_FOR_CONFIRMED_GAP",
            severity: "CRITICAL",
            check: "evidence-rules",
            explanation: `CONFIRMED_GAP on ${req.id} without contradictory/definitive evidence.`,
            affectedCanonicalItemId: req.id,
            sourceProvenance: req.sourceSection ?? null,
          }),
        );
      } else if (!hasCompanyEvidence) {
        out.push(
          failure({
            validationCode: "EVIDENCE_MISSING_FOR_CONFIRMED_GAP",
            severity: "HIGH",
            check: "evidence-rules",
            explanation: `CONFIRMED_GAP on ${req.id} lacks contradictory/definitive company evidence (tender text alone is not a confirmed gap).`,
            affectedCanonicalItemId: req.id,
            sourceProvenance: req.sourceSection ?? null,
          }),
        );
      }
    }

    // No evidence must not be treated as confirmed anything
    if (
      !hasCompanyEvidence &&
      !hasTenderEvidence &&
      (fit === "CONFIRMED_FIT" || fit === "CONFIRMED_GAP")
    ) {
      // already covered above
    }
  }

  for (const risk of input.risks ?? []) {
    const fit = (risk.fitStatus ?? "").toUpperCase();
    const state = (risk.evidenceState ?? "").toUpperCase();
    const sev = (risk.severity ?? "").toUpperCase();
    const isVerificationOnly =
      fit === "NEEDS_VERIFICATION" ||
      state === "NEEDS_VERIFICATION" ||
      state === "UNKNOWN";

    if (isVerificationOnly && (sev === "HIGH" || sev === "CRITICAL")) {
      out.push(
        failure({
          validationCode: "VERIFICATION_ESCALATED_TO_HIGH_RISK",
          severity: "CRITICAL",
          check: "evidence-rules",
          explanation: `NEEDS_VERIFICATION/UNKNOWN risk "${risk.title ?? risk.id}" escalated to ${sev} — verification must never auto-become HIGH/CRITICAL.`,
          affectedCanonicalItemId: risk.requirementId ?? null,
        }),
      );
    }
  }

  return out;
}
