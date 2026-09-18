export type * from "./types";
export { EMPTY_LEARNING_SIGNAL, EMPTY_COMPANY_HISTORY_SIGNAL, LEARNING_MIN_COHORT } from "./types";
export {
  extractLearningFeatures,
  featureKeyFrom,
  privacyFilterFeatures,
} from "./features";
export {
  buildLearningSignal,
  isPatternValidated,
  similarityScore,
} from "./similarity";
export type { PatternCandidate } from "./similarity";
export {
  applyDecisionPriorityGate,
  canLifecycleInfluence,
  computeConsistencyScore,
  computeDataQualityScore,
  evaluatePatternLifecycle,
} from "./validation";
