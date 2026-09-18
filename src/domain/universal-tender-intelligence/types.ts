/**
 * Universal Tender Intelligence Layer — canonical package contracts.
 * Normalizes real-world tender packages BEFORE Requirement / Fit / Risk / Decision.
 * Does not replace those engines; feeds them clean inputs.
 */

import type { TenderDocumentRole } from "@/domain/tender-package/types";
import type { CanonicalPackageMetadata } from "@/domain/tender-package/package-metadata";
import type { ObligationActorKind } from "@/domain/tender-requirements/obligation-actor";
import type {
  ObligationStrength,
  RequirementSemanticKind,
} from "@/domain/tender-requirements/semantic-kind";

/** Fine-grained document roles inferred from content + structure (not filename alone). */
export const UNIVERSAL_DOCUMENT_ROLES = [
  "TENDER_NOTICE",
  "INVITATION",
  "INSTRUCTIONS_TO_TENDERERS",
  "TECHNICAL_SPECIFICATION",
  "COMMERCIAL_DOCUMENT",
  "PRICING_SCHEDULE",
  "FORM_OF_TENDER",
  "CONTRACT",
  "TERMS_AND_CONDITIONS",
  "ELIGIBILITY_DOCUMENT",
  "DECLARATION",
  "ANNEX",
  "CORRIGENDUM",
  "ADDENDUM",
  "CLARIFICATION",
  "Q_AND_A",
  "BIDDER_RESPONSE",
  "OTHER",
  "UNKNOWN",
] as const;

export type UniversalDocumentRole = (typeof UNIVERSAL_DOCUMENT_ROLES)[number];

/** Semantic content types before entering downstream canonical models. */
export const SEMANTIC_CONTENT_TYPES = [
  "BIDDER_OBLIGATION",
  "AUTHORITY_OBLIGATION",
  "DOCUMENT_PROCEDURE",
  "ELIGIBILITY_CONDITION",
  "REQUIRED_DOCUMENT",
  "TECHNICAL_REQUIREMENT",
  "COMMERCIAL_REQUIREMENT",
  "CONTRACTUAL_OBLIGATION",
  "CONDITIONAL_OBLIGATION",
  "OPTIONAL_REQUIREMENT",
  "DEADLINE",
  "EVALUATION_CRITERION",
  "INFORMATIONAL_FACT",
  "DOCUMENT_DESCRIPTION",
  "SECTION_HEADING",
  "TABLE_HEADER",
  "TABLE_DATA",
  "CLARIFICATION",
  "Q_AND_A",
  "REVISION",
  "ADDENDUM",
  "EXAMPLE",
  "REVIEWER_INSTRUCTION",
  "TEST_QA_CONTENT",
  "UNKNOWN",
] as const;

export type SemanticContentType = (typeof SEMANTIC_CONTENT_TYPES)[number];

export const UNIVERSAL_ACTORS = [
  "BIDDER",
  "TENDERER",
  "SUPPLIER",
  "CONTRACTOR",
  "CONSULTANT",
  "ECONOMIC_OPERATOR",
  "PROCURING_ENTITY",
  "CONTRACTING_AUTHORITY",
  "EVALUATOR",
  "DOCUMENT_AUTHOR",
  "THIRD_PARTY",
  "UNKNOWN",
] as const;

export type UniversalActor = (typeof UNIVERSAL_ACTORS)[number];

export type DocumentRelationKind =
  | "ORIGINAL"
  | "REVISED"
  | "CORRIGENDUM"
  | "ADDENDUM"
  | "CLARIFICATION"
  | "REPLACEMENT"
  | "AMENDMENT"
  | "SUPERSEDED"
  | "DUPLICATE"
  | "UNKNOWN";

export type UtiFailureCode =
  | "DOCUMENT_UNREADABLE"
  | "EXTRACTION_FAILED"
  | "UNSUPPORTED_SKIPPED"
  | "AMBIGUOUS_CONTENT"
  | "CONFLICTING_VERSION"
  | "UNKNOWN_ACTOR"
  | "UNKNOWN_CLASSIFICATION"
  | "MISSING_PROVENANCE"
  | "INCOMPLETE_FRAGMENT"
  | "DUPLICATE_IDENTITY"
  | "LOW_CONFIDENCE";

export type ExtractionLifecycleStatus =
  | "DISCOVERED"
  | "STORED"
  | "EXTRACTING"
  | "EXTRACTED"
  | "FILE_EXTRACTION_FAILED"
  | "UNSUPPORTED_SKIPPED"
  | "UNREADABLE";

export type UniversalDocumentRecord = {
  /** Stable file id (DB document id or discovery id). */
  fileId: string;
  originalFileName: string;
  mimeType: string | null;
  archiveProvenance: {
    source: "loose" | "zip" | "rar" | "unknown";
    archiveFileName: string | null;
    archivePath: string | null;
  };
  universalRole: UniversalDocumentRole;
  /** Legacy package role for assemble / scoring compatibility. */
  legacyRole: TenderDocumentRole;
  roleConfidence: number;
  roleSignals: string[];
  language: string | null;
  pageOrSheetCount: number | null;
  extractionMethod: string | null;
  extractionStatus: ExtractionLifecycleStatus;
  ocrStatus: "NOT_NEEDED" | "USED" | "FAILED" | "UNKNOWN";
  readability: "READABLE" | "PARTIAL" | "UNREADABLE";
  revisionLabel: string | null;
  documentDate: string | null;
  textLength: number;
  failureCode: UtiFailureCode | null;
  failureMessage: string | null;
};

export type DocumentVersionEdge = {
  fromFileId: string;
  toFileId: string;
  relation: DocumentRelationKind;
  confidence: number;
  evidence: string;
  conflict: boolean;
};

export type ClassifiedContentUnit = {
  text: string;
  contentType: SemanticContentType;
  actor: UniversalActor;
  obligationActorKind: ObligationActorKind;
  semanticKind: RequirementSemanticKind;
  obligationStrength: ObligationStrength;
  conditional: boolean;
  conditionText: string | null;
  confidence: number;
  provenance: {
    fileId: string | null;
    fileName: string | null;
    page: number | null;
  };
  failureCodes: UtiFailureCode[];
  /** True when unit may enter bidder requirement canonicalization. */
  admitToRequirements: boolean;
};

export type UtiQualityIssue = {
  code: UtiFailureCode;
  message: string;
  fileId: string | null;
  fileName: string | null;
};

export type UniversalTenderPackage = {
  version: "universal-tender-intelligence/v1";
  packageLabel: string;
  documents: UniversalDocumentRecord[];
  /** Explicit inventory — never silent drops. */
  inventoryCount: number;
  extractedOkCount: number;
  failedCount: number;
  unsupportedCount: number;
  versionEdges: DocumentVersionEdge[];
  metadata: CanonicalPackageMetadata | null;
  metadataConflicts: string[];
  qualityIssues: UtiQualityIssue[];
  /**
   * Parts ordered for downstream extraction: base specs first,
   * corrigenda / clarifications / Q&A last (effective-rule awareness).
   */
  orderedParts: Array<{
    fileId: string;
    fileName: string;
    documentKind: string;
    text: string;
    universalRole: UniversalDocumentRole;
    legacyRole: TenderDocumentRole;
    versionStatus: DocumentRelationKind;
  }>;
};

/** Compact summary persisted with intelligence (UI-agnostic). */
export type UniversalTenderIntelligenceSummary = {
  version: UniversalTenderPackage["version"];
  inventoryCount: number;
  extractedOkCount: number;
  failedCount: number;
  unsupportedCount: number;
  roles: Array<{ fileName: string; role: UniversalDocumentRole; legacyRole: TenderDocumentRole }>;
  versionEdges: number;
  metadataConflicts: string[];
  qualityIssueCodes: UtiFailureCode[];
};
