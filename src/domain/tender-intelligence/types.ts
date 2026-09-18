import type { ReadinessPriority, ReadinessStatus } from "@/domain/decision/tender-readiness";
import type { ComplianceEvidenceState } from "@/domain/risk";
import type { SourceReference } from "@/domain/provenance";

export type SourceBasis =
  | "DIRECT_SOURCE"
  | "AI_INTERPRETATION"
  | "COMPANY_INFORMATION"
  | "UNKNOWN";

export type ComplianceRow = {
  id: string;
  requirementId: string;
  requirement: string;
  requirementType: string;
  mandatory: boolean;
  priority: ReadinessPriority;
  status: ReadinessStatus;
  /** Human-readable company fit note — not a verified fact */
  companyFit: string | null;
  sourceDocument: string | null;
  pageNumber: number | null;
  section: string | null;
  /** Real excerpt from tender document — tender source text (not company proof). */
  evidence: string | null;
  /** Canonical tender source provenance — shared web/PDF/API. */
  tenderSource: SourceReference | null;
  /** Canonical company evidence provenance — never tender text. */
  companyEvidence: SourceReference | null;
  /** Shown when companyEvidence is absent — never invent proof. */
  companyEvidenceMessage: string | null;
  notes: string | null;
  sourceBasis: SourceBasis;
  sourceLocated: boolean;
  evidenceId: string | null;
  /** Canonical evidence state — unknown ≠ confirmed risk. */
  evidenceState?: ComplianceEvidenceState;
  /** Confirmed risk note only when evidenceState is CONFIRMED_NON_COMPLIANT. */
  risk: string | null;
  /** Concrete next step when status is not READY / NOT_APPLICABLE */
  requiredAction: string | null;
  /** Evidence verification intelligence — derived from canonical evidence chain */
  verificationStatus?: import("@/domain/evidence-verification").RequirementVerificationStatus;
  verificationReason?: string | null;
  locationLabel?: string | null;
  verifierLabel?: string | null;
  verifiedAt?: string | null;
};

/** Dynamic counts from the analyzed matrix — never hardcoded demo values */
export type ComplianceSummary = {
  totalRequirements: number;
  ready: number;
  missing: number;
  verify: number;
  notApplicable: number;
  unknown: number;
  /** Rows with a precisely located tender source */
  sources: number;
  /** Rows with a confirmed HIGH/CRITICAL identified risk (not unknown/verify counts). */
  risks: number;
  /** Rows with a required action */
  requiredActions: number;
  /** Clarification questions linked to this analysis */
  clarifications: number;
  /** Explicit aliases — never replace totalRequirements with these. */
  verifiedRequirements?: number;
  needsVerification?: number;
  confirmedGaps?: number;
};

export type StructuredRisk = {
  id: string;
  title: string;
  category: string;
  /** Legacy display severity (CRITICAL mapped to HIGH for older UI paths). */
  severity: "HIGH" | "MEDIUM" | "LOW";
  /** Canonical severity including CRITICAL. */
  severityCanonical?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  requirementId?: string | null;
  linkedRequirementIds?: string[];
  evidenceState?: ComplianceEvidenceState;
  fitStatus?: import("@/domain/decision/requirement-fit-status").RequirementFitStatus | null;
  riskCategory?: import("@/domain/risk").RiskCategory;
  underlyingKey?: string;
  verificationState?: import("@/domain/evidence-verification").RequirementVerificationStatus;
  whyRisky?: string;
  explanation: string;
  impact: string;
  recommendedAction: string;
  source: {
    document: string | null;
    page: number | null;
    section: string | null;
    excerpt: string | null;
    basis: SourceBasis;
    located: boolean;
  };
};

export type ContradictionFinding = {
  id: string;
  title: string;
  description: string;
  items: string[];
  recommendedAction: string;
};

import type { SimilarCompanyLearningSignal } from "@/domain/learning";
import type { DecisionMemoryInsightsBundle } from "@/domain/decision-memory";

export type ClarificationQuestion = {
  id: string;
  question: string;
  reason: string;
  source: string;
  category: string;
  priority: ReadinessPriority;
};

export type ExtractionGateState = {
  status: "blocked" | "valid";
  reason: string | null;
  message: string | null;
};

export type TenderIntelligenceBreakdown = {
  /** TENDER = normal analysis; COMPANY_KNOWLEDGE_ONLY = profile ingest with no tender scoring. */
  analysisMode?: "TENDER" | "COMPANY_KNOWLEDGE_ONLY";
  /** COMPLETE when compliance matrix reflects extracted requirements; INCOMPLETE when extraction gate blocked. */
  complianceStatus?: "COMPLETE" | "INCOMPLETE";
  extractionGate?: ExtractionGateState;
  complianceMatrix: ComplianceRow[];
  complianceSummary: ComplianceSummary;
  risks: StructuredRisk[];
  contradictions: ContradictionFinding[];
  clarificationQuestions: ClarificationQuestion[];
  /** Confirmed material obstacles only (CONFIRMED_GAP / confirmed non-compliance). */
  keyBlockers: string[];
  /** Unresolved verification / uncertainty — never hard blockers. */
  reviewItems?: string[];
  /** Contextual factors influencing CONDITIONAL GO — not confirmed failures. */
  decisionDrivers?: string[];
  /** Operational follow-ups (team tasks, etc.). */
  actionItems?: string[];
  decisionContext: string;
  /** Privacy-safe similar-company learning signal.
   * Probabilistic only — never identifies peers; current evidence always wins.
   * Only VERIFIED/ACTIVE patterns with influenceAllowed may inform recommendations.
   */
  learningSignal: SimilarCompanyLearningSignal | null;
  /**
   * Company-private Decision Memory insights — reference only.
   * Never changes Current Analysis scores or recommendation.
   */
  decisionMemoryInsights?: DecisionMemoryInsightsBundle | null;
  /**
   * Recorded real-world outcomes on similar prior tenders — advisory only.
   * Never changes scores or recommendation.
   */
  outcomeLearningInsights?: import("@/domain/decision-outcome-learning").OutcomeLearningInsightsBundle | null;
  /**
   * Requirement → Evidence → Verification traceability (canonical dataset only).
   */
  verificationIntelligence?: import("@/domain/evidence-verification").VerificationIntelligenceBundle | null;
  /**
   * Evidence Intelligence — requirement → evidence → source → verification → readiness/decision impact.
   * Derived view; never a parallel requirement or evidence store.
   */
  evidenceIntelligence?: import("@/domain/evidence-intelligence").EvidenceIntelligenceBundle | null;
  /**
   * Explainable Tender Decision Engine recommendation (GO / CONDITIONAL GO / NO-BID).
   * Structured reasons, blockers, evidence, and factors — never invents data.
   */
  tenderDecisionRecommendation?: import("@/domain/decision/recommendation").TenderDecisionRecommendation | null;
  /** Important tender facts with source provenance when available. */
  tenderFactsProvenance?: import("@/domain/provenance").TenderFactProvenance[] | null;
  /**
   * AI Trust & Security snapshot — advisory anomaly signal from tender PDF scan.
   * Never changes requirements, evidence, or decision.
   */
  aiTrust?: import("@/domain/ai-trust").PipelineTrustSnapshot | null;
  /**
   * Tender Action Plan — traceable next steps from unresolved requirements, evidence, risks, readiness.
   * Derived projection; completing actions does not directly change the decision enum.
   */
  actionPlan?: import("@/domain/tender-action-plan").TenderActionPlanBundle | null;
  /**
   * Decision Validation Guardian release snapshot — required for full tender Web/PDF publication.
   * Set only after assertFinalReleaseIntegrity succeeds. Never invent ok:true.
   */
  decisionGuardian?: import("@/domain/decision-validation").DecisionGuardianSnapshot | null;
  /**
   * Frozen canonical analysis snapshot — single source of truth for counts, metadata, inventory.
   */
  canonicalSnapshot?: import("./canonical-snapshot").CanonicalAnalysisSnapshot | null;
  /**
   * Universal Tender Intelligence Layer summary — package normalization before Decision/Risk.
   * Advisory inventory/role/version signal; does not replace canonical requirements.
   */
  universalTenderIntelligence?: import("@/domain/universal-tender-intelligence").UniversalTenderIntelligenceSummary | null;
  /**
   * Phase 3 — Evidence & consistency integrity attestation frozen before COMPLETE.
   */
  analysisIntegrity?: import("@/domain/analysis-integrity").AnalysisIntegrityAttestation | null;
  /**
   * Phase 4 — Universal tender certification result. Required before COMPLETED.
   */
  tenderCertification?: import("@/domain/tender-certification").TenderCertificationResult | null;
  /**
   * Super-Admin / development diagnostics only — stripped from customer report payloads.
   */
  analysisTrace?: unknown;
};

