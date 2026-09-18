/**
 * Extends Decision Memory insights with recorded outcomes — display only.
 * Does not change ranking, similarity, or scoring.
 */

import {
  OUTCOME_LABELS,
  evaluateRecommendationAlignment,
  formatOutcomeTraceNote,
  lifecycleBucket,
  type DecisionOutcomeValue,
} from "@/domain/decision-outcome-learning";
import type { DecisionMemoryInsight, DecisionMemoryInsightsBundle } from "@/domain/decision-memory";
import type { TenderDecisionOutcome } from "@prisma/client";

export function enrichDecisionMemoryWithOutcomes(input: {
  bundle: DecisionMemoryInsightsBundle;
  outcomesByTenderId: Map<string, TenderDecisionOutcome>;
}): DecisionMemoryInsightsBundle {
  const matches: DecisionMemoryInsight[] = input.bundle.matches.map((m) => {
    const row = input.outcomesByTenderId.get(m.tenderId);
    if (!row) return m;

    const outcome = lifecycleBucket(row.outcome as DecisionOutcomeValue);
    const recommendationEvaluation = evaluateRecommendationAlignment({
      decisionAtAnalysis: m.decision,
      outcome,
    });

    return {
      ...m,
      recordedOutcome: outcome,
      outcomeLabel: OUTCOME_LABELS[outcome] ?? outcome,
      outcomeDate: row.outcomeDate?.toISOString() ?? null,
      outcomeReasonSummary: row.reasonDetail ?? row.reasonCode ?? null,
      recommendationEvaluation,
      decisionSuccess:
        recommendationEvaluation === "SUCCESSFUL"
          ? "successful"
          : recommendationEvaluation === "UNSUCCESSFUL"
            ? "unsuccessful"
            : outcome === "PENDING"
              ? "pending"
              : "neutral",
      outcomeTraceNote: formatOutcomeTraceNote(m.title),
    };
  });

  return { ...input.bundle, matches };
}
