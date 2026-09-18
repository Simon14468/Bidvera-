/**
 * Provenance — source section must not be replaced by document title / wrong section.
 */

import { failure } from "../helpers";
import type { DecisionGuardianInput, GuardianValidationFailure } from "../types";

const TITLE_LIKE =
  /^(?:subject|objet|title|tender\s+title|appel\s+d['']offres)\s*[:\-]/i;

export function checkProvenance(
  input: DecisionGuardianInput,
): GuardianValidationFailure[] {
  const out: GuardianValidationFailure[] = [];

  for (const req of input.requirements) {
    const section = (req.sourceSection ?? "").trim();
    if (!section) {
      // Missing section is advisory unless requirement has an explicit ref that implies a section
      if (/\b[TR]-\d{2}\b/i.test(req.requirement)) {
        out.push(
          failure({
            validationCode: "REQUIREMENT_PROVENANCE_WRONG",
            severity: "MEDIUM",
            check: "provenance",
            explanation: `Requirement ${req.id} has a tender ref but no source section provenance.`,
            affectedCanonicalItemId: req.id,
          }),
        );
      }
      continue;
    }

    if (TITLE_LIKE.test(section) && section.length < 120) {
      out.push(
        failure({
          validationCode: "REQUIREMENT_PROVENANCE_WRONG",
          severity: "HIGH",
          check: "provenance",
          explanation: `Source section looks like a document title, not the requirement section: "${section.slice(0, 80)}"`,
          affectedCanonicalItemId: req.id,
          sourceProvenance: section,
        }),
      );
    }

    // Section that is literally the full requirement text is suspicious overwrite
    if (
      section.length > 40 &&
      req.requirement.length > 40 &&
      section.toLowerCase() === req.requirement.toLowerCase()
    ) {
      out.push(
        failure({
          validationCode: "REQUIREMENT_PROVENANCE_WRONG",
          severity: "MEDIUM",
          check: "provenance",
          explanation: `Source section identical to requirement text for ${req.id} — provenance likely overwritten.`,
          affectedCanonicalItemId: req.id,
          sourceProvenance: section.slice(0, 80),
        }),
      );
    }
  }

  return out;
}
