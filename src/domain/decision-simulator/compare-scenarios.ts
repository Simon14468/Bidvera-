/**
 * Compare multiple simulation scenarios against current state.
 */

import { applySimulationOverrides } from "./apply-overrides";
import { assembleSimulationResult } from "./build-diff";
import { runSimulationPipeline } from "./run-pipeline";
import { sanitizeSimulationOverrides, assertOverridesAreStructured } from "./security";
import type { SimulationQuickScenario } from "./scenarios";
import type {
  DecisionSimulationResult,
  ScenarioComparisonRow,
  SimulationOverrides,
  SimulationSnapshot,
} from "./types";

export type { ScenarioComparisonRow };

export type ScenarioComparisonResult = {
  baselineDecision: string;
  rows: ScenarioComparisonRow[];
  /** Full results keyed by scenario id when requested. */
  results: Record<string, DecisionSimulationResult>;
};

export function compareSimulationScenarios(
  snapshot: SimulationSnapshot,
  scenarios: SimulationQuickScenario[],
  maxScenarios = 4,
): ScenarioComparisonResult {
  const rows: ScenarioComparisonRow[] = [];
  const results: Record<string, DecisionSimulationResult> = {};

  for (const scenario of scenarios.slice(0, maxScenarios)) {
    try {
      const safe = sanitizeSimulationOverrides(scenario.overrides);
      assertOverridesAreStructured(safe);
      const applied = applySimulationOverrides(snapshot, safe);
      const simulated = runSimulationPipeline(applied.snapshot);
      const result = assembleSimulationResult({
        snapshot,
        simulated,
        applied,
        overrides: safe,
      });
      results[scenario.id] = result;
      rows.push({
        scenarioId: scenario.id,
        label: scenario.label,
        currentDecision: result.current.displayLabel,
        simulatedDecision: result.simulated?.displayLabel ?? result.current.displayLabel,
        decisionChanged: result.diff.decisionChanged,
        summaryReason: result.diff.summaryReason,
        requiresVerification: scenario.requiresVerification,
      });
    } catch {
      rows.push({
        scenarioId: scenario.id,
        label: scenario.label,
        currentDecision: snapshot.baselineDisplayLabel,
        simulatedDecision: snapshot.baselineDisplayLabel,
        decisionChanged: false,
        summaryReason: "Scenario could not be simulated with available data.",
        requiresVerification: scenario.requiresVerification,
      });
    }
  }

  return {
    baselineDecision: snapshot.baselineDisplayLabel,
    rows,
    results,
  };
}

export function runScenarioById(
  snapshot: SimulationSnapshot,
  scenarios: SimulationQuickScenario[],
  scenarioId: string,
): DecisionSimulationResult | null {
  const scenario = scenarios.find((s) => s.id === scenarioId);
  if (!scenario) return null;
  const safe = sanitizeSimulationOverrides(scenario.overrides);
  assertOverridesAreStructured(safe);
  const applied = applySimulationOverrides(snapshot, safe);
  const simulated = runSimulationPipeline(applied.snapshot);
  return assembleSimulationResult({
    snapshot,
    simulated,
    applied,
    overrides: safe,
  });
}

export function overridesFromScenarioIds(
  scenarios: SimulationQuickScenario[],
  scenarioIds: string[],
): SimulationOverrides | null {
  const selected = scenarios.filter((s) => scenarioIds.includes(s.id));
  if (selected.length === 0) return null;

  let merged: SimulationOverrides = {};
  for (const s of selected) {
    merged = mergeOverrides(merged, s.overrides);
  }
  return merged;
}

function mergeOverrides(a: SimulationOverrides, b: SimulationOverrides): SimulationOverrides {
  const reqMap = new Map((a.requirements ?? []).map((r) => [r.id, r]));
  for (const r of b.requirements ?? []) reqMap.set(r.id, r);
  const evMap = new Map((a.evidence ?? []).map((e) => [e.id, e]));
  for (const e of b.evidence ?? []) evMap.set(e.id, e);
  const missing = new Set([
    ...(a.resolveMissingDocumentIds ?? []),
    ...(b.resolveMissingDocumentIds ?? []),
  ]);
  return {
    requirements: reqMap.size ? [...reqMap.values()] : undefined,
    evidence: evMap.size ? [...evMap.values()] : undefined,
    resolveMissingDocumentIds: missing.size ? [...missing] : undefined,
    profile: b.profile ?? a.profile,
  };
}
