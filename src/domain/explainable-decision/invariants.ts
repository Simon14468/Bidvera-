/**
 * Explainable Decision integrity checks.
 */

import { toTenderDecisionLabel } from "@/domain/decision/labels";
import type { ExplainableDecision } from "./types";

export const EXPLAINABLE_DECISION_INVARIANTS = {
  readOnly: true,
  autoVerify: false,
  mutatesDecision: false,
  memoryInfluencesDecision: false,
} as const;

export function assertExplainableDecisionIntegrity(
  explanation: ExplainableDecision,
): void {
  if (explanation.displayLabel !== toTenderDecisionLabel(explanation.decision)) {
    throw new Error("Explainable decision label mismatch with storage enum.");
  }

  for (const item of explanation.items) {
    if (item.category === "HISTORICAL_SIGNAL" && !item.referenceOnly) {
      throw new Error("Historical signals must be referenceOnly.");
    }
    if (item.category === "HISTORICAL_SIGNAL" && item.impactRole !== "CONTEXT_ONLY") {
      throw new Error("Historical signals must be CONTEXT_ONLY impact.");
    }
    if (
      item.source.located &&
      item.source.page != null &&
      !Number.isFinite(item.source.page)
    ) {
      throw new Error("Invalid page number in source reference.");
    }
  }
}

export function assertExplainableDecisionReadOnly(context: string): void {
  if (!EXPLAINABLE_DECISION_INVARIANTS.readOnly) {
    throw new Error(`Explainable Decision must remain read-only (${context}).`);
  }
}
