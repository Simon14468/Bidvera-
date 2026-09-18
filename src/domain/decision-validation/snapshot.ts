/**
 * Decision Guardian release snapshot — persisted on intelligence before COMPLETED.
 * Web/PDF publication requires ok:true for full tender analyses.
 */

export type DecisionGuardianSnapshot = {
  ok: true;
  validatedAt: string;
  durationMs: number;
  checksRun: string[];
  contentHash: string;
  blockingFailureCount: 0;
  advisoryFailureCount: number;
  version: "decision-guardian/v1";
};

export function isDecisionGuardianSnapshot(
  value: unknown,
): value is DecisionGuardianSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.ok === true &&
    v.version === "decision-guardian/v1" &&
    typeof v.validatedAt === "string" &&
    typeof v.contentHash === "string" &&
    Array.isArray(v.checksRun)
  );
}
