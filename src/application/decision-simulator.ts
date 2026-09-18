/**
 * Application layer — read-only Decision Simulator.
 * Loads canonical tender state, runs in-memory simulation, never mutates DB.
 */

import { getCanonicalTenderAnalysis } from "@/application/canonical-tender-analysis";
import { assertAiAssistReadOnly } from "@/domain/ai-trust";
import { assertFeature } from "@/services/entitlements";
import { toRuleProfile } from "@/domain/decision/types";
import {
  buildQuickScenarios,
  buildSimulatableFactorCatalog,
  buildSimulationSnapshot,
  compareSimulationScenarios,
  findMinimalImprovementPath,
  overridesFromScenarioIds,
  runScenarioById,
  simulateTenderDecision,
  validateSimulationOverrides,
  type DecisionSimulationResult,
  type MinimalImprovementPath,
  type ScenarioComparisonResult,
  type SimulationOverrides,
  type SimulationQuickScenario,
  type SimulatableFactorCatalog,
} from "@/domain/decision-simulator";
import { logInfo } from "@/services/observability";
import { AppError, ErrorCode } from "@/lib/errors";
import { prisma } from "@/lib/db";

function assertSimulatorTrust(context: string): void {
  assertAiAssistReadOnly("DECISION_SIMULATOR", context);
}

async function assertDecisionSimulatorEntitlement(companyId: string): Promise<void> {
  await assertFeature(companyId, "decision_simulator");
}

async function consumeSimulatorQuota(companyId: string, tenderId?: string) {
  const { consumeAiQuota } = await import("@/services/entitlements/ai-quota");
  await consumeAiQuota({
    companyId,
    tenderId,
    task: "FINAL_REASONING",
    operation: "decision_simulator",
  });
}

export type DecisionSimulatorContext = {
  catalog: SimulatableFactorCatalog;
  currentDecision: string;
  currentConfidence: string;
  fitScore: number | null;
  readinessScore: number | null;
  blockerCount: number;
  quickScenarios: SimulationQuickScenario[];
  minimalPathPreview: MinimalImprovementPath | null;
  memoryNote: string | null;
  unavailableReason: string | null;
};

async function loadWorkflowTasks(companyId: string, tenderId: string) {
  return prisma.teamWorkflowTask.findMany({
    where: {
      companyId,
      tenderId,
      status: { notIn: ["CANCELLED"] },
    },
    select: {
      id: true,
      title: true,
      requirementId: true,
      missingDocId: true,
      status: true,
      priority: true,
    },
    take: 50,
  });
}

async function loadSimulationSnapshot(
  tenderId: string,
  companyId: string,
  canonical: Awaited<ReturnType<typeof getCanonicalTenderAnalysis>>,
) {
  const tender = await prisma.tender.findFirst({
    where: { id: tenderId, companyId },
    include: {
      company: { include: { profile: true } },
      documents: { take: 1, orderBy: { createdAt: "asc" } },
    },
  });
  if (!tender) {
    throw new AppError(ErrorCode.NOT_FOUND, "Tender not found.", 404);
  }

  const profile = toRuleProfile(tender.company.profile, tender.company.name);
  const intelligence = canonical.intelligence;
  const workflowTasks = await loadWorkflowTasks(companyId, tenderId);

  let teamWorkflow: Awaited<ReturnType<typeof import("@/services/team-workflow").getTenderWorkflowSummary>> | null =
    null;
  try {
    const { getTenderWorkflowSummary } = await import("@/services/team-workflow");
    teamWorkflow = await getTenderWorkflowSummary({ companyId, tenderId });
  } catch {
    teamWorkflow = null;
  }

  return buildSimulationSnapshot({
    canonical,
    profile,
    country: tender.country,
    industry: tender.industry,
    estimatedValue: tender.estimatedValue,
    extractedText: tender.documents[0]?.extractedText ?? "",
    memoryInsights: intelligence.decisionMemoryInsights ?? null,
    teamWorkflow,
    workflowTasks: workflowTasks.map((t) => ({
      id: t.id,
      title: t.title,
      requirementId: t.requirementId,
      missingDocId: t.missingDocId,
      status: t.status,
      priority: t.priority,
    })),
  });
}

/**
 * Load simulator context for UI — read-only, no simulation run.
 */
export async function getDecisionSimulatorContext(
  tenderId: string,
  companyId: string,
): Promise<DecisionSimulatorContext> {
  assertSimulatorTrust("getDecisionSimulatorContext");
  await assertDecisionSimulatorEntitlement(companyId);
  const canonical = await getCanonicalTenderAnalysis(tenderId, companyId);
  const snapshot = await loadSimulationSnapshot(tenderId, companyId, canonical);
  const catalog = buildSimulatableFactorCatalog(snapshot);
  const workflowTasks = snapshot.workflowTasks;
  const quickScenarios = buildQuickScenarios(snapshot, workflowTasks);
  const minimalPathPreview = catalog.unavailableReason
    ? null
    : findMinimalImprovementPath(snapshot);

  const memory = snapshot.memoryInsights?.matches?.[0];

  return {
    catalog,
    currentDecision: snapshot.baselineDisplayLabel,
    currentConfidence: snapshot.baselineConfidence,
    fitScore: snapshot.baselineFitScore,
    readinessScore: snapshot.baselineReadiness?.score ?? null,
    blockerCount: snapshot.baselineIntelligence.keyBlockers?.length ?? 0,
    quickScenarios,
    minimalPathPreview,
    memoryNote: memory
      ? `Historical reference: ${memory.title} (${memory.decisionLabel}) — does not override current evidence.`
      : null,
    unavailableReason: catalog.unavailableReason,
  };
}

function recordSimulationAudit(input: {
  companyId: string;
  userId: string;
  tenderId: string;
  decisionChanged: boolean;
  scenarioIds?: string[];
}) {
  logInfo("decision_simulator.run", {
    companyId: input.companyId,
    userId: input.userId,
    tenderId: input.tenderId,
    decisionChanged: input.decisionChanged,
    scenarioIds: input.scenarioIds ?? [],
    simulated: true,
  });
}

/**
 * Run a what-if simulation — strictly in-memory, never persists tender state.
 * Does NOT emit Smart Alerts.
 */
export async function runDecisionSimulation(
  tenderId: string,
  companyId: string,
  userId: string,
  overrides: SimulationOverrides,
): Promise<DecisionSimulationResult> {
  assertSimulatorTrust("runDecisionSimulation");
  await assertDecisionSimulatorEntitlement(companyId);
  await consumeSimulatorQuota(companyId, tenderId);
  const canonical = await getCanonicalTenderAnalysis(tenderId, companyId);
  const snapshot = await loadSimulationSnapshot(tenderId, companyId, canonical);

  const validation = validateSimulationOverrides(snapshot, overrides);
  if (!validation.ok) {
    throw new AppError(ErrorCode.VALIDATION, validation.reason, 400);
  }

  const result = simulateTenderDecision(snapshot, overrides, { includeMinimalPath: true });
  recordSimulationAudit({
    companyId,
    userId,
    tenderId,
    decisionChanged: result.diff.decisionChanged,
  });
  return result;
}

export async function runDecisionSimulationScenario(
  tenderId: string,
  companyId: string,
  userId: string,
  scenarioId: string,
): Promise<DecisionSimulationResult> {
  assertSimulatorTrust("runDecisionSimulationScenario");
  await assertDecisionSimulatorEntitlement(companyId);
  await consumeSimulatorQuota(companyId, tenderId);
  const canonical = await getCanonicalTenderAnalysis(tenderId, companyId);
  const snapshot = await loadSimulationSnapshot(tenderId, companyId, canonical);
  const scenarios = buildQuickScenarios(snapshot, snapshot.workflowTasks);
  const result = runScenarioById(snapshot, scenarios, scenarioId);
  if (!result) {
    throw new AppError(ErrorCode.NOT_FOUND, "Simulation scenario not found.", 404);
  }
  recordSimulationAudit({
    companyId,
    userId,
    tenderId,
    decisionChanged: result.diff.decisionChanged,
    scenarioIds: [scenarioId],
  });
  return result;
}

export async function compareDecisionSimulationScenarios(
  tenderId: string,
  companyId: string,
  userId: string,
  scenarioIds?: string[],
): Promise<ScenarioComparisonResult> {
  assertSimulatorTrust("compareDecisionSimulationScenarios");
  await assertDecisionSimulatorEntitlement(companyId);
  await consumeSimulatorQuota(companyId, tenderId);
  const canonical = await getCanonicalTenderAnalysis(tenderId, companyId);
  const snapshot = await loadSimulationSnapshot(tenderId, companyId, canonical);
  const scenarios = buildQuickScenarios(snapshot, snapshot.workflowTasks);
  const selected =
    scenarioIds && scenarioIds.length > 0
      ? scenarios.filter((s) => scenarioIds.includes(s.id))
      : scenarios.slice(0, 3);

  const comparison = compareSimulationScenarios(snapshot, selected);
  recordSimulationAudit({
    companyId,
    userId,
    tenderId,
    decisionChanged: comparison.rows.some((r) => r.decisionChanged),
    scenarioIds: selected.map((s) => s.id),
  });
  return comparison;
}

export async function runCombinedScenarioSimulation(
  tenderId: string,
  companyId: string,
  userId: string,
  scenarioIds: string[],
): Promise<DecisionSimulationResult> {
  assertSimulatorTrust("runCombinedScenarioSimulation");
  await assertDecisionSimulatorEntitlement(companyId);
  await consumeSimulatorQuota(companyId, tenderId);
  const canonical = await getCanonicalTenderAnalysis(tenderId, companyId);
  const snapshot = await loadSimulationSnapshot(tenderId, companyId, canonical);
  const scenarios = buildQuickScenarios(snapshot, snapshot.workflowTasks);
  const overrides = overridesFromScenarioIds(scenarios, scenarioIds);
  if (!overrides) {
    throw new AppError(ErrorCode.VALIDATION, "No valid scenarios selected.", 400);
  }
  return runDecisionSimulation(tenderId, companyId, userId, overrides);
}
