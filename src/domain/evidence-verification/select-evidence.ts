/**
 * Select the best evidence row per requirement — one primary chain link.
 * Prefers human-verified (teamTaskId), then located excerpts, then oldest stable id.
 */

import type { CanonicalEvidenceRecord } from "@/domain/evidence-verification/types";

const PLACEHOLDER =
  "No supporting excerpt available — marked UNKNOWN.";

function scoreEvidence(row: CanonicalEvidenceRecord): number {
  let score = 0;
  if (row.teamTaskId) score += 100;
  if (row.verificationStatus === "VERIFIED" && row.teamTaskId) score += 50;
  if (row.sourcePage != null) score += 10;
  if (row.sourceSection?.trim()) score += 5;
  if (row.documentName?.trim()) score += 3;
  const text = row.evidenceText?.trim() ?? "";
  if (text && text !== PLACEHOLDER) score += 2;
  if (row.verificationStatus === "INFERRED") score += 1;
  return score;
}

export function isRealEvidenceText(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  return text.trim() !== PLACEHOLDER;
}

/** Pick one primary evidence row per requirementId. Unlinked evidence is ignored. */
export function selectBestEvidenceByRequirement(
  evidence: CanonicalEvidenceRecord[],
): Map<string, CanonicalEvidenceRecord> {
  const byReq = new Map<string, CanonicalEvidenceRecord[]>();
  for (const row of evidence) {
    if (!row.requirementId) continue;
    const list = byReq.get(row.requirementId) ?? [];
    list.push(row);
    byReq.set(row.requirementId, list);
  }

  const chosen = new Map<string, CanonicalEvidenceRecord>();
  for (const [reqId, rows] of byReq) {
    const sorted = [...rows].sort(
      (a, b) => scoreEvidence(b) - scoreEvidence(a) || a.id.localeCompare(b.id),
    );
    if (sorted[0]) chosen.set(reqId, sorted[0]!);
  }
  return chosen;
}

/** Detect evidence incorrectly linked to multiple requirements (should not happen). */
export function findDuplicateEvidenceAssignments(
  evidence: CanonicalEvidenceRecord[],
): string[] {
  const seen = new Map<string, string>();
  const dupes: string[] = [];
  for (const row of evidence) {
    if (!row.requirementId) continue;
    const prior = seen.get(row.id);
    if (prior && prior !== row.requirementId) {
      dupes.push(row.id);
    } else {
      seen.set(row.id, row.requirementId);
    }
  }
  return dupes;
}
