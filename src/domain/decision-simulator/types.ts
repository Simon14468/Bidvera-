/**
 * Decision Simulator — read-only what-if analysis types.
 * Simulated values are never persisted as real tender state.
 */

import type { CompanyTenderFitBreakdown } from "@/domain/decision/company-fit";
import type { TenderReadinessBreakdown } from "@/domain/decision/tender-readiness";
import type { TenderDecisionRecommendation } from "@/domain/decision/recommendation";
import type { RuleCompanyProfile } from "@/domain/decision/types";
import type { TenderIntelligenceBreakdown } from "@/domain/tender-intelligence";
import type {
  CanonicalEvidence,
  CanonicalMissingDocument,
  CanonicalRequirement,
} from "@/domain/tender-intelligence/canonical";
import type {
  ConfidenceLevel,
  DecisionType,
  RequirementMatchStatus,
} from "@prisma/client";

/** Supported, deterministic simulation inputs — no invented facts. */
export type SimulationOverrides = {
  /** Override requirement match status by canonical requirement id. */
  requirements?: Array<{
    id: string;
    status: RequirementMatchStatus;
    /** Optional simulated evidence note — labeled SIMULATED in output. */
    evidence?: string | null;
  }>;
  /** Simulated evidence verification outcomes (existing evidence rows only). */
  evidence?: Array<{
    id: string;
    verificationStatus: "VERIFIED" | "NEEDS_VERIFICATION" | "MISSING_EVIDENCE" | "NOT_APPLICABLE";
  }>;
  /** Treat missing-document gaps as resolved in simulation only. */
  resolveMissingDocumentIds?: string[];
  /** Partial company profile overrides affecting fit engine inputs. */
  profile?: Partial<
    Pick<
      RuleCompanyProfile,
      | "services"
      | "certifications"
      | "experienceYears"
      | "revenueRange"
      | "employeeRange"
      | "geographicCoverage"
      | "contractSizeMin"
      | "contractSizeMax"
      | "customQualificationRules"
    >
  >;
};

export type SimulationTenderContext = {
  tenderId: string;
  companyId: string;
  title: string;
  client: string | null;
  country: string | null;
  industry: string | null;
  estimatedValue: number | null;
  deadline: Date | null;
  extractedText: string;
  documentName: string | null;
};

/** Immutable in-memory snapshot — disposable, never written to DB. */
export type SimulationSnapshot = {
  context: SimulationTenderContext;
  profile: RuleCompanyProfile;
  requirements: CanonicalRequirement[];
  evidence: CanonicalEvidence[];
  missingDocuments: CanonicalMissingDocument[];
  /** Reference-only — same as production (never flips decision enum). */
  memoryInsights: import("@/domain/decision-memory").DecisionMemoryInsightsBundle | null;
  teamWorkflow: {
    openCriticalCount: number;
    openCount: number;
    titles: string[];
    note: string | null;
  } | null;
  /** Persisted canonical decision baseline (display only). */
  baselineDecision: DecisionType | null;
  baselineDisplayLabel: string;
  baselineFitScore: number | null;
  baselineConfidence: ConfidenceLevel;
  baselineReadiness: TenderReadinessBreakdown | null;
  baselineIntelligence: TenderIntelligenceBreakdown;
  companyKnowledgeOnly: boolean;
  scoringBlocked: boolean;
  workflowTasks: SimulatableWorkflowTask[];
};

export type SimulationDependencyImpact = {
  factor: string;
  affectedRequirementId: string | null;
  affectedBlocker: string | null;
  affectedReadinessState: string | null;
  affectedDecisionRule: string | null;
  before: string;
  after: string;
  simulated: true;
};

export type SimulationStateView = {
  decision: DecisionType;
  displayLabel: string;
  confidence: ConfidenceLevel;
  fitScore: number;
  fitBreakdown: CompanyTenderFitBreakdown;
  readiness: TenderReadinessBreakdown;
  intelligence: TenderIntelligenceBreakdown;
  recommendation: TenderDecisionRecommendation;
  /** Always true for simulated branch. */
  isSimulated: true;
};

export type SimulationDiff = {
  decisionChanged: boolean;
  currentDecision: string;
  simulatedDecision: string;
  currentConfidence: ConfidenceLevel;
  simulatedConfidence: ConfidenceLevel;
  fitScoreDelta: number | null;
  readinessScoreDelta: number | null;
  blockersAdded: string[];
  blockersRemoved: string[];
  requirementsAffected: Array<{
    id: string;
    description: string;
    beforeStatus: RequirementMatchStatus;
    afterStatus: RequirementMatchStatus;
    readinessBefore: string | null;
    readinessAfter: string | null;
  }>;
  risksAffected: Array<{
    id: string;
    title: string;
    beforeSeverity: string | null;
    afterSeverity: string;
  }>;
  evidenceAffected: Array<{
    id: string;
    beforeStatus: string;
    afterStatus: string;
  }>;
  dependencyImpacts: SimulationDependencyImpact[];
  summaryReason: string;
  noDecisionChange: boolean;
  insufficientEvidence: boolean;
  insufficientEvidenceMessage: string | null;
};

export type DecisionSimulationResult = {
  /** Canonical persisted baseline — not re-run. */
  current: {
    decision: DecisionType | null;
    displayLabel: string;
    confidence: ConfidenceLevel;
    fitScore: number | null;
    readiness: TenderReadinessBreakdown | null;
    keyBlockers: string[];
    isSimulated: false;
  };
  simulated: SimulationStateView | null;
  diff: SimulationDiff;
  explanation: SimulationExplanation;
  evidenceProvenance: import("./evidence-provenance").EvidenceProvenanceRow[];
  minimalPath: MinimalImprovementPath | null;
  /** Populated when scenario comparison or quick-run was used. */
  scenarioComparison: ScenarioComparisonRow[] | null;
  appliedOverrides: SimulationOverrides;
  simulatedAt: string;
};

export type SimulationExplanation = {
  whatChanged: string[];
  factorsAffected: Array<{
    type: "requirement" | "risk" | "readiness" | "blocker";
    id: string;
    label: string;
    before: string;
    after: string;
  }>;
  rulesTriggered: Array<{ code: string; text: string; source: string }>;
  realEvidenceSupportingCurrentState: Array<{
    evidenceId: string;
    requirementId: string | null;
    provenance: "REAL";
    label: string;
  }>;
  stillMissing: string[];
  realWorldActionsRequired: string[];
  summary: string;
  memoryContext: string | null;
  requiresVerification: boolean;
  verificationNote: string | null;
};

export type MinimalImprovementPath = {
  targetLabel: string;
  achievable: boolean;
  changes: Array<{ label: string }>;
  combinedOverrides: SimulationOverrides | null;
  resultingDecision: DecisionType | null;
  resultingDisplayLabel: string | null;
  disclaimer: string;
};

export type ScenarioComparisonRow = {
  scenarioId: string;
  label: string;
  currentDecision: string;
  simulatedDecision: string;
  decisionChanged: boolean;
  summaryReason: string;
  requiresVerification: boolean;
};

export type SimulatableWorkflowTask = {
  id: string;
  title: string;
  requirementId: string | null;
  missingDocId: string | null;
  status: string;
  priority: string;
};

export type SimulatableRequirementOption = {
  id: string;
  description: string;
  category: string;
  mandatory: boolean;
  currentStatus: RequirementMatchStatus;
  currentReadinessStatus: string | null;
  allowedStatuses: RequirementMatchStatus[];
};

export type SimulatableFactorCatalog = {
  requirements: SimulatableRequirementOption[];
  evidence: Array<{
    id: string;
    requirementId: string | null;
    label: string;
    currentVerificationStatus: string;
  }>;
  missingDocuments: Array<{
    id: string;
    documentName: string;
  }>;
  profileFields: Array<{
    key: keyof NonNullable<SimulationOverrides["profile"]>;
    label: string;
    currentValue: string;
  }>;
  unavailableReason: string | null;
};
