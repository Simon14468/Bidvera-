export * from "./types";
export {
  scanTenderContentForInjection,
  classifyInstructionLikeSegment,
  isLegitimateTenderObligation,
  assertNoSystemOverrideInStructuredText,
  getSystemOverridePatternsForTests,
  SYSTEM_OVERRIDE_PATTERNS,
  LEGITIMATE_TENDER_OBLIGATION_PATTERNS,
} from "./injection";
export {
  wrapAuthoritativeTenderDataChunks,
  wrapAuthoritativeTenderDataForAi,
  wrapTenderDerivedFieldForAi,
  wrapUntrustedTenderContent,
} from "./wrap";
export {
  assertTrustSourceSeparation,
  rejectClientProvidedDecision,
  assertTenderContentCannotMutateControlPlane,
  isControlPlaneField,
} from "./boundaries";
export {
  assertNoFabricatedProvenance,
  sanitizeExtractedPage,
  validateExtractedPage,
  buildPageContextFromExtractMeta,
  sanitizeRequirementProvenance,
  sanitizeAiExtractionDrafts,
  type PageValidationContext,
} from "./provenance-guard";
export {
  buildPipelineTrustSnapshot,
  trustAnomalyNote,
} from "./pipeline";
export {
  rejectClientProvidedCanonicalField,
  assertTenantResourceScope,
  listClientCanonicalFields,
  type ClientCanonicalField,
} from "./client-guard";
export {
  assertAiAssistReadOnly,
  trustLabelForSourceBasis,
  assertAiCannotPerform,
  AI_ASSIST_FORBIDDEN_ACTIONS,
  type AiAssistForbiddenAction,
} from "./ai-output";
export {
  AI_TRUST_PIPELINE_INVARIANTS,
  assertPipelineTrustSnapshotIntegrity,
} from "./invariants";
