/**
 * Evidence provenance labels for simulation vs production state.
 */

import type { SimulationSnapshot } from "./types";

export type EvidenceProvenance = "REAL" | "SIMULATED" | "UNKNOWN";

export type EvidenceProvenanceRow = {
  evidenceId: string;
  requirementId: string | null;
  label: string;
  provenance: EvidenceProvenance;
  verificationStatus: string;
};

export function buildEvidenceProvenanceCatalog(
  snapshot: SimulationSnapshot,
): EvidenceProvenanceRow[] {
  return snapshot.evidence.map((e) => {
    let provenance: EvidenceProvenance = "UNKNOWN";
    if (e.verificationStatus === "VERIFIED") {
      provenance = "REAL";
    } else if (
      e.verificationStatus === "NEEDS_VERIFICATION" ||
      e.verificationStatus === "MISSING_EVIDENCE"
    ) {
      provenance = "UNKNOWN";
    }
    const req = e.requirementId
      ? snapshot.requirements.find((r) => r.id === e.requirementId)
      : null;
    return {
      evidenceId: e.id,
      requirementId: e.requirementId,
      label: req?.description.slice(0, 80) ?? e.evidenceText.slice(0, 80),
      provenance,
      verificationStatus: e.verificationStatus,
    };
  });
}

export function markSimulatedEvidenceRows(
  catalog: EvidenceProvenanceRow[],
  simulatedEvidenceIds: string[],
): EvidenceProvenanceRow[] {
  const simSet = new Set(simulatedEvidenceIds);
  return catalog.map((row) =>
    simSet.has(row.evidenceId)
      ? { ...row, provenance: "SIMULATED" as const }
      : row,
  );
}
