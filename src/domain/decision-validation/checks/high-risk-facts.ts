/**
 * High-risk fact validation — amounts, dates, %, thresholds, refs must survive into canonical text.
 */

import {
  createFactTokenCache,
  missingHighRiskTokens,
} from "../high-risk-facts";
import { failure } from "../helpers";
import type { DecisionGuardianInput, GuardianValidationFailure } from "../types";

const CRITICAL_KINDS = [
  "REQUIREMENT_REF",
  "CURRENCY_AMOUNT",
  "PERCENTAGE",
  "TECHNICAL_THRESHOLD",
  "DURATION",
  "EXPERIENCE",
  "TIME",
  "CONDITIONAL",
] as const;

export function checkHighRiskFacts(
  input: DecisionGuardianInput,
): GuardianValidationFailure[] {
  const out: GuardianValidationFailure[] = [];
  const cache = createFactTokenCache();
  void cache; // reserved for multi-pass reuse within this check

  for (const req of input.requirements) {
    if (req.evidenceText && req.evidenceText.length >= 20) {
      const missing = missingHighRiskTokens(req.evidenceText, req.requirement, [
        ...CRITICAL_KINDS,
      ]);
      for (const token of missing) {
        // Evidence windows can be wider than obligation lines — only fail hard on refs/conditionals/amounts
        const severity =
          token.kind === "REQUIREMENT_REF" ||
          token.kind === "CONDITIONAL" ||
          token.kind === "CURRENCY_AMOUNT" ||
          token.kind === "PERCENTAGE" ||
          token.kind === "TIME"
            ? "HIGH"
            : "MEDIUM";
        out.push(
          failure({
            validationCode:
              token.kind === "REQUIREMENT_REF"
                ? "REQUIREMENT_ID_LOST"
                : token.kind === "CONDITIONAL"
                  ? "REQUIREMENT_CONDITION_LOST"
                  : "HIGH_RISK_FACT_MUTATED",
            severity,
            check: "high-risk-facts",
            explanation: `High-risk ${token.kind} token "${token.raw}" present in evidence but missing from canonical requirement ${req.id}.`,
            affectedCanonicalItemId: req.id,
            sourceProvenance: req.sourceSection ?? null,
          }),
        );
      }
    }

    // Value field should not invent amounts absent from requirement/evidence
    if (req.value && req.value.trim().length >= 2) {
      const valueTokens = missingHighRiskTokens(req.value, `${req.requirement} ${req.evidenceText ?? ""}`, [
        "CURRENCY_AMOUNT",
        "PERCENTAGE",
        "TECHNICAL_THRESHOLD",
        "DURATION",
      ]);
      // If value itself is a high-risk token not found in requirement — flag unsupported
      if (
        /\d/.test(req.value) &&
        !req.requirement.toLowerCase().includes(req.value.toLowerCase().replace(/,/g, "").slice(0, 12)) &&
        !(req.evidenceText ?? "").toLowerCase().includes(req.value.toLowerCase().replace(/,/g, "").slice(0, 12))
      ) {
        out.push(
          failure({
            validationCode: "HIGH_RISK_FACT_UNSUPPORTED",
            severity: "HIGH",
            check: "high-risk-facts",
            explanation: `Requirement value "${req.value}" is not grounded in requirement/evidence text for ${req.id}.`,
            affectedCanonicalItemId: req.id,
            sourceProvenance: req.sourceSection ?? null,
          }),
        );
      }
      void valueTokens;
    }
  }

  // Expected commercial cues must appear somewhere in canonical set
  for (const cue of input.expectedCommercialCues ?? []) {
    const hit = input.requirements.some((r) =>
      r.requirement.toLowerCase().includes(cue.toLowerCase()),
    );
    if (!hit) {
      out.push(
        failure({
          validationCode: "MISSING_COMMERCIAL_OBLIGATION",
          severity: "HIGH",
          check: "high-risk-facts",
          explanation: `Expected commercial/contractual obligation cue missing from canonical set: "${cue}"`,
        }),
      );
    }
  }

  return out;
}
