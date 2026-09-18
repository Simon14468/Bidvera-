import { AppError, ErrorCode } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { assertGatewayEnabled } from "@/services/billing/settings";

export function canOpenStripeBillingPortal(sub: {
  provider?: string | null;
  providerCustomerId?: string | null;
} | null): boolean {
  return Boolean(sub && sub.provider === "stripe" && sub.providerCustomerId);
}

export function isPaypalManagedBilling(sub: {
  provider?: string | null;
} | null): boolean {
  return sub?.provider === "paypal";
}

export async function createStripeBillingPortalSession(input: {
  companyId: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  await assertGatewayEnabled("stripe");
  const sub = await prisma.subscription.findUnique({
    where: { companyId: input.companyId },
    select: {
      companyId: true,
      provider: true,
      providerCustomerId: true,
    },
  });
  if (!sub || sub.companyId !== input.companyId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Billing is not available for this workspace.", 403);
  }
  if (!canOpenStripeBillingPortal(sub)) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Stripe payment-method updates are available only for Stripe subscriptions.",
      400,
    );
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new AppError(ErrorCode.UPSTREAM, "Stripe is not configured.", 503);
  }
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(key);
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.providerCustomerId!,
    return_url: input.returnUrl,
  });
  if (!session.url) {
    throw new AppError(ErrorCode.UPSTREAM, "Stripe billing portal URL missing.", 502);
  }
  return { url: session.url };
}
