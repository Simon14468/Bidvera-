import {
  getEffectiveEntitlements,
  type EffectiveEntitlements,
} from "@/services/entitlements";

export interface EffectiveLimits {
  analysesLimit: number;
  seatsLimit: number;
  aiTokensLimit: number | null;
  storageMbLimit: number | null;
  monthlyPriceCents: number;
  planName: string;
  planSlug: string;
  source: "override" | "billing_plan" | "legacy_enum" | "default";
  billingInterval?: "MONTH" | "YEAR";
  planId?: string | null;
}

/**
 * Resolve company limits from DB entitlements (interval-aware).
 * Never trusts client-supplied values.
 */
export async function getEffectiveLimits(companyId: string): Promise<EffectiveLimits> {
  const e = await getEffectiveEntitlements(companyId);
  return toEffectiveLimits(e);
}

export function toEffectiveLimits(e: EffectiveEntitlements): EffectiveLimits {
  return {
    analysesLimit: e.analysesLimit,
    seatsLimit: e.seatsLimit,
    aiTokensLimit: e.aiTokensLimit,
    storageMbLimit: e.storageMbLimit,
    monthlyPriceCents: e.monthlyPriceCents,
    planName: e.planName,
    planSlug: e.planSlug,
    source: e.source,
    billingInterval: e.billingInterval,
    planId: e.planId,
  };
}
