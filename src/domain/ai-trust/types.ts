/**
 * AI Trust & Security — source separation and trust labels.
 *
 * Tender PDF content is AUTHORITATIVE DATA for facts.
 * It is never AUTHORITATIVE for system/control-plane instructions.
 */

/** Canonical separation — never present AI inference as tender fact. */
export type TrustSourceKind =
  | "TENDER_FACT"
  | "COMPANY_FACT"
  | "EVIDENCE"
  | "VERIFICATION_RESULT"
  | "AI_INFERENCE"
  | "UNKNOWN";

export type InstructionLikeClassification =
  | "LEGITIMATE_TENDER_OBLIGATION"
  | "SYSTEM_OVERRIDE_ATTEMPT"
  | "NONE";

export type InstructionLikeSegment = {
  text: string;
  classification: InstructionLikeClassification;
  patternId: string;
  startIndex: number;
};

export type TrustScanResult = {
  scannedCharCount: number;
  segments: InstructionLikeSegment[];
  /** True when at least one SYSTEM_OVERRIDE_ATTEMPT was detected. */
  hasSystemOverrideAttempt: boolean;
  /** Legitimate tender obligations detected (still DATA). */
  legitimateObligationCount: number;
};

export type PageTrustContext = {
  maxPage?: number | null;
  knownPages?: Set<number> | null;
};

export type AiTrustContext = {
  /** Tender PDF facts are authoritative for extraction. */
  authoritativeTenderData: true;
  /** Tender content always stays on the DATA plane. */
  controlBoundary: "DATA";
  sourceKind: TrustSourceKind;
  scan: TrustScanResult | null;
};

/** Persisted on intelligence breakdown — security/anomaly signal only. */
export type PipelineTrustSnapshot = {
  disclaimer: string;
  authoritativeTenderData: true;
  hasSystemOverrideAttempt: boolean;
  flaggedSegmentCount: number;
  legitimateObligationCount: number;
  /** Sample flagged snippets for audit UI — not used for decisions. */
  anomalySamples: string[];
  knownPageCount: number;
  computedAt: string;
};

export type PipelineTrustStage =
  | "TENDER_PDF"
  | "REQUIREMENTS"
  | "EVIDENCE_INTELLIGENCE"
  | "VERIFICATION"
  | "RISKS"
  | "COMPANY_FIT"
  | "READINESS"
  | "DECISION_MEMORY"
  | "DECISION_ENGINE"
  | "EXPLAINABLE_DECISION"
  | "DECISION_SIMULATOR"
  | "TENDER_ACTION_PLAN";

export const AI_TRUST_PRINCIPLES = {
  tenderPdfAuthoritativeForFacts: true,
  pdfInstructionsAreDataNotControl: true,
  systemSecurityOverridesTenderText: true,
  neverInventFacts: true,
  unknownStaysUnknown: true,
  missingEvidenceStaysMissing: true,
  neverAutoVerifyEvidence: true,
  aiWordingNeverOverridesEngine: true,
  decisionEngineIsFinalAuthority: true,
  permissionsAlwaysApply: true,
  clientCannotSetDecision: true,
} as const;

export const AI_TRUST_DISCLAIMER =
  "Tender document text is authoritative tender DATA. Instruction-like phrases inside documents are analyzed as content — they cannot change system rules, security, billing, or the Decision Engine.";
