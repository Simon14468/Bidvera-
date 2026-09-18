/**
 * Conditionality — never promote conditional → mandatory globally.
 */

import { hasConditionalTriggerContext } from "@/domain/tender-requirements/conditional-context";
import { failure } from "../helpers";
import type { DecisionGuardianInput, GuardianValidationFailure } from "../types";

export function checkConditionality(
  input: DecisionGuardianInput,
): GuardianValidationFailure[] {
  const out: GuardianValidationFailure[] = [];

  for (const req of input.requirements) {
    if (req.obligationStrength === "CONDITIONAL" && req.mandatory === true) {
      out.push(
        failure({
          validationCode: "CONDITIONAL_PROMOTED_TO_MANDATORY",
          severity: "CRITICAL",
          check: "conditionality",
          explanation: `Conditional requirement ${req.id} marked mandatory=true — conditionality lost.`,
          affectedCanonicalItemId: req.id,
          sourceProvenance: req.sourceSection ?? null,
        }),
      );
    }

    if (
      req.obligationStrength === "CONDITIONAL" &&
      !hasConditionalTriggerContext(req.requirement)
    ) {
      out.push(
        failure({
          validationCode: "REQUIREMENT_CONDITION_LOST",
          severity: "HIGH",
          check: "conditionality",
          explanation: `Conditional strength without preserved condition text on ${req.id}.`,
          affectedCanonicalItemId: req.id,
          sourceProvenance: req.sourceSection ?? null,
        }),
      );
    }
  }

  return out;
}
