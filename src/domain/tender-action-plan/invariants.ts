/**
 * Tender Action Plan invariants — derived read-only projection.
 * Completing actions must never directly mutate the decision enum.
 */

export const TENDER_ACTION_PLAN_INVARIANTS = {
  readOnly: true,
  mutatesDecision: false,
  mutatesRequirements: false,
  mutatesEvidence: false,
  clientCompletionTrusted: false,
  simulationIsolated: true,
} as const;

export function assertTenderActionPlanReadOnly(context: string): void {
  if (!TENDER_ACTION_PLAN_INVARIANTS.readOnly) {
    throw new Error(`Tender Action Plan must remain read-only (${context}).`);
  }
}

export function assertActionPlanDoesNotMutateDecision(context: string): void {
  if (TENDER_ACTION_PLAN_INVARIANTS.mutatesDecision) {
    throw new Error(`Tender Action Plan must not mutate decision (${context}).`);
  }
}

/** Reject client attempts to mark actions complete or override canonical fields. */
export function rejectClientProvidedActionTransition(input: {
  clientStatus?: unknown;
  serverStatus: string;
  context?: string;
}): void {
  if (input.clientStatus == null || input.clientStatus === "") return;
  const allowed = ["OPEN", "IN_PROGRESS"];
  if (
    String(input.clientStatus) !== String(input.serverStatus) &&
    !allowed.includes(String(input.clientStatus))
  ) {
    throw new Error(
      `${input.context ?? "action-plan-guard"}: client-provided action status rejected — authoritative transitions are server-side only.`,
    );
  }
}

export function rejectClientProvidedActionPriority(input: {
  clientPriority?: unknown;
  serverPriority: string;
  context?: string;
}): void {
  if (input.clientPriority == null || input.clientPriority === "") return;
  if (String(input.clientPriority) !== String(input.serverPriority)) {
    throw new Error(
      `${input.context ?? "action-plan-guard"}: client-provided action priority rejected.`,
    );
  }
}

export function rejectClientProvidedActionSource(input: {
  clientSourceId?: unknown;
  serverSourceId: string;
  context?: string;
}): void {
  if (input.clientSourceId == null || input.clientSourceId === "") return;
  if (String(input.clientSourceId) !== String(input.serverSourceId)) {
    throw new Error(
      `${input.context ?? "action-plan-guard"}: client-provided action source rejected.`,
    );
  }
}

export function assertNoFabricatedActions(items: Array<{ sourceId: string; title: string }>): void {
  for (const item of items) {
    if (!item.sourceId?.trim()) {
      throw new Error(`Action plan invariant violated: missing sourceId for "${item.title}".`);
    }
  }
}

/** Pre-completion gate: one primary action per canonical requirement, verification ≠ blocking. */
export function assertActionPlanIntegrity(input: {
  canonicalRequirementCount: number;
  actionPlan: { items: Array<{
    linkedRequirementId: string | null;
    blocking: boolean;
    sourceType: string;
    title: string;
    simulationOnly?: boolean;
  }> };
  hardBlockerCount?: number;
}): void {
  const active = input.actionPlan.items.filter(
    (i) => !i.simulationOnly && i.sourceType !== "APPROACHING_DEADLINE" && i.sourceType !== "DECISION_SIMULATOR",
  );

  const byReq = new Map<string, number>();
  for (const item of active) {
    if (!item.linkedRequirementId) continue;
    byReq.set(item.linkedRequirementId, (byReq.get(item.linkedRequirementId) ?? 0) + 1);
  }

  for (const [reqId, count] of byReq) {
    if (count > 1) {
      throw new Error(
        `Action plan duplicate primary actions for requirement ${reqId} (${count} actions)`,
      );
    }
  }

  const verifyBlocking = active.filter(
    (i) =>
      i.blocking &&
      (i.sourceType === "UNVERIFIED_EVIDENCE" ||
        i.sourceType === "READINESS_BLOCKER" ||
        /verification required/i.test(i.title)),
  );
  if (verifyBlocking.length > 0 && (input.hardBlockerCount ?? 0) === 0) {
    throw new Error(
      `Verification-only actions marked blocking without hard blockers (${verifyBlocking.length})`,
    );
  }

  const linkedCount = new Set(
    active.map((i) => i.linkedRequirementId).filter(Boolean),
  ).size;
  if (linkedCount > input.canonicalRequirementCount) {
    throw new Error(
      `Action plan references more requirements (${linkedCount}) than canonical set (${input.canonicalRequirementCount})`,
    );
  }
}
