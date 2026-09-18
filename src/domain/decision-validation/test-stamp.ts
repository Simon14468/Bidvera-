/**
 * Stamp a valid Guardian snapshot onto a report for tests / fixtures.
 * Production never invents ok:true — only assertFinalReleaseIntegrity may set this.
 */

import { hashCanonicalReleasePayload } from "./build-input";
import type { DecisionGuardianSnapshot } from "./snapshot";
import type { TenderIntelligenceBreakdown } from "@/domain/tender-intelligence";

export function buildTestGuardianSnapshot(
  intelligence: Pick<TenderIntelligenceBreakdown, "complianceMatrix"> | null | undefined,
  overrides?: Partial<DecisionGuardianSnapshot>,
): DecisionGuardianSnapshot {
  const matrix = intelligence?.complianceMatrix ?? [];
  const contentHash = hashCanonicalReleasePayload(
    matrix.map((row) => ({
      id: row.requirementId,
      text: row.requirement,
    })),
  );
  return {
    ok: true,
    validatedAt: new Date().toISOString(),
    durationMs: 1,
    checksRun: [
      "document-integrity",
      "canonical-boundary",
      "semantic-identity",
      "conditionality",
      "deadlines",
      "evidence-rules",
      "cross-module",
      "decision-integrity",
      "report-integrity",
    ],
    contentHash,
    blockingFailureCount: 0,
    advisoryFailureCount: 0,
    version: "decision-guardian/v1",
    ...overrides,
  };
}

export function stampTestGuardianSnapshot(
  intelligence: TenderIntelligenceBreakdown,
): TenderIntelligenceBreakdown {
  return {
    ...intelligence,
    decisionGuardian: buildTestGuardianSnapshot(intelligence),
  };
}
