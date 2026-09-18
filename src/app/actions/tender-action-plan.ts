"use server";

import { requireCompanyId } from "@/auth/session";
import { assertCanViewTenderAnalysis } from "@/auth/tender-access";
import {
  getTenderActionPlanForSession,
  getTenderActionPlanWithSimulationHints,
  TENDER_ACTION_PLAN_INVARIANTS,
} from "@/application/tender-action-plan";
import type { TenderActionSimulationHint } from "@/domain/tender-action-plan";

export async function fetchTenderActionPlanAction(tenderId: string) {
  const { auth } = await requireCompanyId();
  assertCanViewTenderAnalysis(auth.user.role);
  try {
    const bundle = await getTenderActionPlanForSession(tenderId);
    return { ok: true as const, data: bundle };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Action plan unavailable.",
    };
  }
}

export async function fetchTenderActionPlanWithSimulationAction(
  tenderId: string,
  simulationHints: TenderActionSimulationHint[],
) {
  const { auth } = await requireCompanyId();
  assertCanViewTenderAnalysis(auth.user.role);
  try {
    const bundle = await getTenderActionPlanWithSimulationHints(tenderId, simulationHints);
    return { ok: true as const, data: bundle };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Action plan unavailable.",
    };
  }
}

export { TENDER_ACTION_PLAN_INVARIANTS };
