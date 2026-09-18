/**
 * Map canonical analysis → tender detail view (presentation only).
 */

import { canMutateTenderAnalysis } from "@/auth/tender-access";
import type { CanonicalTenderAnalysis } from "@/domain/tender-intelligence";
import type { PremiumFeatureAccess } from "@/services/entitlements/intelligence-projection";
import { projectIntelligenceForEntitlements } from "@/services/entitlements/intelligence-projection";
import type { UserRole } from "@prisma/client";

type TenderShellDecision = {
  createdAt: Date;
};

export function mapTenderDetailFromCanonical(input: {
  canonical: CanonicalTenderAnalysis;
  premiumAccess: PremiumFeatureAccess;
  shellDecision: TenderShellDecision;
  role: UserRole;
}) {
  const { canonical, premiumAccess, shellDecision, role } = input;
  const intelligence = projectIntelligenceForEntitlements(
    canonical.intelligence,
    premiumAccess,
  );
  const topRisk =
    canonical.risks.find((r) => r.severity === "CRITICAL" || r.severity === "HIGH")
      ?.severity ??
    canonical.risks[0]?.severity ??
    null;

  return {
    id: canonical.tenderId,
    title: canonical.title,
    clientName: canonical.client,
    referenceCode: null,
    deadline: canonical.deadline,
    fitScore: canonical.fitScore,
    decision: canonical.decision,
    riskLevel: topRisk,
    analyzedAt: canonical.analyzedAt,
    nextAction: canonical.nextActions[0]?.title ?? null,
    status: canonical.analysisStatus,
    fileName: canonical.documentName,
    packageFiles: canonical.packageFiles ?? [],
    canonicalRequirementCount:
      canonical.canonicalRequirementCount ?? canonical.requirements.length,
    outcome: canonical.outcome,
    companyKnowledgeOnly: canonical.companyKnowledgeOnly === true,
    analysis: (() => {
      const scoringBlocked =
        canonical.fitBreakdown?.scoringAvailable === false ||
        canonical.companyKnowledgeOnly === true;
      return {
        fitScore: scoringBlocked ? null : canonical.fitScore,
        confidence: canonical.confidence,
        summaryWhy: canonical.reasoning,
        estimatedHoursSaved: scoringBlocked ? 0 : 5,
        fitBreakdown: canonical.fitBreakdown,
        readiness: canonical.readiness,
        intelligence,
      };
    })(),
    decisionDetail: canonical.decision
      ? {
          decision: canonical.decision,
          rationale: canonical.reasoning,
          decidedAt: shellDecision.createdAt.toISOString(),
          isAiSuggested: canonical.isAiSuggested,
        }
      : null,
    requirements: canonical.requirements.map((r) => ({
      id: r.id,
      title: r.description,
      description: r.category,
      status: r.status,
      evidence: r.evidence,
    })),
    risks: canonical.risks.map((r) => ({
      id: r.id,
      title: r.category,
      description: r.description,
      level: r.severity,
      mitigation: r.mitigation,
    })),
    missingDocuments: canonical.missingDocuments.map((d) => ({
      id: d.id,
      title: d.documentName,
      description: d.reason,
      required: d.severity === "HIGH" || d.severity === "CRITICAL",
    })),
    evidence: canonical.evidence.map((e) => ({
      id: e.id,
      label: e.sourceSection ?? "Evidence",
      excerpt: e.evidenceText,
      pageNumber: e.sourcePage,
      section: e.sourceSection,
    })),
    nextActions: canonical.nextActions.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      priority: a.priority,
      completed: a.completed,
    })),
    intelligence,
    historicalSignals: canonical.historicalSignals,
    bidScore:
      canonical.companyKnowledgeOnly ||
      canonical.fitBreakdown?.scoringAvailable === false
        ? null
        : canonical.bidScore,
    canMutate: canMutateTenderAnalysis(role),
  };
}
