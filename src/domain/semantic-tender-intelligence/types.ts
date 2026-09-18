/**
 * Semantic Tender Intelligence — authoritative interpretation contracts.
 * Boundary BETWEEN tender-document extraction and canonical requirements.
 * Does not decide company fit; does not invent obligations from keywords alone.
 */

import type { ObligationActorKind } from "@/domain/tender-requirements/obligation-actor";
import type {
  ObligationStrength,
  RequirementSemanticKind,
} from "@/domain/tender-requirements/semantic-kind";
import type { LotApplicability } from "@/domain/tender-requirements/lot-applicability";

/** Multi-signal situation snapshot — never decisive from one cue. */
export type SemanticSituationSnapshot = {
  version: "semantic-situation/v1";
  temporal: string;
  action: string;
  agreeingSignals: number;
  conflictCodes: string[];
  uncertaintyPreserved: boolean;
  admissionBlockedByUncertainty: boolean;
  decisiveSources: string[];
  explanation: string;
  /**
   * Documentary artefact + obligation force with no named subject.
   * Explains admission without inventing a bidder identity.
   */
  unattributedDocumentaryEvidence: boolean;
  /** Eligibility/qualification evidence with no named subject. */
  unattributedEligibilityEvidence: boolean;
  /** Bid-disclosed commercial condition with no named subject. */
  unattributedCommercialEvidence: boolean;
  /**
   * Impersonal procurement duty with a complete bid-stage frame.
   * Actor stays IMPERSONAL — never promoted to BIDDER.
   */
  unattributedImpersonalObligation: boolean;
};

/** Document-level semantic role (package context). Does not alone admit requirements. */
export const SEMANTIC_DOCUMENT_ROLES = [
  "INSTRUCTIONS_TO_BIDDERS",
  "TERMS_AND_CONDITIONS",
  "SCHEDULE_OF_REQUIREMENTS",
  "TECHNICAL_SPECIFICATION",
  "STATEMENT_OF_WORK",
  "RETURNABLE_BIDDING_FORMS",
  "FINANCIAL_FORMS",
  "CONTRACT_FORM",
  "SAMPLE_CONTRACT",
  "ANNEX",
  "CLARIFICATION",
  "CORRIGENDUM",
  "AMENDMENT",
  "Q_AND_A",
  "PREBID_MATERIAL",
  "NOTICE",
  "QUALIFICATION",
  "VENDOR_GUIDE",
  "PORTAL_GUIDE",
  "POLICY_OR_CODE_OF_CONDUCT",
  "OTHER",
  "UNKNOWN",
] as const;

export type SemanticDocumentRole = (typeof SEMANTIC_DOCUMENT_ROLES)[number];

/** Why the document exists — first-class signal, never an admission keyword. */
export const DOCUMENT_PURPOSES = [
  "PROCUREMENT_REQUIREMENT_SOURCE",
  "VENDOR_GUIDE",
  "PORTAL_GUIDE",
  "POLICY_OR_CODE",
  "EVALUATION_METHODOLOGY",
  "CONTRACT_EXECUTION_SOURCE",
  "CLARIFICATION_SOURCE",
  "BACKGROUND",
  "UNKNOWN",
] as const;

export type DocumentPurpose = (typeof DOCUMENT_PURPOSES)[number];

/** Section-level semantic purpose. */
export const SEMANTIC_SECTION_ROLES = [
  "BIDDER_INSTRUCTIONS",
  "ELIGIBILITY",
  "QUALIFICATION",
  "TECHNICAL_REQUIREMENTS",
  "SPECIFICATIONS",
  "SUBMISSION_INSTRUCTIONS",
  "REQUIRED_DOCUMENTS",
  "EVALUATION",
  "PRICING",
  "FINANCIAL_CAPACITY",
  "DELIVERY",
  "PERFORMANCE",
  "CONTRACT_CONDITIONS",
  "PAYMENT",
  "BUYER_PROCEDURES",
  "CLARIFICATION_PROCEDURE",
  "AMENDMENT",
  "DEFINITIONS",
  "LEGAL_RESERVATIONS",
  "TEMPLATE_FIELDS",
  "INFORMATIONAL_BACKGROUND",
  "ANNEX_REFERENCE",
  "UNKNOWN",
] as const;

export type SemanticSectionRole = (typeof SEMANTIC_SECTION_ROLES)[number];

/** Fine-grained semantic actors (grammatical + semantic subject). */
export const SEMANTIC_ACTORS = [
  "BIDDER",
  "TENDERER",
  "OFFEROR",
  "PROSPECTIVE_BIDDER",
  "SUCCESSFUL_BIDDER",
  "SUPPLIER",
  "CONTRACTOR",
  "MANUFACTURER",
  "SUBCONTRACTOR",
  "CONSULTANT",
  "ECONOMIC_OPERATOR",
  "BUYER",
  "AUTHORITY",
  "PROCURING_ENTITY",
  "EVALUATOR",
  "THIRD_PARTY",
  "BOTH_PARTIES",
  "GENERAL_LEGAL",
  "DOCUMENT_AUTHOR",
  "IMPERSONAL",
  "UNKNOWN",
] as const;

export type SemanticActor = (typeof SEMANTIC_ACTORS)[number];

/**
 * Who the clause addresses / binds (distinct from grammatical actor).
 * Actor = subject of the duty; recipient = party the duty is directed at.
 */
export const SEMANTIC_RECIPIENTS = [
  "BIDDER",
  "TENDERER",
  "OFFEROR",
  "SUPPLIER",
  "CONTRACTOR",
  "BUYER",
  "PROCURING_ENTITY",
  "DRAFTER",
  "PORTAL_USER",
  "BOTH_PARTIES",
  "UNKNOWN",
] as const;

export type SemanticRecipient = (typeof SEMANTIC_RECIPIENTS)[number];

/**
 * Clause purpose — reasoned from document/section/actor/phase before keyword kind.
 */
export const CLAUSE_PURPOSES = [
  "BIDDER_OBLIGATION",
  "BIDDER_PROCEDURAL",
  "BUYER_OBLIGATION",
  "POST_AWARD_OBLIGATION",
  "AWARD_STAGE_OBLIGATION",
  "PROCEDURAL_RULE",
  "FORM_INSTRUCTION",
  "TEMPLATE",
  "INFORMATIONAL_FACT",
  "METADATA_FACT",
  "EVALUATION",
  "Q_AND_A",
  "CLARIFICATION",
  "AMENDMENT",
  "LEGAL_RESERVATION",
  "DEFINITION",
  "HEADING",
  "EXAMPLE",
  "ELIGIBILITY",
  "QUALIFICATION",
  "TECHNICAL",
  "COMMERCIAL",
  "FINANCIAL",
  "REQUIRED_DOCUMENT",
  "SUBMISSION",
  "UNKNOWN",
] as const;

export type ClausePurpose = (typeof CLAUSE_PURPOSES)[number];

/**
 * Clause-level semantic role — not keyword detection.
 * Canonical entry is restricted to bidder-relevant requirement-compatible roles.
 */
export const SEMANTIC_CLAUSE_ROLES = [
  "BIDDER_REQUIREMENT",
  "BIDDER_PROCEDURAL_REQUIREMENT",
  "REQUIRED_SUBMISSION_DOCUMENT",
  "ELIGIBILITY_CONDITION",
  "QUALIFICATION_REQUIREMENT",
  "TECHNICAL_REQUIREMENT",
  "FINANCIAL_REQUIREMENT",
  "COMMERCIAL_REQUIREMENT",
  "DELIVERY_REQUIREMENT",
  "PERFORMANCE_REQUIREMENT",
  "EVALUATION_CRITERION",
  "SUBMISSION_INSTRUCTION",
  "PROCEDURAL_RULE",
  "BUYER_OBLIGATION",
  "POST_AWARD_CONTRACTUAL_OBLIGATION",
  "AWARD_STAGE_OBLIGATION",
  "LEGAL_RESERVATION",
  "TEMPLATE_PLACEHOLDER",
  "TEMPLATE_INSTRUCTION",
  "FORM_INSTRUCTION",
  "INFORMATIONAL_FACT",
  "DEFINITION",
  "HEADING",
  "EXAMPLE",
  "Q_AND_A",
  "CLARIFICATION",
  "AMENDMENT",
  "REVISION",
  "METADATA_FACT",
  "UNKNOWN",
] as const;

export type SemanticClauseRole = (typeof SEMANTIC_CLAUSE_ROLES)[number];

/** @deprecated Prefer SemanticClauseRole — kept for backward-compatible contentKind field. */
export const SEMANTIC_CONTENT_KINDS = SEMANTIC_CLAUSE_ROLES;
export type SemanticContentKind = SemanticClauseRole;

export const PROCUREMENT_PHASES = [
  "PRE_AWARD",
  "PRE_AWARD_COMMITMENT",
  "PRE_BID",
  "BID_SUBMISSION",
  "EVALUATION",
  "AWARD",
  "POST_AWARD",
  "CONTRACT_PERFORMANCE",
  "CONTRACT_EXECUTION",
  "DELIVERY",
  "DELIVERY_IMPLEMENTATION",
  "INSTALLATION_IMPLEMENTATION",
  "MULTI_PHASE",
  "MIXED_OR_AMBIGUOUS",
  "UNKNOWN",
] as const;

export type ProcurementPhase = (typeof PROCUREMENT_PHASES)[number];

export const APPLICABILITY_KINDS = [
  "UNCONDITIONAL",
  "CONDITIONAL",
  "OPTIONAL",
  "INFORMATIONAL",
  "NEEDS_VERIFICATION",
  "UNKNOWN",
] as const;

export type ApplicabilityKind = (typeof APPLICABILITY_KINDS)[number];

/** Structured conditionality — never discard IF → MUST structure. */
export type StructuredConditionality = {
  applicability: ApplicabilityKind;
  conditionText: string | null;
  actionText: string | null;
  thresholdText: string | null;
  exceptionText: string | null;
  timeframeText: string | null;
  scopeText: string | null;
  unresolved: boolean;
};

export const TEMPLATE_STATUSES = [
  "NOT_TEMPLATE",
  "PLACEHOLDER",
  "TEMPLATE_INSTRUCTION",
  "TEMPLATE_DEPENDENT",
] as const;

export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

/** Traceable exclusion / ambiguity codes — no silent drops. */
export const SEMANTIC_EXCLUSION_CODES = [
  "EXCLUDED_BUYER_OBLIGATION",
  "EXCLUDED_TEMPLATE",
  "EXCLUDED_FORM_INSTRUCTION",
  "EXCLUDED_HEADING",
  "EXCLUDED_INFORMATIONAL",
  "EXCLUDED_PROCEDURAL",
  "EXCLUDED_POST_AWARD",
  "EXCLUDED_LEGAL_RESERVATION",
  "EXCLUDED_EVALUATION_CRITERION",
  "EXCLUDED_Q_AND_A",
  "EXCLUDED_AMENDMENT_METADATA",
  "EXCLUDED_EXAMPLE",
  "EXCLUDED_DEFINITION",
  "EXCLUDED_METADATA_FACT",
  "EXCLUDED_INCOMPLETE_BOUNDARY",
  "EXCLUDED_MISSING_PROVENANCE",
  "EXCLUDED_TABLE_HEADER",
  "EXCLUDED_VERSION_METADATA",
  "EXCLUDED_VERSION_REVIEW",
  "EXCLUDED_VERSION_CONFLICT",
  "EXCLUDED_ORPHAN_CONDITION",
  "EXCLUDED_DUPLICATE_FRAGMENT",
  "NEEDS_CONTEXT_RECONSTRUCTION",
  "AMBIGUOUS_ACTOR",
  "AMBIGUOUS_APPLICABILITY",
  "AMBIGUOUS_PHASE",
  "NOT_BIDDER_RELEVANT",
  "EMPTY_TEXT",
  "NOT_ADMITTED",
  "EXCLUDED_INTERPRETATION_FAILURE",
  "EXCLUDED_PORTAL_OPERATION",
  "EXCLUDED_POLICY_CONTEXT",
] as const;

export type SemanticExclusionCode = (typeof SEMANTIC_EXCLUSION_CODES)[number];

export type SemanticObligationStrength = ObligationStrength | "UNKNOWN";

export type SemanticProvenance = {
  sourceDocument: string | null;
  sourcePage: number | null;
  sourceSection: string | null;
  sourceCell: string | null;
  versionLabel: string | null;
  /** Optional richer locator (table row/col, paragraph id). */
  locator?: string | null;
  completeness?: "COMPLETE" | "TRUNCATED" | "PARTIAL" | "UNREADABLE" | null;
};

/** Table cell / row semantic context — never invent from headers alone. */
export type TableSemanticContext = {
  isTableHeader: boolean;
  columnHeader: string | null;
  rowLabel: string | null;
  unit: string | null;
  threshold: string | null;
  lotNumber: string | null;
  conditionInCell: string | null;
  sourceLocation: string | null;
};

/** Amendment / corrigendum version applicability. */
export const VERSION_APPLICABILITY_STATUSES = [
  "ORIGINAL",
  "MODIFIED",
  "SUPERSEDED",
  "REVIEW",
  "CONFLICT",
  "NOT_APPLICABLE",
] as const;

export type VersionApplicabilityStatus =
  (typeof VERSION_APPLICABILITY_STATUSES)[number];

export type VersionSemanticContext = {
  status: VersionApplicabilityStatus;
  originalRef: string | null;
  modificationSummary: string | null;
  replacesProven: boolean;
};

/** Package / draft context fed into interpretation (never company profile). */
export type SemanticInterpretationContext = {
  documentRole?: SemanticDocumentRole | null;
  sectionRole?: SemanticSectionRole | null;
  /** Raw section heading / label when known. */
  sectionLabel?: string | null;
  /** UTI / package document role string for mapping. */
  packageDocumentRole?: string | null;
  /** Preceding paragraph(s) for multi-paragraph / orphan-condition reunification. */
  precedingText?: string | null;
  /** Following paragraph(s) for continuation / action attachment. */
  followingText?: string | null;
  /** Table semantics when the statement comes from a table cell. */
  table?: TableSemanticContext | null;
  /** Version / amendment context when known. */
  version?: VersionSemanticContext | null;
};

export type InterpretedSemanticStatement = {
  version: "semantic-tender-intelligence/v3";
  requirementText: string;
  documentRole: SemanticDocumentRole;
  /** First-class document purpose — never admits a clause by itself. */
  documentPurpose: DocumentPurpose;
  sectionRole: SemanticSectionRole;
  clauseRole: SemanticClauseRole;
  /** Alias of clauseRole for existing consumers. */
  contentKind: SemanticContentKind;
  /** Clause purpose before keyword semantic-kind mapping. */
  clausePurpose: ClausePurpose;
  actor: SemanticActor;
  /** Party the clause addresses (may differ from grammatical actor). */
  recipient: SemanticRecipient;
  obligationActorKind: ObligationActorKind;
  procurementPhase: ProcurementPhase;
  applicability: ApplicabilityKind;
  templateStatus: TemplateStatus;
  bidderRelevant: boolean;
  /** Mapped to existing RequirementSemanticKind for normalize compatibility. */
  semanticKind: RequirementSemanticKind;
  obligationStrength: SemanticObligationStrength;
  conditionText: string | null;
  conditional: boolean;
  /** Structured IF → MUST preservation. */
  conditionality: StructuredConditionality;
  lotApplicability: LotApplicability;
  lotLabel: string | null;
  boundaryComplete: boolean;
  /** True when text was reunified from surrounding paragraphs/pages. */
  reconstructedFromContext: boolean;
  tableContext: TableSemanticContext | null;
  versionContext: VersionSemanticContext | null;
  provenance: SemanticProvenance;
  provenanceLinks: SemanticProvenance[];
  semanticIdentity: string;
  confidence: number;
  /** Multi-signal situation — explains why the clause was admitted or held uncertain. */
  situation: SemanticSituationSnapshot | null;
  /** Only true when statement may enter canonical requirement set. */
  admitToCanonical: boolean;
  exclusionReason: string | null;
  exclusionCode: SemanticExclusionCode | null;
};

export type CanonicalSemanticCandidate = {
  canonicalId: string;
  fullRequirementText: string;
  actor: SemanticActor;
  recipient: SemanticRecipient;
  clauseRole: SemanticClauseRole;
  clausePurpose: ClausePurpose;
  documentRole: SemanticDocumentRole;
  documentPurpose: DocumentPurpose;
  sectionRole: SemanticSectionRole;
  semanticKind: RequirementSemanticKind;
  contentKind: SemanticContentKind;
  obligationStrength: SemanticObligationStrength;
  procurementPhase: ProcurementPhase;
  applicability: ApplicabilityKind;
  templateStatus: TemplateStatus;
  condition: string | null;
  /** Full structured conditionality — never strip IF → MUST. */
  conditionality: StructuredConditionality;
  bidderRelevant: boolean;
  boundaryComplete: boolean;
  lotApplicability: string | null;
  tableContext?: TableSemanticContext | null;
  versionContext?: VersionSemanticContext | null;
  sourceDocument: string | null;
  sourcePage: number | null;
  sourceSection: string | null;
  sourceCell: string | null;
  version: string | null;
  provenance: SemanticProvenance[];
  confidence: number;
  situation?: SemanticSituationSnapshot | null;
  /** Draft shape for buildCanonicalRequirements / normalize. */
  draft: {
    category: string;
    description: string;
    mandatory: boolean;
    sourcePage: number | null;
    sourceSection: string | null;
    sourceCell?: string | null;
    columnHeader?: string | null;
    rowLabel?: string | null;
    versionLabel?: string | null;
    locator?: string | null;
    sourceCompleteness?: "COMPLETE" | "TRUNCATED" | "PARTIAL" | "UNREADABLE" | null;
    evidenceText: string | null;
    sourceDocument: string | null;
  };
};

/** Separate STI metadata output — never mixed into canonical requirements. */
export type SemanticMetadataFact = {
  field: string;
  text: string;
  documentRole: SemanticDocumentRole;
  provenance: SemanticProvenance;
  exclusionCode: "EXCLUDED_METADATA_FACT";
};

/** Roles compatible with canonical bidder requirements. */
export const CANONICAL_COMPATIBLE_CLAUSE_ROLES = new Set<SemanticClauseRole>([
  "BIDDER_REQUIREMENT",
  "BIDDER_PROCEDURAL_REQUIREMENT",
  "REQUIRED_SUBMISSION_DOCUMENT",
  "ELIGIBILITY_CONDITION",
  "QUALIFICATION_REQUIREMENT",
  "TECHNICAL_REQUIREMENT",
  "FINANCIAL_REQUIREMENT",
  "COMMERCIAL_REQUIREMENT",
  "DELIVERY_REQUIREMENT",
  "PERFORMANCE_REQUIREMENT",
  "AWARD_STAGE_OBLIGATION",
  "SUBMISSION_INSTRUCTION",
]);
