/**
 * Conditional obligation context — preserve trigger text through the canonical pipeline.
 * Never invent CONDITIONAL without a trigger; never silently promote CONDITIONAL → MANDATORY
 * when trigger context was lost.
 */

import {
  hasConditionalTriggerContext,
  type ObligationStrength,
} from "./semantic-kind";
import type { NormalizedRequirement } from "./types";

export { hasConditionalTriggerContext };

/** Prefer the variant that still carries conditional trigger context. */
export function pickTextPreservingConditionalContext(a: string, b: string): string {
  const aHas = hasConditionalTriggerContext(a);
  const bHas = hasConditionalTriggerContext(b);
  if (aHas && !bHas) return a;
  if (bHas && !aHas) return b;
  return a.length >= b.length ? a : b;
}

/**
 * When merging duplicates, never let an unconditional paraphrase erase a real conditional.
 */
export function preferObligationStrengthPreservingConditionality(
  a: ObligationStrength,
  b: ObligationStrength,
  aText: string,
  bText: string,
): ObligationStrength {
  const aCond = a === "CONDITIONAL" && hasConditionalTriggerContext(aText);
  const bCond = b === "CONDITIONAL" && hasConditionalTriggerContext(bText);
  if (aCond || bCond) return "CONDITIONAL";

  const rank: Record<ObligationStrength, number> = {
    MANDATORY: 4,
    CONDITIONAL: 3,
    OPTIONAL: 2,
    INFORMATIONAL: 1,
  };
  return rank[a] >= rank[b] ? a : b;
}

/**
 * After normalize/dedupe/rehydrate: ensure CONDITIONAL rows still have trigger context.
 * Recover from evidence when possible; otherwise fail safe as NEEDS_VERIFICATION
 * (UNCERTAIN / non-mandatory) — never crash and never invent a hard MANDATORY.
 */
export function reconcileConditionalObligation(
  item: NormalizedRequirement,
): NormalizedRequirement {
  if (item.obligationStrength !== "CONDITIONAL") {
    return item;
  }

  let requirement = item.requirement;
  const evidence = (item.evidenceText ?? item.evidence ?? "").replace(/\s+/g, " ").trim();

  if (!hasConditionalTriggerContext(requirement)) {
    if (hasConditionalTriggerContext(evidence)) {
      requirement = pickTextPreservingConditionalContext(requirement, evidence);
    }
  }

  if (hasConditionalTriggerContext(requirement)) {
    return {
      ...item,
      requirement,
      mandatory: false,
      obligationStrength: "CONDITIONAL",
      evidenceText: item.evidenceText ?? (evidence || null),
      evidence: item.evidence ?? (evidence || null),
    };
  }

  // Trigger context genuinely unavailable — do not keep orphan CONDITIONAL,
  // and do not silently convert to MANDATORY/OPTIONAL.
  return {
    ...item,
    requirement,
    obligationStrength: "INFORMATIONAL",
    mandatory: false,
    confidence: "UNCERTAIN",
    verificationStatus: "UNKNOWN",
    verificationReason:
      item.verificationReason ??
      "Conditional trigger context unavailable — needs verification",
  };
}

export function reconcileConditionalObligations(
  items: NormalizedRequirement[],
): NormalizedRequirement[] {
  return items.map(reconcileConditionalObligation);
}
