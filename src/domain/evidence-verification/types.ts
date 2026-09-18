/**
 * Evidence / Verification Intelligence — display and traceability types.
 * Derived from canonical TenderRequirement + TenderEvidence; never a parallel requirement system.
 */

import type { ReadinessStatus } from "@/domain/decision/tender-readiness";

export type RequirementVerificationStatus =
  | "VERIFIED"
  | "NEEDS_VERIFICATION"
  | "MISSING_EVIDENCE"
  | "NOT_APPLICABLE";

export const VERIFICATION_DISCLAIMER =
  "Verification reflects recorded evidence and human review only. AI interpretations are never treated as verified.";

export type CanonicalEvidenceRecord = {
  id: string;
  requirementId: string | null;
  sourcePage: number | null;
  sourceSection: string | null;
  evidenceText: string;
  verificationStatus: string;
  teamTaskId?: string | null;
  documentId?: string | null;
  documentName?: string | null;
  verificationReason?: string | null;
  verifiedById?: string | null;
  verifiedAt?: Date | string | null;
};

export type RequirementVerificationChain = {
  requirementId: string;
  requirement: string;
  mandatory: boolean;
  readinessStatus: ReadinessStatus;
  verificationStatus: RequirementVerificationStatus;
  verificationReason: string | null;
  evidenceId: string | null;
  evidenceExcerpt: string | null;
  sourceDocument: string | null;
  pageNumber: number | null;
  section: string | null;
  locationLabel: string | null;
  verifierLabel: string | null;
  verifiedAt: string | null;
  teamTaskId: string | null;
};

export type VerificationIntelligenceSummary = {
  total: number;
  verified: number;
  needsVerification: number;
  missingEvidence: number;
  notApplicable: number;
};

export type VerificationIntelligenceBundle = {
  computed: true;
  chains: RequirementVerificationChain[];
  summary: VerificationIntelligenceSummary;
  disclaimer: string;
};

export type VerificationAuditAction =
  | "EVIDENCE_FOUND"
  | "VERIFICATION_REQUESTED"
  | "VERIFIED"
  | "VERIFICATION_REJECTED"
  | "EVIDENCE_UPDATED";
