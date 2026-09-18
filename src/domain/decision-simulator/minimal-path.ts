/**
 * Minimal deterministic change sets to improve decision — engine-driven search.
 */

import { applySimulationOverrides } from "./apply-overrides";
import { assembleSimulationResult } from "./build-diff";
import { runSimulationPipeline } from "./run-pipeline";
import type { MinimalImprovementPath, SimulationOverrides, SimulationSnapshot } from "./types";
import type { DecisionType } from "@prisma/client";

function runSimulationCore(snapshot: SimulationSnapshot, overrides: SimulationOverrides) {
  const applied = applySimulationOverrides(snapshot, overrides);
  const simulated = runSimulationPipeline(applied.snapshot);
  return assembleSimulationResult({ snapshot, simulated, applied, overrides });
}

function decisionRank(decision: DecisionType): number {
  if (decision === "NO_BID") return 0;
  if (decision === "REVIEW") return 1;
  return 2;
}

function targetDecision(current: DecisionType): DecisionType | null {
  if (current === "NO_BID") return "REVIEW";
  if (current === "REVIEW") return "BID";
  return null;
}

function targetLabel(decision: DecisionType): string {
  if (decision === "REVIEW") return "CONDITIONAL GO";
  if (decision === "BID") return "GO";
  return "NO-BID";
}

type AtomicCandidate = { label: string; overrides: SimulationOverrides };

function buildAtomicCandidates(snapshot: SimulationSnapshot): AtomicCandidate[] {
  const out: AtomicCandidate[] = [];
  const blockerTexts = new Set(
    (snapshot.baselineIntelligence.keyBlockers ?? []).map((b) => b.toLowerCase()),
  );

  const priorityReqs = snapshot.requirements.filter(
    (r) =>
      r.status !== "MATCHED" &&
      (r.mandatory ||
        [...blockerTexts].some(
          (b) =>
            b.includes(r.description.slice(0, 20).toLowerCase()) ||
            r.description.toLowerCase().includes(b.slice(0, 20)),
        )),
  );

  for (const r of priorityReqs.slice(0, 20)) {
    out.push({
      label: `Verify requirement: ${r.description.slice(0, 50)}`,
      overrides: { requirements: [{ id: r.id, status: "MATCHED" }] },
    });
  }

  for (const d of snapshot.missingDocuments.slice(0, 10)) {
    out.push({
      label: `Provide missing document: ${d.documentName}`,
      overrides: { resolveMissingDocumentIds: [d.id] },
    });
  }

  for (const e of snapshot.evidence.filter((x) => x.verificationStatus !== "VERIFIED").slice(0, 10)) {
    const req = e.requirementId
      ? snapshot.requirements.find((r) => r.id === e.requirementId)
      : null;
    out.push({
      label: `Verify evidence${req ? `: ${req.description.slice(0, 40)}` : ""}`,
      overrides: {
        evidence: [{ id: e.id, verificationStatus: "VERIFIED" }],
        ...(req && req.status !== "MATCHED"
          ? { requirements: [{ id: req.id, status: "MATCHED" }] }
          : {}),
      },
    });
  }

  return out;
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

function overridesKey(o: SimulationOverrides): string {
  return JSON.stringify(o);
}

export function findMinimalImprovementPath(
  snapshot: SimulationSnapshot,
): MinimalImprovementPath | null {
  const baseline = snapshot.baselineDecision;
  if (!baseline) return null;
  const target = targetDecision(baseline);
  if (!target) return null;

  const baselineRank = decisionRank(baseline);
  const targetRank = decisionRank(target);
  const atomics = buildAtomicCandidates(snapshot);
  if (atomics.length === 0) return null;

  type QueueItem = { overrides: SimulationOverrides; depth: number; labels: string[] };
  const queue: QueueItem[] = atomics.map((a) => ({
    overrides: a.overrides,
    depth: 1,
    labels: [a.label],
  }));
  const visited = new Set<string>();

  let best: { overrides: SimulationOverrides; labels: string[]; decision: DecisionType } | null =
    null;

  while (queue.length > 0) {
    const item = queue.shift()!;
    const key = overridesKey(item.overrides);
    if (visited.has(key)) continue;
    visited.add(key);

    let result;
    try {
      result = runSimulationCore(snapshot, item.overrides);
    } catch {
      continue;
    }

    const rank = decisionRank(result.simulated!.decision);
    if (rank >= targetRank && rank > baselineRank) {
      if (!best || item.labels.length < best.labels.length) {
        best = {
          overrides: item.overrides,
          labels: item.labels,
          decision: result.simulated!.decision,
        };
      }
      continue;
    }

    if (item.depth >= 3) continue;

    for (const atomic of atomics) {
      const merged = mergeOverrides(item.overrides, atomic.overrides);
      queue.push({
        overrides: merged,
        depth: item.depth + 1,
        labels: [...new Set([...item.labels, atomic.label])],
      });
    }
  }

  if (!best) {
    return {
      targetLabel: targetLabel(target),
      achievable: false,
      changes: [],
      combinedOverrides: null,
      resultingDecision: null,
      resultingDisplayLabel: null,
      disclaimer:
        "No minimal supported change set was found to reach the next decision tier under the canonical Decision Engine.",
    };
  }

  return {
    targetLabel: targetLabel(target),
    achievable: true,
    changes: best.labels.map((label) => ({ label })),
    combinedOverrides: best.overrides,
    resultingDecision: best.decision,
    resultingDisplayLabel: targetLabel(best.decision),
    disclaimer:
      "SIMULATED path only — real verification is required. This does not guarantee winning the tender.",
  };
}
