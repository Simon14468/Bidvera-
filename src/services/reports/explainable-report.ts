/**
 * Bridge Explainable Decision into report/PDF — read-only projection from TenderReport.
 */

import {
  assertDecisionExplanationConsistency,
  assertExplainableDecisionIntegrity,
  buildExplainableDecision,
  type ExplainableDecision,
} from "@/domain/explainable-decision";
import type { TenderReport } from "@/services/reports/types";

export function deriveExplainableDecisionForReport(
  report: TenderReport,
  options?: { includeAdvancedAiTrust?: boolean; includeEvidenceIntelligence?: boolean },
): ExplainableDecision | null {
  if (report.companyKnowledgeOnly) return null;

  const recommendation = report.intelligence?.tenderDecisionRecommendation;
  if (!recommendation) return null;

  const includeAdvancedAiTrust = options?.includeAdvancedAiTrust === true;
  const includeEvidenceIntelligence = options?.includeEvidenceIntelligence === true;

  const explanation = buildExplainableDecision({
    recommendation,
    evidenceIntelligence: includeEvidenceIntelligence
      ? (report.intelligence?.evidenceIntelligence ?? null)
      : null,
    complianceMatrix: report.intelligence?.complianceMatrix ?? [],
    risks: report.intelligence?.risks ?? [],
    readiness: report.readiness ?? null,
    memoryInsights: report.intelligence?.decisionMemoryInsights ?? null,
    aiTrust: includeAdvancedAiTrust ? (report.intelligence?.aiTrust ?? null) : null,
  });

  assertExplainableDecisionIntegrity(explanation);

  if (report.decision) {
    assertDecisionExplanationConsistency({
      storedDecision: report.decision,
      explanation,
    });
  }

  return explanation;
}
