/**
 * Structured decision impact explanation — answers executive + audit questions.
 */

import type { AppliedSimulationState } from "./apply-overrides";
import type {
  SimulationDiff,
  SimulationExplanation,
  SimulationSnapshot,
  SimulationStateView,
} from "./types";

export function buildSimulationExplanation(input: {
  snapshot: SimulationSnapshot;
  simulated: SimulationStateView | null;
  applied: AppliedSimulationState;
  diff: SimulationDiff;
}): SimulationExplanation {
  const { snapshot, simulated, applied, diff } = input;

  if (!simulated || diff.noDecisionChange) {
    return {
      whatChanged: applied.changeLog.map((c) => `${c.kind}: ${c.before} → ${c.after}`),
      factorsAffected: diff.requirementsAffected.map((r) => ({
        type: "requirement" as const,
        id: r.id,
        label: r.description,
        before: r.beforeStatus,
        after: r.afterStatus,
      })),
      rulesTriggered: [],
      realEvidenceSupportingCurrentState: buildRealEvidenceRefs(snapshot),
      stillMissing: buildStillMissing(snapshot),
      realWorldActionsRequired: buildRealWorldActions(snapshot, applied),
      summary:
        "No decision change — this simulation does not affect a decision-driving factor under the existing Decision Engine.",
      memoryContext: buildMemoryContext(snapshot),
      requiresVerification: false,
      verificationNote: null,
    };
  }

  const rulesTriggered = simulated.recommendation.reasons.map((r) => ({
    code: r.code,
    text: r.text,
    source: r.source,
  }));

  return {
    whatChanged: applied.changeLog.map((c) => `SIMULATED ${c.kind}: ${c.before} → ${c.after}`),
    factorsAffected: [
      ...diff.requirementsAffected.map((r) => ({
        type: "requirement" as const,
        id: r.id,
        label: r.description,
        before: r.beforeStatus,
        after: r.afterStatus,
      })),
      ...diff.risksAffected.map((r) => ({
        type: "risk" as const,
        id: r.id,
        label: r.title,
        before: r.beforeSeverity ?? "none",
        after: r.afterSeverity,
      })),
    ],
    rulesTriggered,
    realEvidenceSupportingCurrentState: buildRealEvidenceRefs(snapshot),
    stillMissing: buildStillMissingAfterSim(snapshot, simulated, diff),
    realWorldActionsRequired: buildRealWorldActions(snapshot, applied),
    summary: diff.summaryReason,
    memoryContext: buildMemoryContext(snapshot),
    requiresVerification: applied.changeLog.some(
      (c) => c.kind === "requirement" || c.kind === "evidence",
    ),
    verificationNote:
      applied.changeLog.some((c) => c.kind === "requirement" || c.kind === "evidence")
        ? "Requires verification — simulated improvements must be confirmed through Team Workflow and verified evidence before they can affect the real tender."
        : null,
  };
}

function buildRealEvidenceRefs(snapshot: SimulationSnapshot) {
  return snapshot.evidence
    .filter((e) => e.verificationStatus === "VERIFIED")
    .map((e) => ({
      evidenceId: e.id,
      requirementId: e.requirementId,
      provenance: "REAL" as const,
      label: e.evidenceText.slice(0, 120),
    }));
}

function buildStillMissing(snapshot: SimulationSnapshot): string[] {
  const items: string[] = [];
  for (const r of snapshot.requirements) {
    if (r.mandatory && r.status !== "MATCHED") {
      items.push(`Requirement: ${r.description.slice(0, 100)} (${r.status})`);
    }
  }
  for (const d of snapshot.missingDocuments) {
    items.push(`Missing document: ${d.documentName}`);
  }
  for (const b of snapshot.baselineIntelligence.keyBlockers ?? []) {
    items.push(`Blocker: ${b}`);
  }
  return items.slice(0, 12);
}

function buildStillMissingAfterSim(
  snapshot: SimulationSnapshot,
  simulated: SimulationStateView,
  diff: SimulationDiff,
): string[] {
  const items: string[] = [];
  for (const r of simulated.readiness.items) {
    if (r.status === "MISSING" || r.status === "VERIFY" || r.status === "UNKNOWN") {
      items.push(`${r.status}: ${r.requirement.slice(0, 100)}`);
    }
  }
  for (const b of simulated.intelligence.keyBlockers ?? []) {
    if (!diff.blockersRemoved.includes(b)) {
      items.push(`Blocker remains: ${b}`);
    }
  }
  if (diff.insufficientEvidence && diff.insufficientEvidenceMessage) {
    items.push(diff.insufficientEvidenceMessage);
  }
  return items.slice(0, 12);
}

function buildRealWorldActions(
  snapshot: SimulationSnapshot,
  applied: AppliedSimulationState,
): string[] {
  const actions: string[] = [];
  for (const entry of applied.changeLog) {
    if (entry.kind === "requirement") {
      actions.push(
        `Obtain and verify real evidence for requirement ${entry.id}, then update via Team Workflow — do not rely on simulation.`,
      );
    }
    if (entry.kind === "evidence") {
      actions.push(
        `Complete human verification for evidence ${entry.id} with documented source.`,
      );
    }
    if (entry.kind === "missing_document") {
      actions.push(`Upload and verify the missing document: ${entry.before}`);
    }
    if (entry.kind === "profile") {
      actions.push(
        `Update company profile with verified ${entry.field} data if the simulation assumed a real capability.`,
      );
    }
  }
  if (snapshot.teamWorkflow && snapshot.teamWorkflow.openCriticalCount > 0) {
    actions.push(
      `Resolve ${snapshot.teamWorkflow.openCriticalCount} open critical team task(s) before final decision.`,
    );
  }
  return [...new Set(actions)].slice(0, 8);
}

function buildMemoryContext(snapshot: SimulationSnapshot): string | null {
  const memory = snapshot.memoryInsights;
  if (!memory?.matches?.length) return null;
  const top = memory.matches[0]!;
  return `Historical signal (reference only): ${top.title} — ${top.decisionLabel}. ${top.disclaimer} This does not override current tender evidence or simulation assumptions.`;
}
