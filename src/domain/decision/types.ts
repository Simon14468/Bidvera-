import type { RequirementFitStatus, CompanyEvidenceProvenance } from "./requirement-fit-status";
import type {
  CompanyProfile,
  ConfidenceLevel,
  DecisionType,
  RequirementMatchStatus,
  RiskSeverity,
} from "@prisma/client";
import type { CompanyTenderFitBreakdown } from "./company-fit";

export interface RuleCompanyProfile {
  companyName: string | null;
  industry: string | null;
  country: string | null;
  companySize: string | null;
  experienceLevel: string | null;
  services: string[];
  certifications: string[];
  experienceYears: number | null;
  revenueRange: string | null;
  employeeRange: string | null;
  geographicCoverage: string[];
  contractSizeMin: number | null;
  contractSizeMax: number | null;
  customQualificationRules: string[];
}

export interface RuleRequirement {
  id?: string;
  category: string;
  description: string;
  mandatory: boolean;
  value: string | null;
  status: RequirementMatchStatus;
  evidence?: string | null;
  /** Canonical company fit — authoritative for readiness/risk/decision. */
  fitStatus?: RequirementFitStatus | null;
  fitProvenance?: CompanyEvidenceProvenance | null;
  evidenceConflict?: boolean;
  semanticKind?: string | null;
  sourceDocument?: string | null;
  page?: number | "UNKNOWN" | null;
  section?: string | null;
  rationale?: string | null;
}

export interface DeterministicFinding {
  code: string;
  severity: RiskSeverity;
  category: string;
  description: string;
  forcesDecision?: DecisionType;
  requirementStatus?: RequirementMatchStatus;
  requirementIndex?: number;
}

export interface DecisionEngineInput {
  profile: RuleCompanyProfile;
  requirements: RuleRequirement[];
  estimatedValue: number | null;
  tenderContext?: {
    title: string;
    client: string | null;
    country: string | null;
    industry: string | null;
    tenderText: string;
  };
  ai?: {
    suggestedDecision: DecisionType;
    fitScore: number;
    confidence: ConfidenceLevel;
    reasoning: string;
  } | null;
}

export interface DecisionEngineOutput {
  decision: DecisionType;
  fitScore: number;
  confidence: ConfidenceLevel;
  reasoning: string;
  findings: DeterministicFinding[];
  requirements: RuleRequirement[];
  hardFailure: boolean;
  matchedRequirements: RuleRequirement[];
  failedRequirements: RuleRequirement[];
  uncertainRequirements: RuleRequirement[];
  fitBreakdown: CompanyTenderFitBreakdown;
  /** Canonical explainability inputs for Explainable Decision (no second engine). */
  explainability?: import("./decision-integrity").DecisionExplainabilityInputs;
  /** Deduplicated material hard blockers that drove NO_BID. */
  hardBlockers?: import("./decision-integrity").DecisionBlocker[];
}

export function toRuleProfile(
  profile: CompanyProfile | null,
  companyName?: string | null,
): RuleCompanyProfile {
  return {
    companyName: companyName ?? null,
    industry: profile?.industry ?? null,
    country: profile?.country ?? null,
    companySize: profile?.companySize ?? null,
    experienceLevel: profile?.experienceLevel ?? null,
    services: profile?.services ?? [],
    certifications: profile?.certifications ?? [],
    experienceYears: profile?.experienceYears ?? null,
    revenueRange: profile?.revenueRange ?? null,
    employeeRange: profile?.employeeRange ?? null,
    geographicCoverage: profile?.geographicCoverage ?? [],
    contractSizeMin: profile?.contractSizeMin ?? null,
    contractSizeMax: profile?.contractSizeMax ?? null,
    customQualificationRules: profile?.customQualificationRules ?? [],
  };
}

export function scoreToConfidence(score: number): ConfidenceLevel {
  if (score >= 75) return "HIGH";
  if (score >= 45) return "MEDIUM";
  return "LOW";
}
