export type DecisionType = "BID" | "REVIEW" | "NO_BID";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RequirementStatus = "MATCHED" | "FAILED" | "UNCERTAIN" | "MISSING";

export interface PaywallRecap {
  tendersAnalyzed: number;
  decisionsGenerated: number;
  bidCount: number;
  reviewCount: number;
  noBidCount: number;
  risksDetected: number;
  missingDocsDetected: number;
  estimatedHoursSaved: number;
}

export interface TrialUsage {
  analysesUsed: number;
  analysesLimit: number;
  analysesRemaining: number;
  isUnlimited?: boolean;
  plan?: string;
  subscriptionStatus?: string;
  effectiveStatus?: string;
  billingInterval?: string | null;
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  periodEndsAt?: string | null;
  gracePeriodEndsAt?: string | null;
  inGrace?: boolean;
  billingWarning?: boolean;
  accessAllowed?: boolean;
  isTrialExpired?: boolean;
  tendersAnalyzed: number;
  decisionsGenerated: number;
  bidCount?: number;
  reviewCount?: number;
  noBidCount?: number;
  risksDetected: number;
  missingDocsDetected: number;
  estimatedHoursSaved: number;
}

export type UploadPhase =
  | "idle"
  | "uploading"
  | "discovering"
  | "extracting"
  | "preparing"
  | "processing"
  | "analyzing"
  | "still_processing"
  | "success"
  | "error";

export interface Requirement {
  id: string;
  title: string;
  description: string | null;
  status: RequirementStatus;
  evidence: string | null;
}

export interface DisqualificationRisk {
  id: string;
  title: string;
  description: string;
  level: RiskLevel;
  mitigation: string | null;
}
