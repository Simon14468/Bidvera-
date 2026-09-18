/**
 * Canonical boundary — reject headings, QA/meta, evaluation, facts, deadlines as requirements.
 * Reuses domain predicates; does not re-extract.
 */

import {
  isNonRequirementText,
  isExplicitlyNotATenderRequirementSection,
} from "@/domain/tender-requirements/filter-non-requirements";
import { isRealBidderObligation } from "@/domain/tender-requirements/obligation";
import { isScoringSemanticKind } from "@/domain/tender-requirements/semantic-kind";
import type { RequirementSemanticKind } from "@/domain/tender-requirements/semantic-kind";
import { failure } from "../helpers";
import type { DecisionGuardianInput, GuardianValidationFailure } from "../types";

const NON_SCORING = new Set([
  "EVALUATION_CRITERION",
  "DEADLINE",
  "CLARIFICATION_PROCEDURAL",
  "INFORMATIONAL_FACT",
  "REVIEWER_INSTRUCTION",
  "TEST_SCENARIO",
  "QA_META",
]);

export function checkCanonicalBoundary(
  input: DecisionGuardianInput,
): GuardianValidationFailure[] {
  const out: GuardianValidationFailure[] = [];

  for (const req of input.requirements) {
    const text = req.requirement;
    const section = req.sourceSection ?? "";

    if (isExplicitlyNotATenderRequirementSection(`${section} ${text}`)) {
      out.push(
        failure({
          validationCode: "CANONICAL_QA_META",
          severity: "CRITICAL",
          check: "canonical-boundary",
          explanation: `Explicit non-requirement content in canonical set: "${text.slice(0, 100)}"`,
          affectedCanonicalItemId: req.id,
          sourceProvenance: section || null,
        }),
      );
      continue;
    }

    if (isNonRequirementText(text)) {
      out.push(
        failure({
          validationCode: "CANONICAL_NON_REQUIREMENT",
          severity: "CRITICAL",
          check: "canonical-boundary",
          explanation: `Non-requirement text entered canonical dataset: "${text.slice(0, 100)}"`,
          affectedCanonicalItemId: req.id,
          sourceProvenance: section || null,
        }),
      );
      continue;
    }

    if (NON_SCORING.has(req.semanticKind)) {
      const code =
        req.semanticKind === "QA_META" || req.semanticKind === "REVIEWER_INSTRUCTION"
          ? "CANONICAL_QA_META"
          : req.semanticKind === "EVALUATION_CRITERION"
            ? "CANONICAL_EVALUATION_LEAK"
            : req.semanticKind === "DEADLINE"
              ? "CANONICAL_DEADLINE_AS_REQUIREMENT"
              : "CANONICAL_NON_REQUIREMENT";
      out.push(
        failure({
          validationCode: code,
          severity: "CRITICAL",
          check: "canonical-boundary",
          explanation: `Non-scoring semantic kind "${req.semanticKind}" in canonical requirements.`,
          affectedCanonicalItemId: req.id,
          sourceProvenance: section || null,
        }),
      );
      continue;
    }

    if (!isScoringSemanticKind(req.semanticKind as RequirementSemanticKind)) {
      out.push(
        failure({
          validationCode: "CANONICAL_NON_REQUIREMENT",
          severity: "CRITICAL",
          check: "canonical-boundary",
          explanation: `semanticKind "${req.semanticKind}" is not scoring-eligible.`,
          affectedCanonicalItemId: req.id,
        }),
      );
    }

    if (!isRealBidderObligation(text) && req.semanticKind !== "UNKNOWN") {
      out.push(
        failure({
          validationCode: "CANONICAL_NON_REQUIREMENT",
          severity: "HIGH",
          check: "canonical-boundary",
          explanation: `Canonical row lacks bidder obligation cues: "${text.slice(0, 80)}"`,
          affectedCanonicalItemId: req.id,
          sourceProvenance: section || null,
        }),
      );
    }

    if (
      /^\d+\.\s+[A-Z][^.!?]{3,140}(?:Requirements?|Criteria|Facts|Scenarios|Note)\s*\.?\s*$/i.test(
        text.trim(),
      )
    ) {
      out.push(
        failure({
          validationCode: "CANONICAL_HEADING",
          severity: "CRITICAL",
          check: "canonical-boundary",
          explanation: `Section heading leaked into canonical set: "${text.slice(0, 80)}"`,
          affectedCanonicalItemId: req.id,
        }),
      );
    }

    if (
      /^scenario\s+[a-e]\s*:/i.test(text.trim()) ||
      /\billustrate\s+reviewer\s+checks\b/i.test(text)
    ) {
      out.push(
        failure({
          validationCode: "REVIEWER_SCENARIO_LEAK",
          severity: "CRITICAL",
          check: "canonical-boundary",
          explanation: `Reviewer/test scenario leaked into canonical set: "${text.slice(0, 80)}"`,
          affectedCanonicalItemId: req.id,
          sourceProvenance: section || null,
        }),
      );
    }
  }

  return out;
}
