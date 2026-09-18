/**
 * Decision Validation Guardian — types.
 * Structured fail-closed results; never silently repair source data.
 */

import type { GuardianSeverity, GuardianValidationCode } from "./codes";
import type {
  GuardianAiClaimInput,
  GuardianDerivedDeadlineInput,
  GuardianExternalClaim,
  GuardianRiskInput,
  GuardianSourceContradiction,
} from "./source-hierarchy";

export type GuardianValidationFailure = {
  validationCode: GuardianValidationCode;
  severity: GuardianSeverity;
  explanation: string;
  affectedCanonicalItemId: string | null;
  sourceProvenance: string | null;
  check: string;
};

export type GuardianDocumentInput = {
  textLength: number;
  readable: boolean;
  validityPassed: boolean;
  validityReason?: string | null;
  fileName?: string | null;
};

export type GuardianRequirementInput = {
  id: string;
  requirement: string;
  category: string;
  semanticKind: string;
  obligationStrength: string;
  mandatory: boolean;
  sourceSection?: string | null;
  page?: number | null;
  evidenceText?: string | null;
  value?: string | null;
  fitStatus?: string | null;
  companyEvidenceText?: string | null;
  hasCompanyEvidence?: boolean;
  lotApplicability?: string | null;
  stiConditionText?: string | null;
  stiProcurementPhase?: string | null;
  stiActor?: string | null;
  versionLabel?: string | null;
};

export type GuardianActionInput = {
  linkedRequirementId: string | null;
  blocking: boolean;
  sourceType: string;
  title: string;
  simulationOnly?: boolean;
};

export type GuardianDecisionInput = {
  decision: string;
  hardFailure?: boolean;
  hardBlockerCount: number;
  keyBlockerIds?: string[];
  aiSuggestedDecision?: string | null;
  aiOverrodeCanonical?: boolean;
};

export type GuardianDeadlineInput = {
  deadlineIso: string | null;
  deadlineTimezone: string | null;
  expectedLocalHour?: number | null;
  expectedLocalMinute?: number | null;
  expectedDateYmd?: string | null;
  sourceEvidence?: string | null;
};

export type GuardianFitInput = {
  fitScore: number | null;
  fitBreakdownOverall: number | null;
  reasoning?: string | null;
};

export type GuardianCountsInput = {
  canonicalRequirementCount: number;
  matrixCount: number;
  readinessCount: number;
  complianceSummaryTotal: number | null;
  actionLinkedIdentityCount?: number | null;
};

export type GuardianStaleResultInput = {
  canonicalContentHash: string;
  projectedContentHash: string;
  analyzedAt?: string | null;
  projectedAnalyzedAt?: string | null;
};

export type DecisionGuardianInput = {
  document: GuardianDocumentInput;
  requirements: GuardianRequirementInput[];
  resolvedRequirementIds?: string[];
  matrixRequirementIds?: string[];
  readinessRequirementIds?: string[];
  actions?: GuardianActionInput[] | null;
  decision?: GuardianDecisionInput | null;
  deadline?: GuardianDeadlineInput | null;
  fit?: GuardianFitInput | null;
  counts?: GuardianCountsInput | null;
  requireDocumentValidity?: boolean;
  tenderSourceText?: string | null;
  risks?: GuardianRiskInput[] | null;
  externalClaims?: GuardianExternalClaim[] | null;
  contradictions?: GuardianSourceContradiction[] | null;
  derivedDeadline?: GuardianDerivedDeadlineInput | null;
  aiClaims?: GuardianAiClaimInput[] | null;
  staleResult?: GuardianStaleResultInput | null;
  expectedCommercialCues?: string[] | null;
};

export type DecisionGuardianResult = {
  ok: boolean;
  failures: GuardianValidationFailure[];
  blockingFailures: GuardianValidationFailure[];
  advisoryFailures: GuardianValidationFailure[];
  contradictions: GuardianSourceContradiction[];
  validatedAt: string;
  durationMs: number;
  checksRun: string[];
};

export class DecisionGuardianError extends Error {
  readonly result: DecisionGuardianResult;
  readonly code = "DECISION_GUARDIAN_FAILED" as const;

  constructor(result: DecisionGuardianResult) {
    const first = result.blockingFailures[0];
    super(
      first
        ? `Decision Guardian blocked release: [${first.validationCode}] ${first.explanation}`
        : "Decision Guardian blocked release",
    );
    this.name = "DecisionGuardianError";
    this.result = result;
  }
}

export type {
  GuardianExternalClaim,
  GuardianSourceContradiction,
  GuardianRiskInput,
  GuardianDerivedDeadlineInput,
  GuardianAiClaimInput,
};
