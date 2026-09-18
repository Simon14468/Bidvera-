/** Production must never expose this debug pipeline, even with a valid secret. */
export function isInternalPipelineSmokeDisabled(
  nodeEnv = process.env.NODE_ENV,
): boolean {
  return nodeEnv === "production";
}

export function resolvePipelineSmokeCompanyId(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const id = env.CPS_SMOKE_COMPANY_ID?.trim();
  return id || null;
}
