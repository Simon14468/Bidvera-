/**
 * Read-only outcome intelligence for optional Decision Engine context.
 * Never mutates scores — explicit, deterministic contract for future integration.
 */

import type {
  OutcomeLearningInsightsBundle,
  OutcomeLearningStatistics,
} from "@/domain/decision-outcome-learning";

export type OutcomeEngineContextSignal = {
  /** Hard guard — consumers must not apply silently */
  referenceOnly: true;
  /** Coarse statistics from verified stored outcomes only */
  statistics: OutcomeLearningStatistics | null;
  /** Number of similar tenders with traceable patterns surfaced */
  similarPatternCount: number;
  /** Human-readable recurring themes — each tied to recorded data */
  recurringLossReasons: string[];
  recurringSuccessPatterns: string[];
  disclaimer: string;
};

/**
 * Map advisory outcome learning bundle to a deterministic engine-context payload.
 * The Decision Engine must NOT import this unless explicitly wired — display/advisory only today.
 */
export function toOutcomeEngineContext(
  bundle: OutcomeLearningInsightsBundle,
): OutcomeEngineContextSignal {
  return {
    referenceOnly: true,
    statistics: bundle.statistics,
    similarPatternCount: bundle.similarOutcomes.length,
    recurringLossReasons: bundle.recurringLossReasons,
    recurringSuccessPatterns: bundle.recurringSuccessPatterns,
    disclaimer: bundle.disclaimer,
  };
}
