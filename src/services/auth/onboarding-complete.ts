import { prisma } from "@/lib/db";

/** Mark company users as onboarded once a trial/paid subscription is active. */
export async function markOnboardingDoneIfSubscribed(companyId: string, userId?: string) {
  const sub = await prisma.subscription.findUnique({ where: { companyId } });
  if (!sub) return;
  const active =
    sub.status === "ACTIVE" ||
    sub.status === "TRIALING" ||
    sub.plan === "TRIAL";
  if (!active) return;

  await prisma.user.updateMany({
    where: {
      companyId,
      onboardingStep: { not: "DONE" },
      ...(userId ? { id: userId } : {}),
    },
    data: { onboardingStep: "DONE" },
  });
}
