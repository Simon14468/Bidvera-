/**
 * Decision Simulator — read-only what-if analysis for tender decisions.
 */

export {
  applySimulationOverrides,
  validateSimulationOverrides,
} from "./apply-overrides";
export type { AppliedSimulationState } from "./apply-overrides";
export {
  assembleNoChangeResult,
  assembleSimulationResult,
  buildSimulationDiff,
} from "./build-diff";
export { buildSimulatableFactorCatalog } from "./catalog";
export {
  compareSimulationScenarios,
  overridesFromScenarioIds,
  runScenarioById,
} from "./compare-scenarios";
export type { ScenarioComparisonResult } from "./compare-scenarios";
export { buildSimulationExplanation } from "./explain";
export {
  buildEvidenceProvenanceCatalog,
  markSimulatedEvidenceRows,
} from "./evidence-provenance";
export type { EvidenceProvenance, EvidenceProvenanceRow } from "./evidence-provenance";
export { findMinimalImprovementPath } from "./minimal-path";
export { runSimulationPipeline } from "./run-pipeline";
export { buildSimulationSnapshot, snapshotProfileHasCapability } from "./snapshot";
export type { BuildSimulationSnapshotInput } from "./snapshot";
export { buildQuickScenarios } from "./scenarios";
export type { SimulationQuickScenario } from "./scenarios";
export {
  assertOverridesAreStructured,
  sanitizeSimulationOverrides,
  sanitizeSimulatedEvidenceNote,
} from "./security";
export type {
  DecisionSimulationResult,
  MinimalImprovementPath,
  ScenarioComparisonRow,
  SimulationDependencyImpact,
  SimulationDiff,
  SimulationExplanation,
  SimulationOverrides,
  SimulationSnapshot,
  SimulationStateView,
  SimulatableFactorCatalog,
  SimulatableWorkflowTask,
} from "./types";

import { applySimulationOverrides } from "./apply-overrides";
import { assembleSimulationResult } from "./build-diff";
import { findMinimalImprovementPath } from "./minimal-path";
import { runSimulationPipeline } from "./run-pipeline";
import {
  assertOverridesAreStructured,
  sanitizeSimulationOverrides,
} from "./security";
import type { DecisionSimulationResult, SimulationOverrides, SimulationSnapshot } from "./types";

export type SimulateTenderDecisionOptions = {
  includeMinimalPath?: boolean;
  scenarioComparison?: import("./types").ScenarioComparisonRow[] | null;
};

/**
 * Pure simulation entry — no I/O, no persistence, no Smart Alerts.
 */
export function simulateTenderDecision(
  snapshot: SimulationSnapshot,
  overrides: SimulationOverrides,
  options: SimulateTenderDecisionOptions = {},
): DecisionSimulationResult {
  const safeOverrides = sanitizeSimulationOverrides(overrides);
  assertOverridesAreStructured(safeOverrides);

  const applied = applySimulationOverrides(snapshot, safeOverrides);
  const simulated = runSimulationPipeline(applied.snapshot);
  const minimalPath =
    options.includeMinimalPath === false ? null : findMinimalImprovementPath(snapshot);

  return assembleSimulationResult({
    snapshot,
    simulated,
    applied,
    overrides: safeOverrides,
    minimalPath,
    scenarioComparison: options.scenarioComparison ?? null,
  });
}
