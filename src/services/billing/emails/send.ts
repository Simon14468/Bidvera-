/**
 * Best-effort billing email enqueue. Reuses SEND_EMAIL jobs + owner lookup.
 * Never throws to billing/auth callers.
 */

import { prisma } from "@/lib/db";
import { enqueueJob } from "@/services/jobs";
import { firstNameFrom, safePaymentMethodLabel } from "@/services/billing/emails/layout";
import { isFirstSignupFreeWorkspaceSurface } from "@/services/billing/billing-display";

export async function enqueueCompanyBillingEmail(input: {
  companyId: string;
  subject: string;
  html: string;
  text: string;
  dedupeKey: string;
}): Promise<void> {
  const owners = await prisma.user.findMany({
    where: { companyId: input.companyId, role: { in: ["OWNER", "ADMIN"] } },
    select: { email: true },
    take: 5,
  });
  for (const user of owners) {
    if (!user.email) continue;
    await enqueueJob({
      companyId: input.companyId,
      type: "SEND_EMAIL",
      payload: {
        to: user.email,
        subject: input.subject,
        html: input.html,
        text: input.text,
      },
      idempotencyKey: `${input.dedupeKey}:${user.email}`,
    }).catch(() => null);
  }
}

export async function loadBillingEmailAudience(companyId: string): Promise<{
  firstName: string;
  companyName: string;
  planName: string;
  planSlug: string | null;
  isFree: boolean;
  interval: string | null;
  status: string | null;
  provider: string | null;
  currentPeriodEnd: Date | null;
  amountCents: number | null;
  currency: string;
  paymentMethod: string | null;
  isFirstSignupTrial: boolean;
}> {
  const [company, sub] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        users: {
          where: { role: { in: ["OWNER", "ADMIN"] } },
          select: { name: true },
          take: 1,
        },
      },
    }),
    prisma.subscription.findUnique({
      where: { companyId },
      include: {
        billingPlan: {
          select: {
            name: true,
            slug: true,
            isFree: true,
            monthlyPriceCents: true,
            annualPriceCents: true,
            currency: true,
          },
        },
      },
    }),
  ]);

  const interval = sub?.billingInterval ?? null;
  const amountCents =
    interval === "YEAR"
      ? sub?.billingPlan?.annualPriceCents ?? null
      : sub?.billingPlan?.monthlyPriceCents ?? null;

  return {
    firstName: firstNameFrom(company?.users[0]?.name),
    companyName: company?.name?.trim() || "your workspace",
    planName: sub?.billingPlan?.name?.trim() || sub?.plan || "Bidvera",
    planSlug: sub?.billingPlan?.slug ?? null,
    isFree: sub?.billingPlan?.isFree === true || sub?.billingPlan?.slug === "free",
    interval,
    status: sub?.status ?? null,
    provider: sub?.provider ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    amountCents: amountCents != null && amountCents > 0 ? amountCents : null,
    currency: sub?.billingPlan?.currency ?? "USD",
    paymentMethod: safePaymentMethodLabel(sub?.paymentMethodBrand, sub?.paymentMethodLast4),
    isFirstSignupTrial: isFirstSignupFreeWorkspaceSurface({
      status: sub?.status ?? "",
      plan: sub?.plan,
      slug: sub?.billingPlan?.slug,
      isFree: sub?.billingPlan?.isFree,
    }),
  };
}
