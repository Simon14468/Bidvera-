/**
 * Pipeline-wide AI trust invariants.
 */

import type { PipelineTrustSnapshot } from "./types";
import { AI_TRUST_PRINCIPLES } from "./types";

export const AI_TRUST_PIPELINE_INVARIANTS = {
  ...AI_TRUST_PRINCIPLES,
  trustSnapshotIsAdvisoryOnly: true,
  trustSnapshotNeverChangesDecision: true,
  injectionFlagsNeverStripTenderFacts: true,
} as const;

export function assertPipelineTrustSnapshotIntegrity(
  snapshot: PipelineTrustSnapshot,
): void {
  if (!snapshot.authoritativeTenderData) {
    throw new Error("Pipeline trust: tender PDF authority flag missing.");
  }
  if (snapshot.anomalySamples.some((s) => s.length > 200)) {
    throw new Error("Pipeline trust: anomaly sample exceeds cap.");
  }
}
