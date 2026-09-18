/**
 * Small helpers shared by Guardian checks.
 */

import type { GuardianSeverity, GuardianValidationCode } from "./codes";
import type { GuardianValidationFailure } from "./types";

export function failure(input: {
  validationCode: GuardianValidationCode;
  severity: GuardianSeverity;
  explanation: string;
  check: string;
  affectedCanonicalItemId?: string | null;
  sourceProvenance?: string | null;
}): GuardianValidationFailure {
  return {
    validationCode: input.validationCode,
    severity: input.severity,
    explanation: input.explanation,
    affectedCanonicalItemId: input.affectedCanonicalItemId ?? null,
    sourceProvenance: input.sourceProvenance ?? null,
    check: input.check,
  };
}

/** Catch existing throw-based asserts and map to structured failures. */
export function captureAssert(
  check: string,
  validationCode: GuardianValidationCode,
  severity: GuardianSeverity,
  fn: () => void,
  map?: (message: string) => Partial<GuardianValidationFailure>,
): GuardianValidationFailure[] {
  try {
    fn();
    return [];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const extra = map?.(message) ?? {};
    return [
      failure({
        validationCode: extra.validationCode ?? validationCode,
        severity: extra.severity ?? severity,
        explanation: extra.explanation ?? message,
        check,
        affectedCanonicalItemId: extra.affectedCanonicalItemId,
        sourceProvenance: extra.sourceProvenance,
      }),
    ];
  }
}
