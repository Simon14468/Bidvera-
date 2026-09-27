import { prisma } from "@/lib/db";
import { resolveFreeWorkspaceTrialChrome } from "@/services/billing/billing-display";

export async function loadFreeWorkspaceTrialChrome(companyId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { companyId },
    select: {
      status: true,
      plan: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      billingPlan: { select: { slug: true, isFree: true } },
    },
  });
  if (!subscription) return null;
  return resolveFreeWorkspaceTrialChrome({
    status: subscription.status,
    plan: subscription.plan,
    slug: subscription.billingPlan?.slug ?? null,
    isFree: subscription.billingPlan?.isFree ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  });
}
