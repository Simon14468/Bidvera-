/**
 * Apply validated simulation overrides to an immutable snapshot copy.
 */

import type { RequirementMatchStatus } from "@prisma/client";
import type { SimulationOverrides, SimulationSnapshot } from "./types";

export type AppliedSimulationState = {
  snapshot: SimulationSnapshot;
  applied: SimulationOverrides;
  changeLog: Array<{
    kind: "requirement" | "evidence" | "missing_document" | "profile";
    id: string;
    field: string;
    before: string;
    after: string;
  }>;
};

const ALLOWED_STATUSES: RequirementMatchStatus[] = [
  "MATCHED",
  "FAILED",
  "UNCERTAIN",
  "MISSING",
];

export function validateSimulationOverrides(
  snapshot: SimulationSnapshot,
  overrides: SimulationOverrides,
): { ok: true } | { ok: false; reason: string } {
  if (snapshot.companyKnowledgeOnly) {
    return { ok: false, reason: "Company-knowledge-only analysis cannot be simulated." };
  }
  if (snapshot.scoringBlocked) {
    return { ok: false, reason: "Scoring is blocked — insufficient tender extraction to simulate." };
  }
  if (!snapshot.baselineDecision) {
    return { ok: false, reason: "No canonical decision available for this tender." };
  }

  const reqIds = new Set(snapshot.requirements.map((r) => r.id));
  for (const row of overrides.requirements ?? []) {
    if (!reqIds.has(row.id)) {
      return { ok: false, reason: `Unknown requirement id: ${row.id}` };
    }
    if (!ALLOWED_STATUSES.includes(row.status)) {
      return { ok: false, reason: `Unsupported requirement status: ${row.status}` };
    }
  }

  const evidenceIds = new Set(snapshot.evidence.map((e) => e.id));
  for (const row of overrides.evidence ?? []) {
    if (!evidenceIds.has(row.id)) {
      return { ok: false, reason: `Unknown evidence id: ${row.id}` };
    }
  }

  const missingIds = new Set(snapshot.missingDocuments.map((d) => d.id));
  for (const id of overrides.resolveMissingDocumentIds ?? []) {
    if (!missingIds.has(id)) {
      return { ok: false, reason: `Unknown missing document id: ${id}` };
    }
  }

  const effectiveRequirements = (overrides.requirements ?? []).filter((row) => {
    const current = snapshot.requirements.find((r) => r.id === row.id);
    if (!current) return false;
    if (row.evidence !== undefined) return true;
    return current.status !== row.status;
  });

  const effectiveEvidence = (overrides.evidence ?? []).filter((row) => {
    const current = snapshot.evidence.find((e) => e.id === row.id);
    return current && current.verificationStatus !== row.verificationStatus;
  });

  const effectiveMissing = overrides.resolveMissingDocumentIds ?? [];

  const hasProfileChanges =
    overrides.profile != null &&
    Object.entries(overrides.profile).some(([key, value]) => {
      if (value === undefined) return false;
      return JSON.stringify((snapshot.profile as unknown as Record<string, unknown>)[key]) !== JSON.stringify(value);
    });

  const hasChanges =
    effectiveRequirements.length > 0 ||
    effectiveEvidence.length > 0 ||
    effectiveMissing.length > 0 ||
    hasProfileChanges;

  if (!hasChanges) {
    return { ok: false, reason: "No simulation changes were provided." };
  }

  return { ok: true };
}

export function applySimulationOverrides(
  snapshot: SimulationSnapshot,
  overrides: SimulationOverrides,
): AppliedSimulationState {
  const validation = validateSimulationOverrides(snapshot, overrides);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const next = structuredClone(snapshot) as SimulationSnapshot;
  const changeLog: AppliedSimulationState["changeLog"] = [];

  for (const row of overrides.requirements ?? []) {
    const target = next.requirements.find((r) => r.id === row.id);
    if (!target) continue;
    const before = target.status;
    if (before === row.status && row.evidence === undefined) continue;
    changeLog.push({
      kind: "requirement",
      id: row.id,
      field: "status",
      before,
      after: row.status,
    });
    target.status = row.status;
    if (row.evidence !== undefined) {
      changeLog.push({
        kind: "requirement",
        id: row.id,
        field: "evidence",
        before: target.evidence ?? "",
        after: row.evidence ?? "",
      });
      target.evidence = row.evidence;
    }
  }

  for (const row of overrides.evidence ?? []) {
    const target = next.evidence.find((e) => e.id === row.id);
    if (!target || target.verificationStatus === row.verificationStatus) continue;
    changeLog.push({
      kind: "evidence",
      id: row.id,
      field: "verificationStatus",
      before: target.verificationStatus,
      after: row.verificationStatus,
    });
    target.verificationStatus = row.verificationStatus;
  }

  for (const id of overrides.resolveMissingDocumentIds ?? []) {
    const idx = next.missingDocuments.findIndex((d) => d.id === id);
    if (idx === -1) continue;
    const doc = next.missingDocuments[idx]!;
    changeLog.push({
      kind: "missing_document",
      id,
      field: "resolved",
      before: doc.documentName,
      after: "SIMULATED — resolved",
    });
    next.missingDocuments.splice(idx, 1);
  }

  if (overrides.profile) {
    for (const [key, value] of Object.entries(overrides.profile) as Array<
      [keyof typeof overrides.profile, unknown]
    >) {
      if (value === undefined) continue;
      const before = JSON.stringify((next.profile as unknown as Record<string, unknown>)[key as string] ?? null);
      (next.profile as unknown as Record<string, unknown>)[key as string] = value;
      changeLog.push({
        kind: "profile",
        id: key,
        field: key,
        before,
        after: JSON.stringify(value),
      });
    }
  }

  return {
    snapshot: next,
    applied: overrides,
    changeLog,
  };
}
