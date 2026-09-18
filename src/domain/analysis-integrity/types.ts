/**
 * Phase 3 — Universal Evidence & Consistency Integrity contracts.
 * Authoritative integrity layer AFTER canonical requirements and BEFORE COMPLETE.
 * Does not redesign Decision / Risk / Guardian / UI.
 */

import type { CanonicalAnalysisSnapshot } from "@/domain/tender-intelligence/canonical-snapshot";
import type { CanonicalRequirementMetrics } from "@/domain/tender-intelligence/canonical-snapshot";

export const ANALYSIS_INTEGRITY_VERSION = "analysis-integrity/v1" as const;

export type AnalysisCountPartition = CanonicalRequirementMetrics & {
  /** Alias: verifiedRequirements */
  verified: number;
};

export type AnalysisIntegrityAttestation = {
  version: typeof ANALYSIS_INTEGRITY_VERSION;
  frozenAt: string;
  tenderId: string;
  /** Digest of the frozen canonical snapshot. */
  snapshotFrozenAt: string;
  counts: AnalysisCountPartition;
  /** Partition: total = verified + needsVerification + confirmedGaps + notApplicable */
  partitionValid: boolean;
  checksPassed: string[];
  package: {
    discoveredFileCount: number;
    failedOrUnreadableCount: number;
    explicitFailures: Array<{ fileName: string; error: string | null }>;
  };
  linkage: {
    requirementIds: string[];
    riskRequirementIds: string[];
    actionRequirementIds: string[];
    orphanRisks: number;
    orphanActions: number;
  };
  evidenceRules: {
    confirmedGapWithoutCompanyEvidence: number;
    confirmedFitWithoutCompanyEvidence: number;
  };
  metadata: {
    status: "OK" | "UNKNOWN" | "CONFLICT" | "INCOMPLETE" | null;
    hasProvenanceNote: boolean;
  };
};

export type UniversalAnalysisIntegrityInput = {
  snapshot: CanonicalAnalysisSnapshot;
  canonicalRequirementCount: number;
  requirementIds: string[];
  requirementTexts: string[];
  /** Fit rows aligned to canonical requirements. */
  fitRows: Array<{
    requirementId: string | null;
    fitStatus: string | null;
    companyEvidence: string | null;
    tenderEvidence?: string | null;
    conditionText?: string | null;
    lotLabel?: string | null;
    obligationStrength?: string | null;
    semanticKind?: string | null;
  }>;
  risks: Array<{
    id?: string | null;
    requirementId?: string | null;
    linkedRequirementIds?: string[] | null;
    title?: string | null;
    underlyingKey?: string | null;
    evidenceState?: string | null;
    fitStatus?: string | null;
  }>;
  actions: Array<{
    linkedRequirementId?: string | null;
    requirementText?: string | null;
    title?: string | null;
  }>;
  matrixRequirementIds: string[];
  summary: {
    totalRequirements: number;
    ready: number;
    missing: number;
    verify: number;
    unknown: number;
    notApplicable: number;
  };
  readinessTotal: number | null;
  metadataStatus?: "OK" | "UNKNOWN" | "CONFLICT" | "INCOMPLETE" | null;
  metadataFactsNote?: string | null;
};
