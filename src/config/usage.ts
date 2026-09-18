/**
 * Analyses limit semantics (single source of truth):
 * - null / undefined = unlimited
 * - 0 (or negative) = blocked / no usage
 * - positive = enforced limit
 *
 * CompanyUsage.analysesLimit is NOT NULL in Prisma, so unlimited cannot be
 * stored on that row. Free Workspace uses 0 (blocked). Optional company
 * overrides may be null (unlimited).
 */
export function isUnlimitedAnalyses(limit: number | null | undefined): boolean {
  return limit == null;
}

export function isAnalysesBlocked(limit: number | null | undefined): boolean {
  return limit != null && limit <= 0;
}
