/**
 * Canonical compliance evidence states — never collapse unknown into failure.
 */

export type ComplianceEvidenceState =
  | "CONFIRMED_COMPLIANT"
  | "CONFIRMED_NON_COMPLIANT"
  | "UNKNOWN"
  | "NEEDS_VERIFICATION"
  | "NOT_APPLICABLE";

export type RiskSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

/** Canonical risk categories — distinction for Decision and reporting. */
export type RiskCategory =
  | "COMPLIANCE"
  | "ELIGIBILITY"
  | "TECHNICAL_DELIVERY"
  | "FINANCIAL_COMMERCIAL"
  | "CONTRACTUAL"
  | "DEADLINE_PROCEDURAL"
  | "EVIDENCE_VERIFICATION";

export type CanonicalRiskSource = {
  document: string | null;
  page: number | null;
  section: string | null;
  excerpt: string | null;
  basis: import("@/domain/tender-intelligence/types").SourceBasis;
  located: boolean;
};

export type CanonicalStructuredRisk = {
  id: string;
  requirementId: string | null;
  /** Semantically identical requirements contributing to one underlying risk. */
  linkedRequirementIds?: string[];
  title: string;
  category: string;
  riskCategory?: RiskCategory;
  severity: RiskSeverity;
  evidenceState: ComplianceEvidenceState;
  fitStatus?: import("@/domain/decision/requirement-fit-status").RequirementFitStatus | null;
  verificationState: import("@/domain/evidence-verification").RequirementVerificationStatus;
  explanation: string;
  /** Why this is risky — factual and traceable. */
  whyRisky: string;
  impact: string;
  recommendedAction: string;
  source: CanonicalRiskSource;
  /** Deduplication key for the underlying business risk. */
  underlyingKey?: string;
};
