/**
 * Authoritative package-level Metadata & Document Identity.
 * Consumes extracted evidence with file provenance. Never concatenates
 * unrelated fragments into buyer/title/value. Downstream must not re-scan
 * raw text to reconstruct these fields.
 */

export const PACKAGE_IDENTITY_VERSION = "package-identity/v1" as const;

export const PACKAGE_IDENTITY_ROLES = [
  "NOTICE",
  "INVITATION",
  "INSTRUCTIONS",
  "SCHEDULE_OF_REQUIREMENTS",
  "TECHNICAL_SPECIFICATION",
  "RETURNABLE_FORMS",
  "PRICING",
  "CONTRACT_FORMS",
  "SAMPLE_CONTRACT",
  "TERMS_AND_CONDITIONS",
  "AMENDMENT",
  "CORRIGENDUM",
  "Q_AND_A",
  "CLARIFICATION",
  "PREBID_MATERIAL",
  "QUALIFICATION",
  "VENDOR_GUIDE",
  "PORTAL_GUIDE",
  "POLICY_OR_CODE",
  "ANNEX",
  "APPENDIX",
  "OTHER",
  "UNKNOWN",
] as const;

export type PackageIdentityRole = (typeof PACKAGE_IDENTITY_ROLES)[number];

export type FieldResolutionStatus = "OK" | "UNKNOWN" | "CONFLICT" | "INCOMPLETE";

export type DocumentCompleteness = "COMPLETE" | "TRUNCATED" | "PARTIAL" | "UNREADABLE";

export type DeadlineDateClass =
  | "BID_SUBMISSION"
  | "OPENING"
  | "CLARIFICATION"
  | "PUBLICATION"
  | "DELIVERY"
  | "CONTRACT"
  | "VALIDITY"
  | "OTHER";

export type PackageIdentityDocument = {
  fileName: string;
  role: PackageIdentityRole;
  confidence: number;
  signals: string[];
  completeness: DocumentCompleteness;
};

export type IdentityCandidate = {
  value: string;
  sourceFile: string;
  sourceText: string;
  authority: number;
  role: PackageIdentityRole;
  truncated: boolean;
};

export type ResolvedIdentityField = {
  value: string | null;
  status: FieldResolutionStatus;
  candidates: IdentityCandidate[];
};

export type PackageDeadlineSource = {
  fileName: string;
  role: PackageIdentityRole;
  iso: string;
  timezone: string | null;
  evidence: string;
  dateClass: DeadlineDateClass;
  truncated: boolean;
};

export type PackageDeadlineIdentity = {
  deadlineIso: string | null;
  deadlineTimezone: string | null;
  localHour: number | null;
  localMinute: number | null;
  evidence: string | null;
  status: FieldResolutionStatus;
  dateClass: DeadlineDateClass | null;
  reason: string | null;
  sources: PackageDeadlineSource[];
};

export type PackageIdentityRecord = {
  version: typeof PACKAGE_IDENTITY_VERSION;
  documents: PackageIdentityDocument[];
  buyer: ResolvedIdentityField;
  title: ResolvedIdentityField;
  estimatedValue: ResolvedIdentityField;
  reference: ResolvedIdentityField;
  location: ResolvedIdentityField;
  country: ResolvedIdentityField;
  procurementType: ResolvedIdentityField;
  deadline: PackageDeadlineIdentity;
};

export type PackageIdentityPart = {
  fileName: string;
  text: string;
  truncated?: boolean;
  extraction?: {
    title: string | null;
    client: string | null;
    deadlineIso: string | null;
    deadlineTimezone: string | null;
    deadlineEvidence: string | null;
    deadlineLocalHour: number | null;
    deadlineLocalMinute: number | null;
    deadlineUnknownReason: string | null;
    estimatedValue: number | null;
    reference: string | null;
    country?: string | null;
    location?: string | null;
    procurementType?: string | null;
  };
};
