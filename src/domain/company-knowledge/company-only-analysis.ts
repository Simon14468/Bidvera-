/**
 * Company-profile-only analysis payload.
 * COMPANY KNOWLEDGE ≠ TENDER ANALYSIS — never runs the decision engine.
 */

import type { BidScoreBreakdown } from "@/domain/bid-score";
import type { CompanyTenderFitBreakdown } from "@/domain/decision/company-fit";
import type { TenderReadinessBreakdown } from "@/domain/decision/tender-readiness";
import type { TenderIntelligenceBreakdown } from "@/domain/tender-intelligence";
import {
  assertKnowledgeInvariants,
  buildCompanyOnlyTrace,
} from "./invariants";
import type { CompanyKnowledge } from "./types";
import { COMPANY_ONLY_MESSAGE } from "./types";

export type CompanyKnowledgeOnlyPayload = {
  /** Always null — no Bid / No-Bid / Review recommendation for company-only. */
  decision: null;
  confidence: "LOW";
  reasoning: string;
  /** DB placeholder only — never shown as a scored Fit %. */
  fitScoreDb: number;
  fitBreakdown: CompanyTenderFitBreakdown;
  readiness: TenderReadinessBreakdown;
  intelligence: TenderIntelligenceBreakdown;
  bidScore: BidScoreBreakdown;
  companyKnowledgeOnly: true;
};

/**
 * Build the company-knowledge-only completion payload.
 * Does NOT call runDecisionEngine, computeCompanyTenderFit, or bid-score formulas.
 */
export function buildCompanyKnowledgeOnlyAnalysis(input: {
  knowledge: CompanyKnowledge;
  fileName: string;
}): CompanyKnowledgeOnlyPayload {
  const { knowledge, fileName } = input;
  const invariants = assertKnowledgeInvariants({
    documentKind: knowledge.documentKind,
    knowledge,
    requirementsCount: 0,
  });
  const trace = buildCompanyOnlyTrace(knowledge);

  const fitBreakdown: CompanyTenderFitBreakdown = {
    scoringAvailable: false,
    companyKnowledgeOnly: true,
    overall: null,
    dimensions: [],
    matches: [],
    gaps: [],
    unknowns: [COMPANY_ONLY_MESSAGE],
    attention: [COMPANY_ONLY_MESSAGE],
    recommendation: COMPANY_ONLY_MESSAGE,
  };

  const readiness: TenderReadinessBreakdown = {
    scoringAvailable: false,
    companyKnowledgeOnly: true,
    score: null,
    total: 0,
    counts: {
      ready: 0,
      missing: 0,
      verify: 0,
      unknown: 0,
      notApplicable: 0,
    },
    items: [],
    attention: [COMPANY_ONLY_MESSAGE],
    recommendation: COMPANY_ONLY_MESSAGE,
    disclaimer:
      "Tender Readiness: not applicable — no tender requirements are available for this company-knowledge upload.",
  };

  const intelligence: TenderIntelligenceBreakdown = {
    analysisMode: "COMPANY_KNOWLEDGE_ONLY",
    complianceStatus: "INCOMPLETE",
    complianceMatrix: [],
    complianceSummary: {
      totalRequirements: 0,
      ready: 0,
      missing: 0,
      verify: 0,
      notApplicable: 0,
      unknown: 0,
      sources: 0,
      risks: 0,
      requiredActions: 0,
      clarifications: 0,
    },
    risks: [],
    contradictions: [],
    clarificationQuestions: [],
    keyBlockers: [],
    decisionContext: [
      COMPANY_ONLY_MESSAGE,
      "",
      `Document classified as ${knowledge.documentKind} (confidence ${knowledge.classificationConfidence}).`,
      `Extracted: ${knowledge.services.length} services, ${knowledge.projects.length} projects, ${knowledge.certifications.length} compliance items, ${knowledge.historicalOutcomes.length} historical outcomes.`,
      invariants.ok
        ? "Invariants: OK"
        : `Invariant violations: ${invariants.violations.join("; ")}`,
      `Source: ${fileName}`,
    ].join("\n"),
    learningSignal: null,
    analysisTrace: trace,
  };

  const bidScore: BidScoreBreakdown = {
    scoringAvailable: false,
    score: 0,
    priority: "VERY_LOW",
    priorityLabel: "UNAVAILABLE",
    interpretation: COMPANY_ONLY_MESSAGE,
    expectedValue: "UNKNOWN",
    expectedValueNote:
      "Expected Value: UNKNOWN — company knowledge only; no tender was analyzed.",
    contractValue: null,
    contractValueLabel: "Contract value: Not applicable (no tender).",
    contractValueProvenance: "UNKNOWN",
    pursuitCost: null,
    pursuitCostLabel: "Pursuit cost: Not applicable (no tender).",
    pursuitCostProvenance: "UNKNOWN",
    winProbabilityLabel: "Win probability: Not applicable (no tender).",
    winProbabilityProvenance: "UNKNOWN",
    effort: "UNKNOWN",
    effortNote: "Effort: Not applicable — no tender requirements to score.",
    riskLevel: "UNKNOWN",
    drivers: [],
    reducedCertainty: true,
    certaintyNote: "Bid Score: UNAVAILABLE — company profile only; decision analysis was not run.",
    disclaimer: COMPANY_ONLY_MESSAGE,
  };

  return {
    decision: null,
    confidence: "LOW",
    reasoning: COMPANY_ONLY_MESSAGE,
    fitScoreDb: 0,
    fitBreakdown,
    readiness,
    intelligence,
    bidScore,
    companyKnowledgeOnly: true,
  };
}

export function isCompanyKnowledgeOnlyAnalysis(
  fitBreakdown: CompanyTenderFitBreakdown | null | undefined,
  intelligence?: TenderIntelligenceBreakdown | null,
): boolean {
  if (fitBreakdown?.companyKnowledgeOnly === true) return true;
  if (intelligence?.analysisMode === "COMPANY_KNOWLEDGE_ONLY") return true;
  return false;
}
