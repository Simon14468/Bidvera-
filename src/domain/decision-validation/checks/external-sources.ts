/**
 * External source claims — never overwrite tender facts; ungrounded claims flagged.
 */

import { failure } from "../helpers";
import type { DecisionGuardianInput, GuardianValidationFailure } from "../types";

export function checkExternalSources(
  input: DecisionGuardianInput,
): GuardianValidationFailure[] {
  const out: GuardianValidationFailure[] = [];

  for (const claim of input.externalClaims ?? []) {
    if (
      claim.overwritesTenderValue &&
      claim.tenderAuthoritativeValue &&
      claim.overwritesTenderValue !== claim.tenderAuthoritativeValue
    ) {
      out.push(
        failure({
          validationCode: "EXTERNAL_OVERWRITE_TENDER_FACT",
          severity: "CRITICAL",
          check: "external-sources",
          explanation: `External claim attempted to overwrite tender fact (${claim.relatedFactKey ?? "unknown"}): tender="${claim.tenderAuthoritativeValue}" external="${claim.overwritesTenderValue}" [${claim.source}]`,
          sourceProvenance: claim.url ?? claim.source,
        }),
      );
    }

    if (claim.affectsDecisionLogic && claim.confidence === "UNKNOWN") {
      out.push(
        failure({
          validationCode: "EXTERNAL_CLAIM_UNGROUNDED",
          severity: "HIGH",
          check: "external-sources",
          explanation: `Decision-affecting external claim has UNKNOWN confidence — mark NEEDS_VERIFICATION, never guess. Claim: "${claim.claim.slice(0, 120)}"`,
          sourceProvenance: claim.url ?? claim.source,
        }),
      );
    }

    if (claim.affectsDecisionLogic && !claim.source?.trim()) {
      out.push(
        failure({
          validationCode: "EXTERNAL_CLAIM_UNGROUNDED",
          severity: "HIGH",
          check: "external-sources",
          explanation: `Decision-affecting external claim missing source metadata.`,
        }),
      );
    }
  }

  return out;
}
