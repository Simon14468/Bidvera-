"use server";

import { requireCompanyId } from "@/auth/session";
import { assertCanViewTenderAnalysis } from "@/auth/tender-access";
import {
  compareDecisionSimulationScenarios,
  getDecisionSimulatorContext,
  runCombinedScenarioSimulation,
  runDecisionSimulation,
  runDecisionSimulationScenario,
} from "@/application/decision-simulator";
import type { SimulationOverrides } from "@/domain/decision-simulator";
import { AppError, ErrorCode } from "@/lib/errors";

export async function fetchDecisionSimulatorContextAction(tenderId: string) {
  const { companyId, auth } = await requireCompanyId();
  assertCanViewTenderAnalysis(auth.user.role);
  return getDecisionSimulatorContext(tenderId, companyId);
}

export async function runDecisionSimulationAction(
  tenderId: string,
  overrides: SimulationOverrides,
) {
  const { companyId, auth } = await requireCompanyId();
  assertCanViewTenderAnalysis(auth.user.role);

  if (!overrides || typeof overrides !== "object") {
    throw new AppError(ErrorCode.VALIDATION, "Simulation overrides are required.", 400);
  }

  return runDecisionSimulation(tenderId, companyId, auth.user.id, overrides);
}

export async function runDecisionSimulationScenarioAction(
  tenderId: string,
  scenarioId: string,
) {
  const { companyId, auth } = await requireCompanyId();
  assertCanViewTenderAnalysis(auth.user.role);
  return runDecisionSimulationScenario(tenderId, companyId, auth.user.id, scenarioId);
}

export async function compareDecisionSimulationScenariosAction(
  tenderId: string,
  scenarioIds?: string[],
) {
  const { companyId, auth } = await requireCompanyId();
  assertCanViewTenderAnalysis(auth.user.role);
  return compareDecisionSimulationScenarios(
    tenderId,
    companyId,
    auth.user.id,
    scenarioIds,
  );
}

export async function runCombinedScenarioSimulationAction(
  tenderId: string,
  scenarioIds: string[],
) {
  const { companyId, auth } = await requireCompanyId();
  assertCanViewTenderAnalysis(auth.user.role);
  return runCombinedScenarioSimulation(
    tenderId,
    companyId,
    auth.user.id,
    scenarioIds,
  );
}
