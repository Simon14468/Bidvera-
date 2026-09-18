import type { SubscriptionStatus } from "@prisma/client";

/** Pure idempotency gate — used before DB writes in revokePaidEntitlements. */
export function shouldSkipRevocation(input: {
  status: SubscriptionStatus;
  plan: string;
  analysesLimit: number | null | undefined;
  providerReferenceId?: string | null;
  processedReferenceIds: string[];
}): boolean {
  if (
    input.providerReferenceId &&
    input.processedReferenceIds.includes(input.providerReferenceId)
  ) {
    return true;
  }

  const limit = input.analysesLimit ?? 0;
  return (
    input.status === "EXPIRED" &&
    input.plan !== "TRIAL" &&
    limit <= 0
  );
}

export function extractRevocationReferenceIds(
  events: Array<{ metadata: unknown }>,
): string[] {
  const ids: string[] = [];
  for (const event of events) {
    const meta = event.metadata as { providerReferenceId?: string } | null;
    if (meta?.providerReferenceId) ids.push(meta.providerReferenceId);
  }
  return ids;
}
