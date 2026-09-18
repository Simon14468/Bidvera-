import { AppError, ErrorCode } from "@/lib/errors";
import { PLANS, type PlanId, getPlanByPrisma } from "@/config/plans";
import { isUnlimitedAnalyses } from "@/config/usage";
import { prisma } from "@/lib/db";
import { checkoutRateLimiter } from "@/lib/rate-limit";
import { listPublicCheckoutPlans } from "@/services/billing/catalog";
import { createPayPalCheckoutSession, activatePayPalSubscription, handlePayPalWebhook, cancelPayPalSubscription } from "@/services/billing/paypal";
import { getBillingGatewaySettings } from "@/services/billing/settings";
import {
  createStripeCheckoutSession,
  activateStripeCheckoutSession,
  handleStripeWebhook,
  cancelStripeSubscription,
} from "@/services/billing/stripe";
import { ensureTrialSubscription as ensureTrial } from "@/services/billing/subscription-state";
import { trackEvent } from "@/services/observability";
import type { BillingInterval, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

export interface CheckoutResult {
  url: string;
  provider: "paypal" | "stripe";
}

export type CheckoutGateway = "stripe" | "paypal";

export interface BillingService {
  readonly providerName: string;
  ensureTrialSubscription(companyId: string, options?: { grant?: boolean }): Promise<void>;
  getSubscription(companyId: string): Promise<{
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    analysesLimit: number;
  } | null>;
  createCheckoutSession(input: {
    companyId: string;
    userEmail: string;
    planId: PlanId | string;
    successUrl: string;
    cancelUrl: string;
    gateway?: CheckoutGateway;
    interval?: BillingInterval;
  }): Promise<CheckoutResult>;
  handleWebhook(rawBody: string, headers: Headers): Promise<void>;
  activateFromProviderSubscription?(input: {
    companyId: string;
    providerSubscriptionId: string;
    planId?: PlanId | string;
    interval?: BillingInterval;
  }): Promise<void>;
}

function mapCheckoutError(error: unknown): never {
  if (error instanceof AppError) throw error;
  const code = (error as { code?: string })?.code ?? (error as Error)?.message;
  if (code === "GATEWAY_DISABLED") {
    throw new AppError(ErrorCode.FORBIDDEN, "This payment method is currently unavailable.", 403);
  }
  if (code === "PLAN_UNAVAILABLE") {
    throw new AppError(ErrorCode.VALIDATION, "This plan is not available for checkout.", 400);
  }
  throw error instanceof Error
    ? new AppError(ErrorCode.INTERNAL, "Unable to start checkout.", 500)
    : new AppError(ErrorCode.INTERNAL, "Unable to start checkout.", 500);
}

class MultiGatewayBillingService implements BillingService {
  readonly providerName = "multi";

  async ensureTrialSubscription(
    companyId: string,
    options?: { grant?: boolean },
  ): Promise<void> {
    const settings = await getBillingGatewaySettings();
    if (!settings.trialEnabled && options?.grant !== false) {
      await ensureTrial(companyId, options);
      return;
    }
    await ensureTrial(companyId, options);
  }

  async getSubscription(companyId: string) {
    const sub = await prisma.subscription.findUnique({
      where: { companyId },
      include: { billingPlan: true },
    });
    if (!sub) return null;
    const plan = getPlanByPrisma(sub.plan);
    const analysesLimit =
      sub.billingPlan?.analysesLimit ??
      (await prisma.companyUsage.findUnique({ where: { companyId } }))?.analysesLimit ??
      plan.analysesLimit;
    return {
      plan: sub.plan,
      status: sub.status,
      analysesLimit: isUnlimitedAnalyses(analysesLimit) ? 0 : analysesLimit,
    };
  }

  async createCheckoutSession(input: {
    companyId: string;
    userEmail: string;
    planId: PlanId | string;
    successUrl: string;
    cancelUrl: string;
    gateway?: CheckoutGateway;
    interval?: BillingInterval;
  }): Promise<CheckoutResult> {
    try {
      if (input.planId === "trial" || input.planId === "free") {
        throw new AppError(ErrorCode.VALIDATION, "Cannot checkout the trial or free plan.", 400);
      }

      await checkoutRateLimiter.check(`checkout:company:${input.companyId}`);
      await checkoutRateLimiter.check(`checkout:email:${input.userEmail.toLowerCase()}`);

      const settings = await getBillingGatewaySettings();
      const interval = input.interval ?? "MONTH";
      let gateway = input.gateway ?? settings.defaultGateway;

      // Resolve legacy plan ids (starter/pro/business) to DB plans when needed
      let planKey = input.planId;
      if (planKey in PLANS) {
        const legacy = PLANS[planKey as PlanId];
        const dbPlan = await prisma.plan.findFirst({
          where: { OR: [{ slug: legacy.id }, { legacyEnum: legacy.prismaPlan }] },
        });
        if (dbPlan) planKey = dbPlan.id;
      }

      const publicPlans = await listPublicCheckoutPlans();
      const match = publicPlans.find((p) => p.id === planKey || p.slug === planKey);
      if (!match) {
        throw new AppError(ErrorCode.VALIDATION, "This plan is not available for checkout.", 400);
      }
      if (!match.gateways.includes(gateway)) {
        gateway = match.gateways[0]!;
      }

      await trackEvent({
        action: "CHECKOUT_STARTED",
        companyId: input.companyId,
        metadata: { planId: planKey, provider: gateway, interval },
      });

      if (gateway === "stripe") {
        return createStripeCheckoutSession({
          companyId: input.companyId,
          userEmail: input.userEmail,
          planIdOrSlug: planKey,
          interval,
          successUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
        });
      }

      return createPayPalCheckoutSession({
        companyId: input.companyId,
        userEmail: input.userEmail,
        planIdOrSlug: planKey,
        interval,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
      });
    } catch (error) {
      mapCheckoutError(error);
    }
  }

  async activateFromProviderSubscription(input: {
    companyId: string;
    providerSubscriptionId: string;
    planId?: PlanId | string;
    interval?: BillingInterval;
  }) {
    await activatePayPalSubscription({
      companyId: input.companyId,
      providerSubscriptionId: input.providerSubscriptionId,
    });
  }

  async handleWebhook(rawBody: string, headers: Headers): Promise<void> {
    // Route by signature headers
    if (headers.get("stripe-signature")) {
      await handleStripeWebhook(rawBody, headers.get("stripe-signature"));
      return;
    }
    if (headers.get("paypal-transmission-id") || headers.get("paypal-auth-algo")) {
      await handlePayPalWebhook(rawBody, headers);
      return;
    }
    throw new AppError(ErrorCode.VALIDATION, "Unknown webhook provider.", 400);
  }
}

export const billingService: BillingService = new MultiGatewayBillingService();

export {
  listPublicCheckoutPlans,
  getBillingGatewaySettings,
  activateStripeCheckoutSession,
  activatePayPalSubscription,
  cancelStripeSubscription,
  cancelPayPalSubscription,
  handleStripeWebhook,
  handlePayPalWebhook,
};

export { assignFreeWorkspace, ensureFreeWorkspacePlan } from "@/services/billing/free-workspace";
