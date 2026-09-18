/**
 * Strip plan-gated intelligence fields before serializing to clients.
 * Stored DB data is preserved; access is gated at read boundaries.
 */

import type { TenderIntelligenceBreakdown } from "@/domain/tender-intelligence";
import { hasFeature } from "@/services/entitlements";
import { cache } from "react";

export type PremiumFeatureAccess = {
  decisionSimulator: boolean;
  evidenceIntelligence: boolean;
  explainableDecision: boolean;
  advancedAiTrust: boolean;
  tenderActionPlan: boolean;
};

/** Resolve all five premium feature flags for a company (server-side only). */
export const getPremiumFeatureAccess = cache(loadPremiumFeatureAccess);

async function loadPremiumFeatureAccess(
  companyId: string,
): Promise<PremiumFeatureAccess> {
  const [
    decisionSimulator,
    evidenceIntelligence,
    explainableDecision,
    advancedAiTrust,
    tenderActionPlan,
  ] = await Promise.all([
    hasFeature(companyId, "decision_simulator"),
    hasFeature(companyId, "evidence_intelligence"),
    hasFeature(companyId, "explainable_decision"),
    hasFeature(companyId, "advanced_ai_trust"),
    hasFeature(companyId, "tender_action_plan"),
  ]);
  return {
    decisionSimulator,
    evidenceIntelligence,
    explainableDecision,
    advancedAiTrust,
    tenderActionPlan,
  };
}

/** Remove premium intelligence blobs when the company is not entitled. */
export function projectIntelligenceForEntitlements(
  intelligence: TenderIntelligenceBreakdown | null | undefined,
  access: Pick<
    PremiumFeatureAccess,
    "evidenceIntelligence" | "advancedAiTrust" | "tenderActionPlan"
  >,
): TenderIntelligenceBreakdown | null {
  if (!intelligence) return null;
  const projected = { ...intelligence };
  if (!access.evidenceIntelligence) {
    projected.evidenceIntelligence = null;
    projected.verificationIntelligence = null;
  }
  if (!access.advancedAiTrust) {
    projected.aiTrust = null;
  }
  if (!access.tenderActionPlan) {
    projected.actionPlan = null;
  }
  return projected;
}
