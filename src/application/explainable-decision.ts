/**
 * Explainable Decision — read-only application access.
 */

import { requireCompanyId } from "@/auth/session";
import { assertCanViewTenderAnalysis } from "@/auth/tender-access";
import { getCanonicalTenderAnalysis } from "@/application/canonical-tender-analysis";
import type { CanonicalTenderAnalysis } from "@/domain/tender-intelligence";
import {
  assertDecisionExplanationConsistency,
  assertExplainableDecisionReadOnly,
  buildExplainableDecision,
  enrichExplainableDecision,
  type ExplainableDecision,
  type ExplainableDecisionView,
  type TeamWorkflowTaskInput,
} from "@/domain/explainable-decision";
import { assertAiAssistReadOnly } from "@/domain/ai-trust";
import { assertFeature } from "@/services/entitlements";
import type { PremiumFeatureAccess } from "@/services/entitlements/intelligence-projection";
import { AppError, ErrorCode } from "@/lib/errors";

/**
 * Build explainable decision from already-loaded canonical analysis.
 * Caller must enforce explainable_decision entitlement before invoking.
 */
export function buildExplainableDecisionFromCanonical(
  canonical: CanonicalTenderAnalysis,
  access: Pick<
    PremiumFeatureAccess,
    "explainableDecision" | "advancedAiTrust" | "evidenceIntelligence"
  >,
): ExplainableDecision {
  if (!access.explainableDecision) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Explainable Decision is not available on your plan.",
      403,
    );
  }

  const recommendation = canonical.intelligence?.tenderDecisionRecommendation;

  if (!recommendation) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      "Explainable decision is not available — tender analysis incomplete.",
      404,
    );
  }

  const explanation = buildExplainableDecision({
    recommendation,
    evidenceIntelligence: access.evidenceIntelligence
      ? (canonical.intelligence?.evidenceIntelligence ?? null)
      : null,
    complianceMatrix: canonical.intelligence?.complianceMatrix ?? [],
    risks: canonical.intelligence?.risks ?? [],
    readiness: canonical.readiness ?? null,
    memoryInsights: canonical.intelligence?.decisionMemoryInsights ?? null,
    aiTrust: access.advancedAiTrust ? (canonical.intelligence?.aiTrust ?? null) : null,
  });

  assertDecisionExplanationConsistency({
    storedDecision: canonical.decision,
    explanation,
  });

  return explanation;
}

export function buildExplainableDecisionViewFromCanonical(
  canonical: CanonicalTenderAnalysis,
  access: Pick<
    PremiumFeatureAccess,
    "explainableDecision" | "advancedAiTrust" | "evidenceIntelligence"
  >,
  teamTasks: TeamWorkflowTaskInput[] = [],
): ExplainableDecisionView {
  const explanation = buildExplainableDecisionFromCanonical(canonical, access);
  return enrichExplainableDecision(explanation, teamTasks);
}

export async function getExplainableDecisionForSession(
  tenderId: string,
): Promise<ExplainableDecision> {
  assertExplainableDecisionReadOnly("getExplainableDecisionForSession");
  assertAiAssistReadOnly("EXPLAINABLE_DECISION", "getExplainableDecisionForSession");

  const { auth, companyId } = await requireCompanyId();
  assertCanViewTenderAnalysis(auth.user.role);
  await assertFeature(companyId, "explainable_decision");

  const canonical = await getCanonicalTenderAnalysis(tenderId, companyId);
  const advancedTrust = await assertFeature(companyId, "advanced_ai_trust").then(
    () => true,
    () => false,
  );
  const evidenceAllowed = await assertFeature(companyId, "evidence_intelligence").then(
    () => true,
    () => false,
  );

  return buildExplainableDecisionFromCanonical(canonical, {
    explainableDecision: true,
    advancedAiTrust: advancedTrust,
    evidenceIntelligence: evidenceAllowed,
  });
}

export async function getExplainableDecisionViewForSession(
  tenderId: string,
  teamTasks: TeamWorkflowTaskInput[] = [],
): Promise<ExplainableDecisionView> {
  const explanation = await getExplainableDecisionForSession(tenderId);
  return enrichExplainableDecision(explanation, teamTasks);
}
