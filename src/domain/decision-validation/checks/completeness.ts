/**
 * Requirement completeness — IDs, conditions, numeric meaning, provenance fields.
 * Detects silent truncation and lost decision-critical tokens.
 */

import { extractRequirementRef } from "@/domain/tender-requirements/requirement-ref";
import { hasConditionalTriggerContext } from "@/domain/tender-requirements/conditional-context";
import { failure } from "../helpers";
import type { DecisionGuardianInput, GuardianValidationFailure } from "../types";

/** Decision-critical tokens that must not vanish between evidence and requirement text. */
function criticalTokens(text: string): string[] {
  const tokens: string[] = [];
  const amounts = text.matchAll(
    /\b(?:MAD|DH|EUR|USD|RM)?\s*[\d]{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?\s*%?|\b\d+(?:\.\d+)?\s*(?:%|Gbps|Mbps|months?|years?|days?|hours?|weeks?)\b/gi,
  );
  for (const m of amounts) tokens.push(m[0].replace(/\s+/g, " ").trim().toLowerCase());
  const refs = text.match(/\b([ETR]-\d{2})\b/gi);
  if (refs) tokens.push(...refs.map((r) => r.toUpperCase()));
  return [...new Set(tokens)];
}

export function checkRequirementCompleteness(
  input: DecisionGuardianInput,
): GuardianValidationFailure[] {
  const out: GuardianValidationFailure[] = [];

  for (const req of input.requirements) {
    const text = req.requirement.trim();
    if (text.length < 20) {
      out.push(
        failure({
          validationCode: "REQUIREMENT_TRUNCATED",
          severity: "HIGH",
          check: "requirement-completeness",
          explanation: `Canonical requirement text too short to preserve obligation meaning: "${text}"`,
          affectedCanonicalItemId: req.id,
          sourceProvenance: req.sourceSection ?? null,
        }),
      );
    }

    // Mid-phrase truncation (PDF wrap leftovers) — ends on dangling connector / incomplete clause
    if (
      /\b(during the|including the|and the|provided by the successful|include programmable|rather than repairing existing units,? the proposed)\s*$/i.test(
        text,
      ) ||
      /\b(the|and|or|of|for|with|by|to)\s*$/i.test(text)
    ) {
      out.push(
        failure({
          validationCode: "REQUIREMENT_TRUNCATED",
          severity: "CRITICAL",
          check: "requirement-completeness",
          explanation: `Canonical requirement appears truncated mid-phrase: "${text.slice(-80)}"`,
          affectedCanonicalItemId: req.id,
          sourceProvenance: req.sourceSection ?? null,
        }),
      );
    }

    const refInText = extractRequirementRef(text);
    if (refInText && req.id && req.id !== refInText && !req.id.startsWith("t2-") && !req.id.startsWith("req-") && !req.id.startsWith("t2c-")) {
      // Stable synthetic ids are allowed; mismatch only when both look like tender refs
      if (/^[ETR]-\d{2}$/i.test(req.id) && req.id.toUpperCase() !== refInText) {
        out.push(
          failure({
            validationCode: "REQUIREMENT_ID_LOST",
            severity: "HIGH",
            check: "requirement-completeness",
            explanation: `Requirement ID mismatch: id=${req.id} but text references ${refInText}.`,
            affectedCanonicalItemId: req.id,
            sourceProvenance: req.sourceSection ?? null,
          }),
        );
      }
    }

    if (req.obligationStrength === "CONDITIONAL") {
      if (!hasConditionalTriggerContext(text)) {
        out.push(
          failure({
            validationCode: "REQUIREMENT_CONDITION_LOST",
            severity: "CRITICAL",
            check: "requirement-completeness",
            explanation: `Conditional obligation lost trigger context: "${text.slice(0, 100)}"`,
            affectedCanonicalItemId: req.id,
            sourceProvenance: req.sourceSection ?? null,
          }),
        );
      }
    }

    if (!req.semanticKind || req.semanticKind === "UNKNOWN") {
      out.push(
        failure({
          validationCode: "REQUIREMENT_SEMANTIC_MISMATCH",
          severity: "MEDIUM",
          check: "requirement-completeness",
          explanation: `Canonical item missing clear semanticKind: "${text.slice(0, 80)}"`,
          affectedCanonicalItemId: req.id,
        }),
      );
    }

    if (req.evidenceText) {
      const evidenceTokens = criticalTokens(req.evidenceText);
      const reqFold = text.toLowerCase();
      for (const token of evidenceTokens) {
        if (token.length < 3) continue;
        // Only flag numeric/ref tokens clearly present in evidence but absent from requirement
        if (/[TRD]-\d{2}/i.test(token) || /\d/.test(token)) {
          if (!reqFold.includes(token.toLowerCase()) && !reqFold.includes(token.replace(/,/g, ""))) {
            // Soft: evidence may be longer window — only flag when token looks like an ID/ref
            if (/^[TRD]-\d{2}$/i.test(token)) {
              out.push(
                failure({
                  validationCode: "REQUIREMENT_TRUNCATED",
                  severity: "HIGH",
                  check: "requirement-completeness",
                  explanation: `Requirement ID/token "${token}" present in evidence but missing from requirement text.`,
                  affectedCanonicalItemId: req.id,
                  sourceProvenance: req.sourceSection ?? null,
                }),
              );
            }
          }
        }
      }
    }
  }

  return out;
}
