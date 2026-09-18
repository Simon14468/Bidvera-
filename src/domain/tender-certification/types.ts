/**
 * Phase 4 — Universal Tender Certification Engine
 * Final internal firewall before analysisStatus becomes COMPLETED.
 * Composes Phase-3 integrity; does not redesign Decision/Risk/Guardian/UI.
 */

export const TENDER_CERTIFICATION_VERSION = "tender-certification/v1" as const;

export const CERTIFICATION_STATUSES = [
  "CERTIFIED",
  "CERTIFIED_WITH_WARNINGS",
  "REVIEW_REQUIRED",
  "CERTIFICATION_FAILED",
] as const;

export type CertificationStatus = (typeof CERTIFICATION_STATUSES)[number];

export const PACKAGE_READABILITY = [
  "READABLE",
  "PARTIALLY_READABLE",
  "UNREADABLE",
  "INCOMPLETE",
] as const;

export type PackageReadability = (typeof PACKAGE_READABILITY)[number];

/** Stable machine-readable certification failure / finding codes. */
export const CERTIFICATION_CODES = [
  "PACKAGE_INCOMPLETE",
  "DOCUMENT_UNREADABLE",
  "EXTRACTION_INCOMPLETE",
  "REQUIREMENT_FRAGMENT",
  "REQUIREMENT_ACTOR_UNKNOWN",
  "REQUIREMENT_SEMANTIC_INVALID",
  "REQUIREMENT_DUPLICATE",
  "REQUIREMENT_HEADING",
  "REQUIREMENT_NON_OBLIGATION",
  "PROVENANCE_MISSING",
  "EVIDENCE_INVALID",
  "FIT_INCONSISTENT",
  "FIT_MISSING",
  "RISK_ORPHAN",
  "RISK_DUPLICATE",
  "RISK_NA",
  "ACTION_ORPHAN",
  "ACTION_TEXT_MISMATCH",
  "COUNT_MISMATCH",
  "METADATA_CONFLICT",
  "SNAPSHOT_MISMATCH",
  "DECISION_INPUT_MISMATCH",
  "VERSION_CONFLICT",
  "INTEGRITY_FAILED",
  "GUARDIAN_MISSING",
  "CERTIFICATION_ANOMALY",
] as const;

export type CertificationCode = (typeof CERTIFICATION_CODES)[number];

export type CertificationSeverity = "CRITICAL" | "HIGH" | "WARNING" | "INFO";

export type CertificationFinding = {
  code: CertificationCode;
  severity: CertificationSeverity;
  category:
    | "PACKAGE"
    | "EXTRACTION"
    | "SEMANTIC"
    | "REQUIREMENT"
    | "EVIDENCE"
    | "FIT"
    | "RISK"
    | "READINESS"
    | "ACTION"
    | "METADATA"
    | "DECISION"
    | "SNAPSHOT"
    | "QUALITY"
    | "CROSS_DOCUMENT";
  message: string;
  requirementId?: string | null;
};

export type CertificationCheckRecord = {
  name: string;
  passed: boolean;
  durationMs: number;
};

export type TenderCertificationResult = {
  version: typeof TENDER_CERTIFICATION_VERSION;
  status: CertificationStatus;
  certifiedAt: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  tenderId: string;
  packageLabel: string;
  packageReadability: PackageReadability;
  checksExecuted: string[];
  checksPassed: string[];
  checks: CertificationCheckRecord[];
  findings: CertificationFinding[];
  warnings: CertificationFinding[];
  failures: CertificationFinding[];
  integrityVersion: string | null;
  snapshotFrozenAt: string | null;
  counts: {
    totalRequirements: number;
    verified: number;
    needsVerification: number;
    confirmedGaps: number;
    notApplicable: number;
    partitionValid: boolean;
  };
};

export type CertificationRequirementRow = {
  id: string | null;
  requirement: string;
  semanticKind?: string | null;
  obligationStrength?: string | null;
  lotApplicability?: string | null;
  sourceDocument?: string | null;
  sourceSection?: string | null;
  page?: number | null;
  evidenceText?: string | null;
};

export type CertificationFitRow = {
  requirementId: string | null;
  fitStatus: string | null;
  companyEvidence: string | null;
  tenderEvidence?: string | null;
  conditionText?: string | null;
  lotLabel?: string | null;
  obligationStrength?: string | null;
  semanticKind?: string | null;
};

export type CertificationRiskRow = {
  id?: string | null;
  requirementId?: string | null;
  linkedRequirementIds?: string[] | null;
  title?: string | null;
  underlyingKey?: string | null;
  evidenceState?: string | null;
  fitStatus?: string | null;
  severity?: string | null;
};

export type CertificationActionRow = {
  linkedRequirementId?: string | null;
  requirementText?: string | null;
  title?: string | null;
};

export type CertificationPackageFile = {
  fileName: string;
  processingStatus: string;
  role: string | null;
  error: string | null;
};

export type CertifyAnalysisInput = {
  tenderId: string;
  packageLabel: string;
  snapshot: {
    version: string;
    frozenAt: string;
    tenderId: string;
    package: {
      discoveredFileCount: number;
      label: string;
      files: CertificationPackageFile[];
    };
    metadata: {
      title: string | null;
      client: string | null;
      deadlineIso: string | null;
      deadlineTimezone: string | null;
      factsNote: string | null;
      metadataStatus: "OK" | "UNKNOWN" | "CONFLICT" | "INCOMPLETE" | null;
    };
    requirementIds: string[];
    counts: {
      totalRequirements: number;
      verifiedRequirements: number;
      needsVerification: number;
      confirmedGaps: number;
      notApplicable: number;
    };
  };
  integrity: {
    version: string;
    partitionValid: boolean;
    counts: {
      totalRequirements: number;
      verified: number;
      needsVerification: number;
      confirmedGaps: number;
      notApplicable: number;
    };
    checksPassed: string[];
  } | null;
  guardianOk: boolean;
  canonicalRequirements: CertificationRequirementRow[];
  fitRows: CertificationFitRow[];
  risks: CertificationRiskRow[];
  actions: CertificationActionRow[];
  matrixRequirementIds: string[];
  decisionRequirementIds: string[];
  decisionLabel: string | null;
  utiSummary?: {
    inventoryCount?: number;
    extractedOkCount?: number;
    failedCount?: number;
    versionEdges?: number;
    metadataConflicts?: unknown[];
  } | null;
  /**
   * Intake stored membership = proceedable canonical identities
   * (from files[] / intakeStoredMemberCount — never legacy accepted+recoverable sum).
   * When set, must equal UTI inventory and snapshot discovered count.
   */
  intakeStoredCount?: number | null;
};
