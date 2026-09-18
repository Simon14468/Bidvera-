/**
 * Free Workspace — post-trial / post-cancel limited plan.
 * Uses existing Plan / PlanFeature / entitlement rows. Never deletes company data.
 */

import { PLAN_ENTITLEMENT_DEFAULTS } from "@/domain/billing/entitlement-catalog";
import { prisma } from "@/lib/db";
import { recordSubscriptionEvent } from "@/services/billing/subscription-state";
import { analysesLimitForPlan, seatsLimitForPlan } from "@/services/entitlements";
import type { Plan, Subscription } from "@prisma/client";

export const FREE_PLAN_SLUG = "free";

const FREE_PLAN_FEATURES = PLAN_ENTITLEMENT_DEFAULTS.free ?? [
  "company_profile",
  "document_compliance",
];

export function slugToLegacyPlan(slug: string): "TRIAL" | "STARTER" | "PRO" | "BUSINESS" | "FREE" {
  const map: Record<string, "TRIAL" | "STARTER" | "PRO" | "BUSINESS" | "FREE"> = {
    free: "FREE",
    trial: "TRIAL",
    starter: "STARTER",
    pro: "PRO",
    business: "BUSINESS",
  };
  return map[slug] ?? "STARTER";
}

export function isLegacyOpenEndedTrial(sub: {
  status: string;
  plan: string;
  currentPeriodEnd: Date | null;
  provider?: string | null;
}): boolean {
  return (
    sub.status === "TRIALING" &&
    sub.plan === "TRIAL" &&
    sub.currentPeriodEnd == null
  );
}

/** Persist EXPIRED only when Free Workspace is off. Never backfill open-ended trials. */
export function shouldAssignFreeWorkspace(input: {
  freeWorkspaceEnabled: boolean;
  reason:
    | "trial_expired"
    | "period_expired"
    | "past_due_expired"
    | "canceled"
    | "subscription_deleted"
    | "trial_cancelled";
}): boolean {
  if (!input.freeWorkspaceEnabled) return false;
  return true;
}

/**
 * Stripe is still the source of truth for an uncancelled trial that just ended.
 * Do not locally expire / downgrade — wait for invoice.paid / payment_failed / deleted.
 */
export function shouldDeferProviderManagedTrial(input: {
  provider: string | null | undefined;
  providerSubscriptionId: string | null | undefined;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}): boolean {
  if (input.status !== "TRIALING") return false;
  if (input.cancelAtPeriodEnd) return false;
  if (input.currentPeriodEnd == null) return false;
  if (!input.providerSubscriptionId) return false;
  return input.provider === "stripe";
}

export async function ensureFreeWorkspacePlan(): Promise<Plan> {
  const existing = await prisma.plan.findFirst({
    where: { slug: FREE_PLAN_SLUG },
  });
  if (existing) return existing;

  const plan = await prisma.plan.create({
    data: {
      slug: FREE_PLAN_SLUG,
      name: "Free Workspace",
      description: "Limited workspace after trial or cancellation. Company data is preserved.",
      monthlyPriceCents: 0,
      annualPriceCents: null,
      analysesLimit: 0,
      seatsLimit: 1,
      aiTokensLimit: 0,
      trialEligible: false,
      trialDays: null,
      isFree: true,
      visibleToPublic: false,
      status: "ACTIVE",
      legacyEnum: "FREE",
      stripeEnabled: false,
      paypalEnabled: false,
      sortOrder: 0,
      featureList: ["Company profile", "Document Compliance (limited)"],
    },
  });

  const features = await prisma.feature.findMany();
  const enabled = new Set<string>(FREE_PLAN_FEATURES);
  for (const feature of features) {
    const key = feature.key === "alerts" ? "smart_alerts" : feature.key;
    await prisma.planFeature.upsert({
      where: { planId_featureId: { planId: plan.id, featureId: feature.id } },
      create: {
        planId: plan.id,
        featureId: feature.id,
        enabled: enabled.has(key),
      },
      update: { enabled: enabled.has(key) },
    });
  }

  return plan;
}

/**
 * Idempotent downgrade to Free Workspace. Preserves company, users, documents, history.
 */
export async function assignFreeWorkspace(
  companyId: string,
  reason = "downgrade",
): Promise<Subscription | null> {
  const plan = await ensureFreeWorkspacePlan();
  const existing = await prisma.subscription.findUnique({
    where: { companyId },
  });

  if (
    existing &&
    existing.planId === plan.id &&
    existing.status === "ACTIVE" &&
    existing.plan === "FREE"
  ) {
    return existing;
  }

  const interval = existing?.billingInterval ?? "MONTH";
  const analysesLimit = analysesLimitForPlan(plan, interval);
  const now = new Date();

  const sub = await prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.upsert({
      where: { companyId },
      create: {
        companyId,
        provider: "manual",
        plan: "FREE",
        planId: plan.id,
        status: "ACTIVE",
        billingInterval: interval,
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        canceledAt: now,
        gracePeriodEndsAt: null,
      },
      update: {
        plan: "FREE",
        planId: plan.id,
        status: "ACTIVE",
        billingInterval: interval,
        cancelAtPeriodEnd: false,
        canceledAt: existing?.canceledAt ?? now,
        gracePeriodEndsAt: null,
        currentPeriodEnd: null,
      },
    });

    await tx.companyUsage.upsert({
      where: { companyId },
      create: {
        companyId,
        analysesUsed: 0,
        analysesLimit,
        periodStart: now,
        periodEnd: null,
      },
      update: {
        analysesLimit,
        // Do not reset analysesUsed or delete historical usage.
      },
    });

    return updated;
  });

  await recordSubscriptionEvent({
    companyId,
    subscriptionId: sub.id,
    eventType: "FREE_WORKSPACE_ASSIGNED",
    fromStatus: existing?.status ?? null,
    toStatus: "ACTIVE",
    fromPlan: existing?.plan ?? null,
    toPlan: "FREE",
    metadata: { reason, planSlug: FREE_PLAN_SLUG, seatsLimit: seatsLimitForPlan(plan, interval) },
  });

  return sub;
}
