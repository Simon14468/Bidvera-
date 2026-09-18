/**
 * Evidence Intelligence — user-facing view model over canonical verification data.
 * Does not duplicate Requirement / Evidence persistence; derived at analysis time.
 */

import type { ReadinessStatus } from "@/domain/decision/tender-readiness";
import type { RequirementVerificationStatus } from "@/domain/evidence-verification";
import type { SourceBasis } from "@/domain/tender-intelligence";

/** User-facing evidence lifecycle — maps from canonical verification + expiry. */
export type EvidenceIntelligenceState =
  | "UNKNOWN"
  | "MISSING"
  | "FOUND_UNVERIFIED"
  | "VERIFIED"
  | "INVALID"
  | "EXPIRED";

export type EvidenceValidityState =
  | "VALID"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "UNKNOWN";

export type EvidenceSourceKind =
  | "COMPANY_DOCUMENT"
  | "COMPANY_PROFILE"
  | "TENDER_REFERENCE"
  | "TEAM_VERIFIED"
  | "UNKNOWN";

export type EvidenceIntelligenceRecord = {
  evidenceId: string | null;
  title: string | null;
  evidenceType: string | null;
  sourceKind: EvidenceSourceKind;
  sourceDocument: string | null;
  sourceLocation: string | null;
  documentReference: string | null;
  pageNumber: number | null;
  section: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  validityState: EvidenceValidityState;
  /** Provenance confidence — NOT verification. */
  confidence: "VERIFIED" | "INFERRED" | "UNKNOWN";
  verificationNotes: string | null;
  excerpt: string | null;
  ownerLabel: string;
};

export type RequirementEvidenceIntelligenceRow = {
  requirementId: string;
  requirement: string;
  mandatory: boolean;
  requirementType: string;
  requirementMatchStatus: string | null;
  evidenceState: EvidenceIntelligenceState;
  requirementVerificationStatus: RequirementVerificationStatus;
  relevanceReason: string | null;
  readinessImpact: ReadinessStatus;
  readinessImpactLabel: string;
  decisionImpactNote: string | null;
  evidence: EvidenceIntelligenceRecord | null;
  sourceBasis: SourceBasis;
  locationLabel: string | null;
  teamTaskId: string | null;
};

export type EvidenceIntelligenceSummary = {
  total: number;
  verified: number;
  foundUnverified: number;
  missing: number;
  invalid: number;
  expired: number;
  unknown: number;
  notApplicable: number;
};

/** Executive headline — Supported / Need Verification / Missing Evidence. */
export type EvidenceReadinessSummary = {
  totalRequirements: number;
  supported: number;
  needVerification: number;
  missingEvidence: number;
};

export type EvidenceIntelligenceBundle = {
  computed: true;
  rows: RequirementEvidenceIntelligenceRow[];
  summary: EvidenceIntelligenceSummary;
  readinessSummary: EvidenceReadinessSummary;
  disclaimer: string;
};

export const EVIDENCE_INTELLIGENCE_DISCLAIMER =
  "Evidence Intelligence shows whether real, traceable proof exists for each requirement. Confidence from AI or profile matching is not verification.";
