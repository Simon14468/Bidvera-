export * from "./types";
export {
  buildExplainableDecision,
  type BuildExplainableDecisionInput,
} from "./build";
export {
  sourceFromComplianceRow,
  sourceFromEngine,
  sourceFromMemory,
  whyFromReason,
  stableItemId,
} from "./traceability";
export {
  assertDecisionExplanationConsistency,
  DecisionExplanationMismatchError,
} from "./consistency";
export {
  enrichExplainableDecision,
  type ExplainableDecisionView,
  type ExplainableTeamWorkflowLink,
  type TeamWorkflowTaskInput,
} from "./enrich";
export {
  buildTopReasons,
  evidenceStateExplainLabel,
  formatSourceLine,
  sectionDetailRows,
  type ExplainableTopReason,
} from "./presentation";
export {
  assertExplainableDecisionIntegrity,
  assertExplainableDecisionReadOnly,
  EXPLAINABLE_DECISION_INVARIANTS,
} from "./invariants";
