/**
 * Tender Action Plan — read-only application access with permission checks.
 */

import { requireCompanyId } from "@/auth/session";
import { assertCanViewTenderAnalysis } from "@/auth/tender-access";
import { getCanonicalTenderAnalysis } from "@/application/canonical-tender-analysis";
import { assertAiAssistReadOnly } from "@/domain/ai-trust";
import { assertTenantResourceScope } from "@/domain/ai-trust/client-guard";
import {
  assertTenderActionPlanReadOnly,
  buildTenderActionPlan,
  TENDER_ACTION_PLAN_INVARIANTS,
  type TenderActionPlanBundle,
  type TenderActionSimulationHint,
} from "@/domain/tender-action-plan";
import { AppError, ErrorCode } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { assertFeature } from "@/services/entitlements";

function assertActionPlanTrust(context: string): void {
  assertTenderActionPlanReadOnly(context);
  assertAiAssistReadOnly("TENDER_ACTION_PLAN", context);
}

/**
 * Load stored Action Plan from canonical tender analysis.
 */
export async function getTenderActionPlanForSession(
  tenderId: string,
): Promise<TenderActionPlanBundle> {
  assertActionPlanTrust("getTenderActionPlanForSession");

  const { auth, companyId } = await requireCompanyId();
  assertCanViewTenderAnalysis(auth.user.role);
  await assertFeature(companyId, "tender_action_plan");

  const canonical = await getCanonicalTenderAnalysis(tenderId, companyId);
  assertTenantResourceScope({
    resourceCompanyId: canonical.companyId,
    sessionCompanyId: companyId,
    resourceLabel: "tender",
  });

  const bundle = canonical.intelligence?.actionPlan;
  if (!bundle?.computed) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      "Tender Action Plan is not available for this tender yet.",
      404,
    );
  }

  return bundle;
}

/**
 * Optional: enrich stored plan with Decision Simulator hints (SIMULATION ONLY).
 * Never mutates stored canonical state.
 */
export async function getTenderActionPlanWithSimulationHints(
  tenderId: string,
  simulationHints: TenderActionSimulationHint[],
): Promise<TenderActionPlanBundle> {
  assertActionPlanTrust("getTenderActionPlanWithSimulationHints");

  const { auth, companyId } = await requireCompanyId();
  assertCanViewTenderAnalysis(auth.user.role);
  await assertFeature(companyId, "tender_action_plan");

  const canonical = await getCanonicalTenderAnalysis(tenderId, companyId);
  assertTenantResourceScope({
    resourceCompanyId: canonical.companyId,
    sessionCompanyId: companyId,
    resourceLabel: "tender",
  });

  if (!canonical.intelligence?.actionPlan?.computed) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      "Tender Action Plan is not available for this tender yet.",
      404,
    );
  }

  const teamTasks = await prisma.teamWorkflowTask.findMany({
    where: {
      companyId,
      tenderId,
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      requirementId: true,
      riskId: true,
      missingDocId: true,
      department: true,
      deadline: true,
    },
  });

  return buildTenderActionPlan({
    tenderId,
    companyId,
    tenderDeadline: canonical.deadline ? new Date(canonical.deadline) : null,
    complianceMatrix: canonical.intelligence.complianceMatrix,
    evidenceIntelligence: canonical.intelligence.evidenceIntelligence,
    risks: canonical.intelligence.risks,
    keyBlockers: canonical.intelligence.keyBlockers,
    readiness: canonical.readiness ?? { attention: [], items: [] },
    fitBreakdown: canonical.fitBreakdown,
    recommendation: canonical.intelligence.tenderDecisionRecommendation,
    teamTasks: teamTasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      requirementId: t.requirementId,
      riskId: t.riskId,
      missingDocId: t.missingDocId,
      department: t.department,
      deadline: t.deadline,
    })),
    simulationHints,
    previousPlan: canonical.intelligence.actionPlan,
  });
}

export { TENDER_ACTION_PLAN_INVARIANTS };
