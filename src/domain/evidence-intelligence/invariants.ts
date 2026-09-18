/**
 * Evidence Intelligence invariants — read-only derived intelligence.
 * Never mutates canonical tender state, billing, or decisions.
 */

export const EVIDENCE_INTELLIGENCE_INVARIANTS = {
  readOnly: true,
  autoVerify: false,
  mutatesRequirements: false,
  mutatesEvidence: false,
  mutatesDecision: false,
  mutatesBilling: false,
} as const;

/** Guard for application wiring — throws if a module attempts write operations. */
export function assertEvidenceIntelligenceReadOnly(context: string): void {
  if (!EVIDENCE_INTELLIGENCE_INVARIANTS.readOnly) {
    throw new Error(`Evidence Intelligence must remain read-only (${context}).`);
  }
}
