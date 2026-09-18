export {
  GUARDIAN_VALIDATION_CODES,
  BLOCKING_SEVERITIES,
  type GuardianValidationCode,
  type GuardianSeverity,
} from "./codes";

export {
  DecisionGuardianError,
  type GuardianValidationFailure,
  type DecisionGuardianInput,
  type DecisionGuardianResult,
  type GuardianDocumentInput,
  type GuardianRequirementInput,
  type GuardianActionInput,
  type GuardianDecisionInput,
  type GuardianDeadlineInput,
  type GuardianFitInput,
  type GuardianCountsInput,
  type GuardianStaleResultInput,
  type GuardianExternalClaim,
  type GuardianSourceContradiction,
  type GuardianRiskInput,
  type GuardianDerivedDeadlineInput,
  type GuardianAiClaimInput,
} from "./types";

export { runDecisionGuardian, assertDecisionGuardianReady } from "./guardian";
export {
  buildDecisionGuardianInput,
  hashCanonicalRequirementSet,
  hashCanonicalReleasePayload,
  type BuildGuardianInputArgs,
} from "./build-input";

export {
  extractHighRiskFactTokens,
  missingHighRiskTokens,
  createFactTokenCache,
  type HighRiskFactKind,
  type HighRiskFactToken,
} from "./high-risk-facts";

export type { GuardianSourceTier } from "./source-hierarchy";

export { detectCanonicalSourceConflicts } from "./checks/conflicts";

export {
  assertFinalReleaseIntegrity,
  FINAL_CHECKLIST,
  type FinalReleaseIntegrityResult,
} from "./final-integrity";

export {
  assertReportPublicationAllowed,
  type ReportPublicationInput,
} from "./release-gate";

export {
  isDecisionGuardianSnapshot,
  type DecisionGuardianSnapshot,
} from "./snapshot";

export {
  REGRESSION_MEMORY,
  REGRESSION_CATEGORIES,
  assertRegressionMemoryCoverage,
  regressionMemoryByCategory,
  type RegressionCategory,
  type RegressionMemoryEntry,
} from "./regression-memory";

export {
  buildTestGuardianSnapshot,
  stampTestGuardianSnapshot,
} from "./test-stamp";
