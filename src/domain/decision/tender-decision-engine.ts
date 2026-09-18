/**
 * Production Tender Decision Engine facade.
 *
 * Combines the deterministic rule/fit engine with an explainable recommendation
 * built from requirements, risks, readiness, compliance, deadlines, and evidence.
 * Decision Memory informs factors only — never overrides current tender evidence.
 *
 * Fit / readiness / Bid Score formulas are NOT modified here.
 */

import { runDecisionEngine } from "@/domain/decision/engine";
import {
  assertRecommendationConsistency,
  buildTenderDecisionRecommendation,
  type FinalizeDecisionInput,
  type TenderDecisionRecommendation,
} from "@/domain/decision/recommendation";
import type {
  DecisionEngineInput,
  DecisionEngineOutput,
} from "@/domain/decision/types";
import { toTenderDecisionLabel } from "@/domain/decision/labels";

export type TenderDecisionEngineResult = DecisionEngineOutput & {
  recommendation: TenderDecisionRecommendation;
  /** Product label — always GO | CONDITIONAL GO | NO-BID */
  displayLabel: ReturnType<typeof toTenderDecisionLabel>;
};

/**
 * Stage 1: core rule/fit/AI blend (unchanged formulas).
 */
export function runCoreDecisionEngine(
  input: DecisionEngineInput,
): DecisionEngineOutput {
  return runDecisionEngine(input);
}

/**
 * Stage 2: finalize with readiness/compliance/deadline/risks/Memory evidence.
 * May only downgrade GO→CONDITIONAL GO (BID→REVIEW); never invents; Memory never flips decision.
 */
export function finalizeTenderDecision(
  input: FinalizeDecisionInput,
): TenderDecisionEngineResult {
  const recommendation = buildTenderDecisionRecommendation(input);
  assertRecommendationConsistency(recommendation);

  const engine = input.engine;
  const decision = recommendation.decision;
  const confidence = recommendation.confidence;

  // Keep fit breakdown overall locked to engine fitScore (already canonical)
  return {
    ...engine,
    decision,
    confidence,
    reasoning: [
      recommendation.summary,
      "",
      engine.reasoning,
    ]
      .filter(Boolean)
      .join("\n"),
    recommendation,
    displayLabel: recommendation.displayLabel,
  };
}

/**
 * Full path when all evidence is available in one shot (tests / tooling).
 */
export function runTenderDecisionEngine(
  coreInput: DecisionEngineInput,
  evidence: Omit<FinalizeDecisionInput, "engine" | "aiParticipated"> & {
    aiParticipated?: boolean;
  } = {},
): TenderDecisionEngineResult {
  const engine = runCoreDecisionEngine(coreInput);
  return finalizeTenderDecision({
    engine,
    aiParticipated: evidence.aiParticipated ?? Boolean(coreInput.ai),
    readiness: evidence.readiness,
    compliance: evidence.compliance,
    keyBlockers: evidence.keyBlockers,
    structuredRiskTitles: evidence.structuredRiskTitles,
    deadline: evidence.deadline,
    asOf: evidence.asOf,
    memoryInsights: evidence.memoryInsights,
  });
}

export {
  buildTenderDecisionRecommendation,
  refineDecisionWithEvidence,
  assertRecommendationConsistency,
} from "@/domain/decision/recommendation";
export type { TenderDecisionRecommendation, FinalizeDecisionInput } from "@/domain/decision/recommendation";
export { toTenderDecisionLabel, localizeTenderDecisionLabel } from "@/domain/decision/labels";
export {
  assertDecisionIntegrity,
  resolveCanonicalDecision,
  collectMaterialHardBlockers,
} from "@/domain/decision/decision-integrity";
export type {
  DecisionBlocker,
  DecisionExplainabilityInputs,
} from "@/domain/decision/decision-integrity";
