/**
 * Tender package roles and completeness diagnosis.
 * DocumentKind stays COMPANY_PROFILE | TENDER | …;
 * TenderDocumentRole describes the role inside a tender package.
 */

export type TenderDocumentRole =
  | "AVIS"
  | "CPS"
  | "RFP"
  | "TECHNICAL_SPECIFICATION"
  | "ADMINISTRATIVE"
  | "FINANCIAL"
  | "ANNEX"
  | "OTHER";

export type PackageCompletenessReason =
  | "PACKAGE_COMPLETE"
  | "SINGLE_DOCUMENT_SUBSTANTIVE"
  | "ONLY_AVIS"
  | "CPS_MISSING"
  | "TECHNICAL_SPECIFICATION_MISSING"
  | "PACKAGE_INCOMPLETE"
  | "PACKAGE_TEXT_TRUNCATED"
  | "EXTRACTION_FAILED"
  | "DOCUMENT_UNREADABLE"
  | "NO_RELIABLE_REQUIREMENTS";

export type ClassifiedTenderPart = {
  documentId?: string;
  fileName: string;
  /** High-level kind from company-knowledge classifier */
  documentKind: string;
  role: TenderDocumentRole;
  roleConfidence: number;
  roleSignals: string[];
  text: string;
  textLength: number;
};

export type VerifiedTenderFacts = {
  title: string | null;
  client: string | null;
  country: string | null;
  region: string | null;
  industry: string | null;
  deadlineIso: string | null;
  deadlineTimezone: string | null;
  estimatedValue: number | null;
  guarantee: string | null;
  reference: string | null;
  submissionMethod: string | null;
  factsNote: string | null;
};

export type TenderPackageAssembly = {
  parts: ClassifiedTenderPart[];
  rolesPresent: TenderDocumentRole[];
  packageLabel: string;
  packageText: string;
  /** True when package includes CPS / RFP / technical specifications (not notice-only). */
  hasSpecificationSource: boolean;
  /** True when package is notice/avis only (no CPS/RFP/tech specs). */
  avisOnly: boolean;
  completeness: PackageCompletenessReason;
  completenessMessage: string;
  missingDocumentTypes: TenderDocumentRole[];
};

export type PackageScoringDecision = {
  allowScoring: boolean;
  reason: PackageCompletenessReason;
  message: string;
  /**
   * Missing package documents for incomplete analyses only.
   * Empty when substantive content makes separate CPS/tech docs unnecessary.
   */
  missingDocumentTypes: TenderDocumentRole[];
};
