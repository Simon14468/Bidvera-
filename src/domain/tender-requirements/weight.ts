import { CATEGORY_DECISION_WEIGHT, isRequirementCategory, isScoringCategory } from "./types";
import type { RequirementCategory } from "./types";

type Status = "MATCHED" | "FAILED" | "UNCERTAIN" | "MISSING";

const STATUS_WEIGHT: Record<Status, number> = {
  MATCHED: 1,
  UNCERTAIN: 0.45,
  MISSING: 0.2,
  FAILED: 0,
};

/**
 * Weighted requirement compliance score (0–100).
 * Mandatory eligibility/technical weigh more than preferred/contractual.
 * INFORMATIONAL items are ignored.
 */
export function weightedRequirementsScore(
  requirements: Array<{ category: string; mandatory: boolean; status: Status }>,
): number {
  const scored = requirements.filter((r) => isScoringCategory(r.category));
  if (scored.length === 0) return 50;

  let weightedSum = 0;
  let weightTotal = 0;
  for (const r of scored) {
    const cat: RequirementCategory = isRequirementCategory(r.category)
      ? r.category
      : r.mandatory
        ? "MANDATORY_TECHNICAL"
        : "PREFERRED";
    const w = CATEGORY_DECISION_WEIGHT[cat];
    if (w <= 0) continue;
    weightedSum += STATUS_WEIGHT[r.status] * w;
    weightTotal += w;
  }
  if (weightTotal <= 0) return 50;
  return Math.round((weightedSum / weightTotal) * 100);
}

export function categoryDecisionWeight(category: string, mandatory: boolean): number {
  if (isRequirementCategory(category)) return CATEGORY_DECISION_WEIGHT[category];
  if (mandatory) return CATEGORY_DECISION_WEIGHT.MANDATORY_TECHNICAL;
  return CATEGORY_DECISION_WEIGHT.PREFERRED;
}
