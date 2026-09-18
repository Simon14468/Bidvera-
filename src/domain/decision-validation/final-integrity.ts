/**
 * Final integrity assertion — mandatory checklist before COMPLETED release.
 * Composes Guardian + explicit production-lock invariants.
 */

import { assertDecisionGuardianReady, runDecisionGuardian } from "./guardian";
import type { DecisionGuardianInput, DecisionGuardianResult } from "./types";
import { DecisionGuardianError } from "./types";
import type { DecisionGuardianSnapshot } from "./snapshot";
import { failure } from "./helpers";

export type FinalReleaseIntegrityResult = DecisionGuardianResult & {
  snapshot: DecisionGuardianSnapshot | null;
  finalChecklist: string[];
};

const FINAL_CHECKLIST = [
  "valid_document",
  "canonical_dataset_valid",
  "no_forbidden_semantic_kinds",
  "no_semantic_duplicates",
  "no_truncated_decision_critical",
  "ids_stable",
  "conditional_clauses_preserved",
  "numeric_date_time_source_consistent",
  "provenance_valid",
  "evidence_state_valid",
  "risk_state_valid",
  "decision_valid",
  "actions_valid",
  "web_pdf_counts_identical",
  "downstream_canonical_identity",
  "no_stale_result",
  "no_critical_validation_errors",
] as const;

/**
 * Fail-closed final gate. Throws DecisionGuardianError when any CRITICAL/HIGH fails.
 * Returns a persistable snapshot only when ok.
 */
export function assertFinalReleaseIntegrity(
  input: DecisionGuardianInput,
  contentHash: string,
): FinalReleaseIntegrityResult {
  const result = runDecisionGuardian(input);

  // Explicit checklist mapping — ensure required production checks ran
  const requiredChecks = [
    "document-integrity",
    "canonical-boundary",
    "semantic-identity",
    "conditionality",
    "deadlines",
    "evidence-rules",
    "cross-module",
    "decision-integrity",
    "report-integrity",
  ];
  for (const name of requiredChecks) {
    if (!result.checksRun.includes(name)) {
      result.failures.push(
        failure({
          validationCode: "GUARDIAN_INTERNAL_ERROR",
          severity: "CRITICAL",
          check: "final-integrity",
          explanation: `Final integrity checklist missing required check: ${name}`,
        }),
      );
      result.blockingFailures.push(result.failures[result.failures.length - 1]!);
      result.ok = false;
    }
  }

  if (!result.ok) {
    throw new DecisionGuardianError(result);
  }

  // Re-assert via throw path for fail-closed consumers that only call assert*
  assertDecisionGuardianReady(input);

  const snapshot: DecisionGuardianSnapshot = {
    ok: true,
    validatedAt: result.validatedAt,
    durationMs: result.durationMs,
    checksRun: result.checksRun,
    contentHash,
    blockingFailureCount: 0,
    advisoryFailureCount: result.advisoryFailures.length,
    version: "decision-guardian/v1",
  };

  return {
    ...result,
    snapshot,
    finalChecklist: [...FINAL_CHECKLIST],
  };
}

export { FINAL_CHECKLIST };
