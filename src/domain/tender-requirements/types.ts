import type { ObligationStrength, RequirementSemanticKind } from "./semantic-kind";

/**
 * Canonical tender requirement classification used for matching and scoring.
 * Stored in TenderRequirement.category.
 */
export const REQUIREMENT_CATEGORIES = [
  "MANDATORY_ELIGIBILITY",
  "MANDATORY_TECHNICAL",
  "MANDATORY_ADMINISTRATIVE",
  "CONTRACTUAL",
  "EVALUATION",
  "PREFERRED",
  "INFORMATIONAL",
] as const;

export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export type RequirementConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNCERTAIN";

export type NormalizedRequirement = {
  id?: string;
  category: RequirementCategory;
  /** Canonical semantic kind — authoritative for downstream intelligence. */
  semanticKind: RequirementSemanticKind;
  /** Document-stated obligation strength (mandatory / conditional / optional / informational). */
  obligationStrength: ObligationStrength;
  title: string;
  requirement: string;
  mandatory: boolean;
  confidence: RequirementConfidence;
  status?: "MATCHED" | "FAILED" | "UNCERTAIN" | "MISSING";
  evidence?: string | null;
  sourceDocument?: string | null;
  /** All package files that stated this obligation after semantic merge. */
  sourceDocuments?: string[];
  page?: number | null;
  /** All located pages when obligations were merged from duplicates. */
  sourcePages?: number[];
  verificationReason?: string | null;
  /** Optional extracted value (e.g. cert name) */
  value?: string | null;
  sourceSection?: string | null;
  sourceCell?: string | null;
  columnHeader?: string | null;
  rowLabel?: string | null;
  versionLabel?: string | null;
  locator?: string | null;
  sourceCompleteness?: "COMPLETE" | "TRUNCATED" | "PARTIAL" | "UNREADABLE" | null;
  evidenceText?: string | null;
  verificationStatus?: "UNKNOWN" | "VERIFIED" | "INFERRED";
  /**
   * Lot applicability encoded for intelligence (also mirrored into sourceSection
   * as `[LOT_1]` / `[ALL_LOTS]` for persistence without a schema migration).
   */
  lotApplicability?: string | null;
  /** STI semantic contract — present when requirement entered via STI gate. */
  stiActor?: string | null;
  stiRecipient?: string | null;
  stiClauseRole?: string | null;
  stiClausePurpose?: string | null;
  stiDocumentRole?: string | null;
  stiSectionRole?: string | null;
  stiProcurementPhase?: string | null;
  stiApplicability?: string | null;
  stiTemplateStatus?: string | null;
  stiConditionText?: string | null;
  /** Structured conditionality JSON-friendly snapshot. */
  stiConditionality?: {
    applicability: string;
    conditionText: string | null;
    actionText: string | null;
    thresholdText: string | null;
    exceptionText: string | null;
    timeframeText: string | null;
    scopeText: string | null;
    unresolved: boolean;
  } | null;
  stiConfidence?: number | null;
  /** Exact STI provenance links (document / page / section / locator). */
  stiProvenance?: Array<{
    sourceDocument: string | null;
    sourcePage: number | null;
    sourceSection: string | null;
    sourceCell: string | null;
    versionLabel: string | null;
    locator?: string | null;
  }> | null;
  /** Situation snapshot — uncertainty and documentary-without-actor stay explainable. */
  stiSituation?: {
    uncertaintyPreserved: boolean;
    admissionBlockedByUncertainty: boolean;
    unattributedDocumentaryEvidence: boolean;
    unattributedEligibilityEvidence: boolean;
    unattributedCommercialEvidence: boolean;
    unattributedImpersonalObligation?: boolean;
    explanation: string;
  } | null;
};

/** Relative decision weight — generic across tenders. */
export const CATEGORY_DECISION_WEIGHT: Record<RequirementCategory, number> = {
  MANDATORY_ELIGIBILITY: 1.4,
  MANDATORY_TECHNICAL: 1.35,
  MANDATORY_ADMINISTRATIVE: 1.15,
  CONTRACTUAL: 0.85,
  EVALUATION: 0.35,
  PREFERRED: 0.55,
  INFORMATIONAL: 0,
};

export function isRequirementCategory(value: string): value is RequirementCategory {
  return (REQUIREMENT_CATEGORIES as readonly string[]).includes(value);
}

export function isScoringCategory(category: string): boolean {
  return isRequirementCategory(category) && category !== "INFORMATIONAL";
}
