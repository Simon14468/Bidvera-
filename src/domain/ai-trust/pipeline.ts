/**
 * Pipeline trust snapshot — travels with canonical intelligence, never drives decisions.
 */

import type { PageValidationContext } from "./provenance-guard";
import type { PipelineTrustSnapshot, TrustScanResult } from "./types";
import { AI_TRUST_DISCLAIMER } from "./types";

export function buildPipelineTrustSnapshot(input: {
  scan: TrustScanResult;
  pageContext?: PageValidationContext;
}): PipelineTrustSnapshot {
  const overrideSegments = input.scan.segments.filter(
    (s) => s.classification === "SYSTEM_OVERRIDE_ATTEMPT",
  );

  return {
    disclaimer: AI_TRUST_DISCLAIMER,
    authoritativeTenderData: true,
    hasSystemOverrideAttempt: input.scan.hasSystemOverrideAttempt,
    flaggedSegmentCount: input.scan.segments.length,
    legitimateObligationCount: input.scan.legitimateObligationCount,
    anomalySamples: overrideSegments.slice(0, 4).map((s) => s.text.slice(0, 160)),
    knownPageCount: input.pageContext?.knownPages?.size ?? 0,
    computedAt: new Date().toISOString(),
  };
}

export function trustAnomalyNote(snapshot: PipelineTrustSnapshot | null | undefined): string | null {
  if (!snapshot?.hasSystemOverrideAttempt) return null;
  return (
    "Security note: instruction-like phrases were detected in tender document text. " +
    "They were treated as document content only — not executed. " +
    "Tender facts from the PDF remain authoritative."
  );
}
