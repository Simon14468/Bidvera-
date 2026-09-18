/**
 * Stale result + unsupported AI claim checks.
 */

import { failure } from "../helpers";
import type { DecisionGuardianInput, GuardianValidationFailure } from "../types";

export function checkStaleResult(
  input: DecisionGuardianInput,
): GuardianValidationFailure[] {
  const stale = input.staleResult;
  if (!stale) return [];
  const out: GuardianValidationFailure[] = [];

  if (stale.canonicalContentHash !== stale.projectedContentHash) {
    out.push(
      failure({
        validationCode: "STALE_RESULT_MISMATCH",
        severity: "CRITICAL",
        check: "stale-result",
        explanation:
          "Projected Web/PDF dataset hash differs from canonical analysis hash — stale or divergent result.",
      }),
    );
  }

  if (
    stale.analyzedAt &&
    stale.projectedAnalyzedAt &&
    stale.analyzedAt !== stale.projectedAnalyzedAt
  ) {
    out.push(
      failure({
        validationCode: "STALE_RESULT_MISMATCH",
        severity: "HIGH",
        check: "stale-result",
        explanation: `Projected analyzedAt (${stale.projectedAnalyzedAt}) differs from canonical analyzedAt (${stale.analyzedAt}).`,
      }),
    );
  }

  return out;
}

export function checkUnsupportedAiClaims(
  input: DecisionGuardianInput,
): GuardianValidationFailure[] {
  const out: GuardianValidationFailure[] = [];

  for (const claim of input.aiClaims ?? []) {
    if (
      claim.affectsDecision &&
      !claim.groundedInTender &&
      !claim.groundedInCompanyEvidence
    ) {
      out.push(
        failure({
          validationCode: "UNSUPPORTED_AI_CLAIM",
          severity: "CRITICAL",
          check: "unsupported-ai-claims",
          explanation: `Decision-affecting AI claim is not grounded in tender or company evidence: "${claim.claim.slice(0, 140)}"`,
        }),
      );
    }
  }

  if (input.decision?.aiOverrodeCanonical) {
    out.push(
      failure({
        validationCode: "UNSUPPORTED_AI_CLAIM",
        severity: "CRITICAL",
        check: "unsupported-ai-claims",
        explanation: "AI advisory output overrode canonical evidence/rules.",
      }),
    );
  }

  return out;
}
