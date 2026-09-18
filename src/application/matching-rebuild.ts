/**
 * Application-boundary hook for Matching Engine profile rebuilds.
 * Call from write paths; never import matching internals into domain modules circularly.
 */
export function scheduleMatchingProfileRebuild(companyId: string): void {
  if (!companyId) return;
  void import("@/modules/matching-engine")
    .then((m) => m.rebuildMatchingProfileForCompany(companyId))
    .catch(() => {
      /* best-effort — never fail the source write path */
    });
}
