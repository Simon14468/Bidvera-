/**
 * Compare baseline canonical state vs simulated pipeline output.
 */

import { buildSimulationExplanation } from "./explain";
import {
  buildEvidenceProvenanceCatalog,
  markSimulatedEvidenceRows,
} from "./evidence-provenance";
import type { AppliedSimulationState } from "./apply-overrides";
import type {
  DecisionSimulationResult,
  SimulationDiff,
  SimulationSnapshot,
  SimulationStateView,
  SimulationOverrides,
} from "./types";

function readinessLabelForRequirement(
  readiness: SimulationStateView["readiness"] | SimulationSnapshot["baselineReadiness"],
  requirementId: string,
): string | null {
  if (!readiness) return null;
  const item = readiness.items.find((i) => i.id === requirementId);
  return item?.status ?? null;
}

function riskByTitle(
  intelligence: SimulationStateView["intelligence"] | SimulationSnapshot["baselineIntelligence"],
) {
  const map = new Map<string, { id: string; severity: string }>();
  for (const r of intelligence.risks) {
    map.set(r.title, { id: r.id, severity: r.severity });
  }
  return map;
}

export function buildSimulationDiff(input: {
  snapshot: SimulationSnapshot;
  simulated: SimulationStateView;
  applied: AppliedSimulationState;
}): SimulationDiff {
  const { snapshot, simulated, applied } = input;
  const currentLabel = snapshot.baselineDisplayLabel;
  const simulatedLabel = simulated.displayLabel;
  const decisionChanged = snapshot.baselineDecision !== simulated.decision;

  const baselineBlockers = snapshot.baselineIntelligence.keyBlockers ?? [];
  const simulatedBlockers = simulated.intelligence.keyBlockers ?? [];
  const blockersAdded = simulatedBlockers.filter((b) => !baselineBlockers.includes(b));
  const blockersRemoved = baselineBlockers.filter((b) => !simulatedBlockers.includes(b));

  const requirementsAffected = (applied.applied.requirements ?? []).map((row) => {
    const req = snapshot.requirements.find((r) => r.id === row.id);
    const original = snapshot.requirements.find((r) => r.id === row.id);
    return {
      id: row.id,
      description: req?.description ?? row.id,
      beforeStatus: original?.status ?? row.status,
      afterStatus: row.status,
      readinessBefore: readinessLabelForRequirement(snapshot.baselineReadiness, row.id),
      readinessAfter: readinessLabelForRequirement(simulated.readiness, row.id),
    };
  });

  const baselineRisks = riskByTitle(snapshot.baselineIntelligence);
  const simulatedRisks = riskByTitle(simulated.intelligence);
  const risksAffected: SimulationDiff["risksAffected"] = [];
  for (const [title, after] of simulatedRisks) {
    const before = baselineRisks.get(title);
    if (!before || before.severity !== after.severity) {
      risksAffected.push({
        id: after.id,
        title,
        beforeSeverity: before?.severity ?? null,
        afterSeverity: after.severity,
      });
    }
  }

  const evidenceAffected = (applied.applied.evidence ?? []).map((row) => {
    const before = snapshot.evidence.find((e) => e.id === row.id);
    return {
      id: row.id,
      beforeStatus: before?.verificationStatus ?? row.verificationStatus,
      afterStatus: row.verificationStatus,
    };
  });

  const dependencyImpacts = applied.changeLog.map((entry) => ({
    factor:
      entry.kind === "requirement"
        ? "Requirement status"
        : entry.kind === "evidence"
          ? "Evidence verification"
          : entry.kind === "missing_document"
            ? "Missing document"
            : "Company profile",
    affectedRequirementId: entry.kind === "requirement" ? entry.id : null,
    affectedBlocker: blockersAdded[0] ?? blockersRemoved[0] ?? null,
    affectedReadinessState:
      entry.kind === "requirement"
        ? (requirementsAffected.find((r) => r.id === entry.id)?.readinessAfter ?? null)
        : null,
    affectedDecisionRule: decisionChanged
      ? simulated.recommendation.reasons[0]?.code ?? null
      : null,
    before: entry.before,
    after: entry.after,
    simulated: true as const,
  }));

  const fitScoreDelta =
    snapshot.baselineFitScore != null
      ? simulated.fitScore - snapshot.baselineFitScore
      : null;
  const readinessScoreDelta =
    snapshot.baselineReadiness?.score != null && simulated.readiness.score != null
      ? simulated.readiness.score - snapshot.baselineReadiness.score
      : null;

  let summaryReason: string;
  let insufficientEvidence = false;
  let insufficientEvidenceMessage: string | null = null;

  if (!decisionChanged) {
    summaryReason =
      "No decision change. The simulated adjustments do not remove blockers or satisfy rules required to change the recommendation under the existing Decision Engine.";
  } else {
    const primaryReason =
      simulated.recommendation.reasons.find((r) => r.severity === "CRITICAL" || r.severity === "HIGH") ??
      simulated.recommendation.reasons[0];
    summaryReason = primaryReason
      ? `SIMULATED: ${primaryReason.text}`
      : `SIMULATED: Decision would change from ${currentLabel} to ${simulatedLabel} based on the existing Decision Engine rules.`;
  }

  const uncertainOnly =
    requirementsAffected.length > 0 &&
    requirementsAffected.every((r) => r.afterStatus === "UNCERTAIN" || r.afterStatus === "MISSING");
  if (
    decisionChanged &&
    simulated.decision === "BID" &&
    uncertainOnly &&
    (simulated.readiness.counts.verify ?? 0) > 0
  ) {
    insufficientEvidence = true;
    insufficientEvidenceMessage =
      "Insufficient evidence to simulate this outcome — mandatory items remain uncertain or unverified.";
    summaryReason = insufficientEvidenceMessage;
  }

  return {
    decisionChanged,
    currentDecision: currentLabel,
    simulatedDecision: simulatedLabel,
    currentConfidence: snapshot.baselineConfidence,
    simulatedConfidence: simulated.confidence,
    fitScoreDelta,
    readinessScoreDelta,
    blockersAdded,
    blockersRemoved,
    requirementsAffected,
    risksAffected,
    evidenceAffected,
    dependencyImpacts,
    summaryReason,
    noDecisionChange: !decisionChanged,
    insufficientEvidence,
    insufficientEvidenceMessage,
  };
}

export function assembleSimulationResult(input: {
  snapshot: SimulationSnapshot;
  simulated: SimulationStateView;
  applied: AppliedSimulationState;
  overrides: SimulationOverrides;
  minimalPath?: import("./types").MinimalImprovementPath | null;
  scenarioComparison?: import("./types").ScenarioComparisonRow[] | null;
}): DecisionSimulationResult {
  const diff = buildSimulationDiff(input);
  const explanation = buildSimulationExplanation({
    snapshot: input.snapshot,
    simulated: input.simulated,
    applied: input.applied,
    diff,
  });
  const provenance = markSimulatedEvidenceRows(
    buildEvidenceProvenanceCatalog(input.snapshot),
    (input.applied.applied.evidence ?? []).map((e) => e.id),
  );

  return {
    current: {
      decision: input.snapshot.baselineDecision,
      displayLabel: input.snapshot.baselineDisplayLabel,
      confidence: input.snapshot.baselineConfidence,
      fitScore: input.snapshot.baselineFitScore,
      readiness: input.snapshot.baselineReadiness,
      keyBlockers: input.snapshot.baselineIntelligence.keyBlockers ?? [],
      isSimulated: false,
    },
    simulated: input.simulated,
    diff,
    explanation,
    evidenceProvenance: provenance,
    minimalPath: input.minimalPath ?? null,
    scenarioComparison: input.scenarioComparison ?? null,
    appliedOverrides: input.applied.applied,
    simulatedAt: new Date().toISOString(),
  };
}

export function assembleNoChangeResult(
  snapshot: SimulationSnapshot,
  overrides: SimulationOverrides,
  reason: string,
  applied?: AppliedSimulationState,
): DecisionSimulationResult {
  const emptyApplied: AppliedSimulationState = applied ?? {
    snapshot,
    applied: overrides,
    changeLog: [],
  };
  const diff = {
    decisionChanged: false,
    currentDecision: snapshot.baselineDisplayLabel,
    simulatedDecision: snapshot.baselineDisplayLabel,
    currentConfidence: snapshot.baselineConfidence,
    simulatedConfidence: snapshot.baselineConfidence,
    fitScoreDelta: null,
    readinessScoreDelta: null,
    blockersAdded: [],
    blockersRemoved: [],
    requirementsAffected: [],
    risksAffected: [],
    evidenceAffected: [],
    dependencyImpacts: [],
    summaryReason: reason,
    noDecisionChange: true,
    insufficientEvidence: reason.includes("Insufficient"),
    insufficientEvidenceMessage: reason.includes("Insufficient") ? reason : null,
  };
  const explanation = buildSimulationExplanation({
    snapshot,
    simulated: null,
    applied: emptyApplied,
    diff,
  });

  return {
    current: {
      decision: snapshot.baselineDecision,
      displayLabel: snapshot.baselineDisplayLabel,
      confidence: snapshot.baselineConfidence,
      fitScore: snapshot.baselineFitScore,
      readiness: snapshot.baselineReadiness,
      keyBlockers: snapshot.baselineIntelligence.keyBlockers ?? [],
      isSimulated: false,
    },
    simulated: null,
    diff,
    explanation,
    evidenceProvenance: buildEvidenceProvenanceCatalog(snapshot),
    minimalPath: null,
    scenarioComparison: null,
    appliedOverrides: overrides,
    simulatedAt: new Date().toISOString(),
  };
}
