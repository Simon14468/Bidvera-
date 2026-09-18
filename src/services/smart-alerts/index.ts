/**
 * Smart Alerts emitter — persists candidates via notificationService.
 * Observes analysis outcomes only; never mutates scores or decisions.
 */

import {
  buildPostAnalysisAlertCandidates,
  buildWorkflowAlertCandidate,
  priorSnapshotFromStored,
  type CurrentAnalysisSnapshot,
  type PriorAnalysisSnapshot,
} from "@/domain/smart-alerts";
import { notificationService } from "@/services/notifications";
import { logInfo } from "@/services/observability";
import type { DecisionType } from "@prisma/client";

export async function emitPostAnalysisSmartAlerts(input: {
  companyId: string;
  tenderId: string;
  title: string;
  decision: DecisionType;
  fitScore: number;
  bidScore: number | null;
  scoringAvailable: boolean;
  hasHighOrCriticalRisk: boolean;
  missingDocumentCount: number;
  compliance: CurrentAnalysisSnapshot["compliance"];
  decisionMemoryMatchIds: string[];
  decisionMemoryTopTitle: string | null;
  decisionMemoryTopLabel: string | null;
  prior: PriorAnalysisSnapshot | null;
  actionPlan?: {
    openCritical: number;
    openBlocking: number;
    deadlineDays: number | null;
  } | null;
}): Promise<number> {
  const { hasFeature } = await import("@/services/entitlements");
  const allowed = await hasFeature(input.companyId, "smart_alerts");
  if (!allowed) return 0;

  const candidates = buildPostAnalysisAlertCandidates(
    {
      companyId: input.companyId,
      tenderId: input.tenderId,
      title: input.title,
      decision: input.decision,
      fitScore: input.fitScore,
      bidScore: input.bidScore,
      scoringAvailable: input.scoringAvailable,
      hasHighOrCriticalRisk: input.hasHighOrCriticalRisk,
      missingDocumentCount: input.missingDocumentCount,
      compliance: input.compliance,
      decisionMemoryMatchIds: input.decisionMemoryMatchIds,
      decisionMemoryTopTitle: input.decisionMemoryTopTitle,
      decisionMemoryTopLabel: input.decisionMemoryTopLabel,
      actionPlanOpenCritical: input.actionPlan?.openCritical,
      actionPlanOpenBlocking: input.actionPlan?.openBlocking,
      actionPlanDeadlineDays: input.actionPlan?.deadlineDays ?? null,
    },
    input.prior,
  );

  let created = 0;
  for (const c of candidates) {
    await notificationService.createInAppAlert({
      companyId: input.companyId,
      tenderId: input.tenderId,
      type: c.type,
      title: c.title,
      message: c.message,
      href: c.href,
      scheduledFor: c.scheduledFor ?? null,
      dedupeKey: c.dedupeKey,
    });
    created += 1;
  }

  logInfo("smart_alerts.post_analysis", {
    companyId: input.companyId,
    tenderId: input.tenderId,
    candidates: candidates.length,
    types: candidates.map((c) => c.type),
  });

  return created;
}

export async function emitWorkflowSmartAlert(input: {
  companyId: string;
  tenderId: string;
  title: string;
  reason: "ONLY_AVIS" | "NO_REQUIREMENTS" | "COMPANY_KNOWLEDGE_ONLY" | string;
  message: string;
}): Promise<void> {
  const { hasFeature } = await import("@/services/entitlements");
  if (!(await hasFeature(input.companyId, "smart_alerts"))) return;

  const c = buildWorkflowAlertCandidate(input);
  await notificationService.createInAppAlert({
    companyId: input.companyId,
    tenderId: input.tenderId,
    type: c.type,
    title: c.title,
    message: c.message,
    href: c.href,
    dedupeKey: c.dedupeKey,
  });
}

export { priorSnapshotFromStored };
