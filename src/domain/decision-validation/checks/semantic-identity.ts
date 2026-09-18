/**
 * Semantic identity — one stable identity per obligation; reject duplicate fingerprints.
 */

import { canonicalObligationFingerprint } from "@/domain/tender-requirements/semantic-dedupe";
import { failure } from "../helpers";
import type { DecisionGuardianInput, GuardianValidationFailure } from "../types";

export function checkSemanticIdentity(
  input: DecisionGuardianInput,
): GuardianValidationFailure[] {
  const out: GuardianValidationFailure[] = [];
  const seen = new Map<string, string>();

  for (const req of input.requirements) {
    const fp = canonicalObligationFingerprint(req);
    const prev = seen.get(fp);
    if (prev) {
      out.push(
        failure({
          validationCode: "DUPLICATE_SEMANTIC_IDENTITY",
          severity: "CRITICAL",
          check: "semantic-identity",
          explanation: `Duplicate semantic obligation fingerprint "${fp}" shared by ${prev} and ${req.id}.`,
          affectedCanonicalItemId: req.id,
          sourceProvenance: req.sourceSection ?? null,
        }),
      );
    } else {
      seen.set(fp, req.id);
    }
  }

  return out;
}
