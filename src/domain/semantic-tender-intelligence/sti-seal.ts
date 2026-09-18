/**
 * Architectural seal: only STI-admitted candidates can enter canonical construction.
 * Private constructor prevents forging with `{ approved: true }`.
 *
 * Final semantic admission gate runs here — immediately before canonicalization.
 */

import type { CanonicalSemanticCandidate, SemanticExclusionCode } from "./types";
import { buildSemanticIdentity } from "./identity";
import { finalAdmissionFromCandidate } from "./final-admission-gate";

export type FinalGateRejection = {
  candidate: CanonicalSemanticCandidate;
  exclusionCode: SemanticExclusionCode;
  exclusionReason: string;
  failedChecks: string[];
  contamination: string[];
};

export class StiApprovedRequirementBatch {
  private constructor(
    readonly items: readonly CanonicalSemanticCandidate[],
    readonly sourceDocument: string | null,
    readonly finalRejected: readonly FinalGateRejection[] = [],
  ) {}

  /**
   * Seal already-admitted STI candidates (from buildCanonicalSemanticCandidates).
   * Dedupes by semantic identity, then re-runs the final 16-check admission gate.
   * Never trusts prior admitToCanonical alone.
   */
  static fromAdmittedCandidates(
    candidates: readonly CanonicalSemanticCandidate[],
    sourceDocument?: string | null,
  ): StiApprovedRequirementBatch {
    const byIdentity = new Map<string, CanonicalSemanticCandidate>();
    for (const c of candidates) {
      const identity =
        c.canonicalId ||
        buildSemanticIdentity({
          text: c.fullRequirementText,
          actor: c.actor,
          contentKind: c.clauseRole ?? c.contentKind,
          lotLabel: c.lotApplicability,
          conditionText: c.condition,
          procurementPhase: c.procurementPhase,
        });
      const existing = byIdentity.get(identity);
      if (!existing) {
        byIdentity.set(identity, c);
        continue;
      }
      const preferLonger =
        c.fullRequirementText.length > existing.fullRequirementText.length
          ? c
          : existing;
      const provenance = [...existing.provenance];
      for (const p of c.provenance) {
        const key = `${p.sourceDocument}:${p.sourcePage}:${p.sourceSection}`;
        if (
          !provenance.some(
            (x) =>
              `${x.sourceDocument}:${x.sourcePage}:${x.sourceSection}` === key,
          )
        ) {
          provenance.push(p);
        }
      }
      byIdentity.set(identity, {
        ...preferLonger,
        provenance,
        confidence: Math.max(existing.confidence, c.confidence),
        condition: existing.condition ?? c.condition,
        conditionality: existing.conditionality ?? c.conditionality,
      });
    }

    const admitted: CanonicalSemanticCandidate[] = [];
    const finalRejected: FinalGateRejection[] = [];
    const seenIdentities = new Set<string>();

    for (const c of byIdentity.values()) {
      const identity = buildSemanticIdentity({
        text: c.fullRequirementText,
        actor: c.actor,
        contentKind: c.clauseRole ?? c.contentKind,
        lotLabel: c.lotApplicability,
        conditionText: c.condition,
        procurementPhase: c.procurementPhase,
      });
      const isDuplicateIdentity = seenIdentities.has(identity);
      const gate = finalAdmissionFromCandidate(c, { isDuplicateIdentity });
      if (!gate.admit) {
        finalRejected.push({
          candidate: c,
          exclusionCode: gate.exclusionCode ?? "NOT_ADMITTED",
          exclusionReason: gate.exclusionReason ?? "final_gate_rejected",
          failedChecks: gate.failedChecks,
          contamination: gate.contamination,
        });
        continue;
      }
      seenIdentities.add(identity);
      admitted.push(c);
    }

    return new StiApprovedRequirementBatch(
      admitted,
      sourceDocument ?? null,
      finalRejected,
    );
  }

  get size(): number {
    return this.items.length;
  }
}

export function isStiApprovedRequirementBatch(
  value: unknown,
): value is StiApprovedRequirementBatch {
  return value instanceof StiApprovedRequirementBatch;
}
