import Stripe from "stripe";
import { AppError, ErrorCode } from "@/lib/errors";
import { prisma } from "@/lib/db";
import {
  assertPlanAllowsCheckout,
  getCheckoutPlanOrThrow,
  planRequiresStripePriceId,
  resolvePlanAmountCents,
  resolveStripePriceId,
} from "@/services/billing/catalog";
import { recordBillingAudit } from "@/services/billing/audit";
import { revokePaidEntitlements } from "@/services/billing/revocation";
import {
  assertGatewayEnabled,
  getBillingGatewaySettings,
} from "@/services/billing/settings";
import {
  applyPaidPlanActivation,
  updateSubscriptionStatus,
} from "@/services/billing/subscription-state";
import {
  assertLocalCheckoutBinding,
  assertStripeCheckoutReadyForActivation,
  assertStripeSubscriptionActive,
  assertStripeSubscriptionWebhookBinding,
  assertExactAmountCents,
  assertCurrencyMatch,
  verifyStripePriceAgainstPlan,
} from "@/services/billing/verification";
import {
  buildStripeTrialSubscriptionData,
  decideStripeTrialCheckout,
  loadStripeTrialContext,
  STRIPE_TRIAL_PAYMENT_METHOD_COLLECTION,
} from "@/services/billing/trial-checkout";
import { assignFreeWorkspace } from "@/services/billing/free-workspace";
import { resolveUniqueCompanyIdFromCustomerMatches } from "@/services/billing/stripe-customer-isolation";
import {
  assertPaymentIdentityAllowsTrial,
  assessTrialRisk,
  persistTrialRisk,
} from "@/services/trial/risk";
import {
  beginWebhookProcessing,
  markWebhookFailed,
  markWebhookProcessed,
} from "@/services/billing/webhooks-store";
import type { BillingInterval } from "@prisma/client";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new AppError(
      ErrorCode.UPSTREAM,
      "Stripe is not configured. Set STRIPE_SECRET_KEY.",
      503,
    );
  }
  return new Stripe(key);
}

/** Inline price_data is a local/test fallback only — never production. */
export function allowStripeInlinePriceData(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv === "development" || nodeEnv === "test";
}

export type StripeCheckoutLineItemInput = {
  priceId: string | null;
  amountCents: number;
  currency: string;
  interval: BillingInterval;
  planName: string;
  planId: string;
  planSlug: string;
  nodeEnv?: string;
};

/**
 * Production checkout must use the Super Admin Stripe Price ID.
 * Amount/currency come from the DB plan, never from the client.
 */
export function buildStripeCheckoutLineItems(
  input: StripeCheckoutLineItemInput,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  if (input.priceId) {
    return [{ price: input.priceId, quantity: 1 }];
  }
  if (!allowStripeInlinePriceData(input.nodeEnv ?? process.env.NODE_ENV)) {
    throw new AppError(
      ErrorCode.UPSTREAM,
      "Stripe Price ID is not configured for this plan. Set it in Super Admin before taking payments.",
      503,
    );
  }
  return [
    {
      quantity: 1,
      price_data: {
        currency: input.currency.toLowerCase(),
        unit_amount: input.amountCents,
        recurring: {
          interval: input.interval === "YEAR" ? "year" : "month",
        },
        product_data: {
          name: `Bidvera ${input.planName}`,
          metadata: { planId: input.planId, planSlug: input.planSlug },
        },
      },
    },
  ];
}

export async function createStripeCheckoutSession(input: {
  companyId: string;
  userEmail: string;
  planIdOrSlug: string;
  interval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
}) {
  await assertGatewayEnabled("stripe");
  const plan = await getCheckoutPlanOrThrow(input.planIdOrSlug);
  await assertPlanAllowsCheckout({ plan, gateway: "stripe", interval: input.interval });

  const priceId = resolveStripePriceId(plan, input.interval);
  const amountCents = resolvePlanAmountCents(plan, input.interval);
  const stripe = getStripe();
  const settings = await getBillingGatewaySettings();
  const trialContext = await loadStripeTrialContext(input.companyId);
  const trial = decideStripeTrialCheckout({
    settings,
    plan,
    companyConsumedTrial: trialContext.companyConsumedTrial,
    isLegacyOpenEndedTrial: trialContext.isLegacyOpenEndedTrial,
  });

  const lineItems = buildStripeCheckoutLineItems({
    priceId,
    amountCents,
    currency: plan.currency,
    interval: input.interval,
    planName: plan.name,
    planId: plan.id,
    planSlug: plan.slug,
  });

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer_email: input.userEmail,
      line_items: lineItems,
      success_url: `${input.successUrl}${input.successUrl.includes("?") ? "&" : "?"}stripe=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: input.cancelUrl,
      client_reference_id: input.companyId,
      ...(trial.offer
        ? { payment_method_collection: STRIPE_TRIAL_PAYMENT_METHOD_COLLECTION }
        : {}),
      metadata: {
        companyId: input.companyId,
        planId: plan.id,
        planSlug: plan.slug,
        interval: input.interval,
        amountCents: String(amountCents),
        trial: trial.offer ? "1" : "0",
        trialDays: trial.offer ? String(trial.days) : "0",
      },
      subscription_data: {
        metadata: {
          companyId: input.companyId,
          planId: plan.id,
          planSlug: plan.slug,
          interval: input.interval,
          trial: trial.offer ? "1" : "0",
        },
        ...(trial.offer ? buildStripeTrialSubscriptionData(trial.days) : {}),
      },
    },
    {
      idempotencyKey: `checkout:${input.companyId}:${plan.id}:${input.interval}:${trial.offer ? `trial${trial.days}` : "paid"}:${Math.floor(Date.now() / 60_000)}`,
    },
  );

  if (!session.url) {
    throw new AppError(ErrorCode.UPSTREAM, "Stripe checkout URL missing.", 502);
  }

  await prisma.subscription.upsert({
    where: { companyId: input.companyId },
    create: {
      companyId: input.companyId,
      provider: "stripe",
      plan: plan.legacyEnum ?? "STARTER",
      planId: plan.id,
      status: "INCOMPLETE",
      billingInterval: input.interval,
    },
    update: {
      provider: "stripe",
      planId: plan.id,
      status: "INCOMPLETE",
      billingInterval: input.interval,
    },
  });

  await recordBillingAudit({
    companyId: input.companyId,
    eventType: "CHECKOUT_CREATED",
    metadata: {
      provider: "stripe",
      planId: plan.id,
      interval: input.interval,
      amountCents,
      sessionId: session.id,
    },
  });

  return { url: session.url, provider: "stripe" as const, sessionId: session.id };
}

export async function activateStripeCheckoutSession(input: {
  companyId: string;
  sessionId: string;
}) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(input.sessionId, {
    expand: ["subscription", "line_items", "customer"],
  });

  const sessionCompanyId =
    session.client_reference_id || session.metadata?.companyId || null;
  if (!sessionCompanyId || sessionCompanyId !== input.companyId) {
    await recordBillingAudit({
      companyId: input.companyId,
      eventType: "SUSPICIOUS_BILLING_ATTEMPT",
      metadata: { provider: "stripe", reason: "company_mismatch", sessionId: input.sessionId },
    });
    throw new AppError(ErrorCode.FORBIDDEN, "Checkout session does not match company.", 403);
  }

  const checkoutMode = assertStripeCheckoutReadyForActivation(session);

  const planId = session.metadata?.planId;
  if (!planId) {
    throw new AppError(ErrorCode.VALIDATION, "Missing plan on checkout session.", 400);
  }
  const interval =
    session.metadata?.interval === "YEAR" ? ("YEAR" as BillingInterval) : ("MONTH" as BillingInterval);
  const plan = await getCheckoutPlanOrThrow(planId);
  const expectedAmount = resolvePlanAmountCents(plan, interval);
  const configuredPriceId = resolveStripePriceId(plan, interval);

  if (planRequiresStripePriceId(plan, interval)) {
    const linePriceId = session.line_items?.data?.[0]?.price?.id;
    if (!linePriceId || linePriceId !== configuredPriceId) {
      throw new AppError(
        ErrorCode.FORBIDDEN,
        "Checkout must use the configured Stripe Price ID.",
        403,
      );
    }
    await verifyStripePriceAgainstPlan(stripe, plan, interval, linePriceId);
  } else if (checkoutMode.mode === "paid" && session.amount_total != null) {
    assertExactAmountCents(expectedAmount, session.amount_total, "Stripe checkout");
  }

  if (session.currency) {
    assertCurrencyMatch(plan.currency, session.currency);
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  if (!subscriptionId) {
    throw new AppError(ErrorCode.UPSTREAM, "Stripe subscription missing.", 502);
  }

  await assertLocalCheckoutBinding({
    companyId: input.companyId,
    provider: "stripe",
    providerSubscriptionId: subscriptionId,
    planId: plan.id,
  });

  const stripeSub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price", "default_payment_method"],
  });
  assertStripeSubscriptionActive(stripeSub);

  const paymentFingerprint = stripePaymentMethodFingerprint(
    stripeSub.default_payment_method,
  );
  if (stripeSub.status === "trialing") {
    try {
      await assertPaymentIdentityAllowsTrial(paymentFingerprint, input.companyId);
    } catch (error) {
      await stripe.subscriptions.cancel(subscriptionId);
      throw error;
    }
  }

  if (stripeSub.metadata?.companyId && stripeSub.metadata.companyId !== input.companyId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Stripe subscription company mismatch.", 403);
  }
  if (stripeSub.metadata?.planId && stripeSub.metadata.planId !== plan.id) {
    throw new AppError(ErrorCode.FORBIDDEN, "Stripe subscription plan mismatch.", 403);
  }

  const itemPriceId = stripeSub.items.data[0]?.price?.id;
  if (configuredPriceId) {
    if (!itemPriceId || itemPriceId !== configuredPriceId) {
      throw new AppError(ErrorCode.FORBIDDEN, "Stripe subscription price mismatch.", 403);
    }
    await verifyStripePriceAgainstPlan(stripe, plan, interval, itemPriceId);
  }

  const existing = await prisma.subscription.findUnique({
    where: { companyId: input.companyId },
  });
  if (
    existing?.status === "ACTIVE" &&
    existing.providerSubscriptionId === subscriptionId &&
    existing.planId === plan.id
  ) {
    return { ok: true as const };
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;

  const period = stripeSub as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };

  await applyPaidPlanActivation({
    companyId: input.companyId,
    plan,
    provider: "stripe",
    providerSubscriptionId: subscriptionId,
    providerCustomerId: customerId,
    billingInterval: interval,
    currentPeriodStart: period.current_period_start
      ? new Date(period.current_period_start * 1000)
      : new Date(),
    currentPeriodEnd: period.current_period_end
      ? new Date(period.current_period_end * 1000)
      : null,
    status: stripeSub.status === "trialing" ? "TRIALING" : "ACTIVE",
    paymentMethodBrand:
      stripePaymentMethodBrand(stripeSub.default_payment_method) ?? undefined,
    paymentMethodLast4:
      stripePaymentMethodLast4(stripeSub.default_payment_method) ?? undefined,
  });

  if (stripeSub.status === "trialing") {
    await recordCardVerifiedTrial({
      companyId: input.companyId,
      planSlug: plan.slug,
      paymentFingerprint,
    });
  }

  if (session.payment_intent && typeof session.payment_intent === "string") {
    await prisma.billingPayment.upsert({
      where: {
        provider_providerPaymentId: {
          provider: "STRIPE",
          providerPaymentId: session.payment_intent,
        },
      },
      create: {
        companyId: input.companyId,
        provider: "STRIPE",
        providerPaymentId: session.payment_intent,
        amountCents: expectedAmount,
        currency: plan.currency,
        status: "SUCCEEDED",
        billingInterval: interval,
        planSlug: plan.slug,
      },
      update: { status: "SUCCEEDED" },
    });
  }

  await recordBillingAudit({
    companyId: input.companyId,
    eventType: "PAYMENT_CONFIRMED",
    metadata: {
      provider: "stripe",
      sessionId: input.sessionId,
      subscriptionId,
      planId: plan.id,
      amountCents: expectedAmount,
    },
  });

  return { ok: true as const };
}

export async function handleStripeWebhook(rawBody: string, signature: string | null) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new AppError(ErrorCode.UPSTREAM, "Stripe webhook secret is not configured.", 503);
  }
  if (!signature) {
    throw new AppError(ErrorCode.FORBIDDEN, "Missing Stripe signature.", 401);
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    await recordBillingAudit({
      eventType: "WEBHOOK_REJECTED",
      metadata: { provider: "stripe", reason: "invalid_signature" },
    });
    throw new AppError(ErrorCode.FORBIDDEN, "Invalid Stripe webhook signature.", 401);
  }

  const { duplicate, webhookEventId } = await beginWebhookProcessing({
    provider: "STRIPE",
    eventId: event.id,
    eventType: event.type,
    payload: event,
  });
  if (duplicate) return;

  try {
    await processStripeEvent(event);
    await markWebhookProcessed(webhookEventId);
  } catch (error) {
    await markWebhookFailed(webhookEventId, error);
    throw error;
  }
}

async function processStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.metadata?.companyId ?? session.client_reference_id;
      if (!companyId || !session.metadata?.planId) {
        return;
      }
      await activateStripeCheckoutSession({
        companyId,
        sessionId: session.id,
      });
      return;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription & {
        current_period_start?: number;
        current_period_end?: number;
      };
      const companyId = sub.metadata?.companyId;
      const planId = sub.metadata?.planId;
      if (!companyId || !planId) return;
      if (sub.status === "canceled") {
        const settings = await getBillingGatewaySettings();
        if (settings.freeWorkspaceEnabled) {
          await assignFreeWorkspace(companyId, "subscription_canceled");
        }
        return;
      }
      if (sub.status !== "active" && sub.status !== "trialing" && sub.status !== "past_due") {
        return;
      }
      const plan = await prisma.plan.findUnique({ where: { id: planId } });
      if (!plan) return;

      await assertStripeSubscriptionWebhookBinding({
        companyId,
        planId: plan.id,
        providerSubscriptionId: sub.id,
      });

      const interval =
        sub.metadata?.interval === "YEAR" ? ("YEAR" as BillingInterval) : ("MONTH" as BillingInterval);
      const stripeClient = getStripe();
      const itemPriceId = sub.items.data[0]?.price?.id;
      const expectedPriceId = resolveStripePriceId(plan, interval);
      if (expectedPriceId) {
        if (!itemPriceId || itemPriceId !== expectedPriceId) {
          throw new AppError(
            ErrorCode.FORBIDDEN,
            "Stripe subscription price does not match plan.",
            403,
          );
        }
        await verifyStripePriceAgainstPlan(stripeClient, plan, interval, itemPriceId);
      }
      const status =
        sub.status === "active"
          ? "ACTIVE"
          : sub.status === "past_due"
            ? "PAST_DUE"
            : sub.status === "canceled"
              ? "CANCELED"
              : sub.status === "unpaid"
                ? "UNPAID"
                : sub.status === "trialing"
                  ? "TRIALING"
                  : "INCOMPLETE";

      let paymentFingerprint: string | null = null;
      if (sub.status === "trialing") {
        const expanded = await stripeClient.subscriptions.retrieve(sub.id, {
          expand: ["default_payment_method"],
        });
        paymentFingerprint = stripePaymentMethodFingerprint(
          expanded.default_payment_method,
        );
        try {
          await assertPaymentIdentityAllowsTrial(paymentFingerprint, companyId);
        } catch {
          await stripeClient.subscriptions.cancel(sub.id);
          const settings = await getBillingGatewaySettings();
          if (settings.freeWorkspaceEnabled) {
            await assignFreeWorkspace(companyId, "payment_identity_consumed");
          }
          return;
        }
      }

      await applyPaidPlanActivation({
        companyId,
        plan,
        provider: "stripe",
        providerSubscriptionId: sub.id,
        providerCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        billingInterval: interval,
        currentPeriodStart: sub.current_period_start
          ? new Date(sub.current_period_start * 1000)
          : new Date(),
        currentPeriodEnd: sub.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : null,
        status,
        paymentMethodBrand: stripePaymentMethodBrand(
          typeof sub.default_payment_method === "object"
            ? sub.default_payment_method
            : null,
        ),
        paymentMethodLast4: stripePaymentMethodLast4(
          typeof sub.default_payment_method === "object"
            ? sub.default_payment_method
            : null,
        ),
      });
      if (sub.status === "trialing") {
        await recordCardVerifiedTrial({
          companyId,
          planSlug: plan.slug,
          paymentFingerprint,
        });
      }
      return;
    }
    case "customer.subscription.trial_will_end": {
      const sub = event.data.object as Stripe.Subscription;
      const companyId = sub.metadata?.companyId
        ?? await findCompanyByStripeCustomer(
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
        );
      if (!companyId) return;
      const { enqueueBillingWarning } = await import(
        "@/services/billing/billing-warnings"
      );
      await enqueueBillingWarning({
        companyId,
        kind: "trial_ending",
        gracePeriodEndsAt: sub.trial_end
          ? new Date(sub.trial_end * 1000)
          : null,
      });
      return;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const existing = await prisma.subscription.findFirst({
        where: { providerSubscriptionId: sub.id },
      });
      if (!existing) return;
      const settings = await getBillingGatewaySettings();
      if (settings.freeWorkspaceEnabled) {
        await assignFreeWorkspace(existing.companyId, "subscription_deleted");
        return;
      }
      await updateSubscriptionStatus({
        companyId: existing.companyId,
        status: "CANCELED",
        eventType: "SUBSCRIPTION_CANCELLED",
        cancelAtPeriodEnd: false,
        canceledAt: new Date(),
        metadata: { provider: "stripe", event: event.type },
      });
      return;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription_details?: { metadata?: Record<string, string> | null } | null;
        subscription?: string | { id?: string } | null;
      };
      const companyId =
        invoice.subscription_details?.metadata?.companyId ??
        (await findCompanyByStripeCustomer(
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
        ));
      if (!companyId || !invoice.id) return;
      const sub = await prisma.subscription.findUnique({ where: { companyId } });
      await prisma.billingInvoice.upsert({
        where: {
          provider_providerInvoiceId: { provider: "STRIPE", providerInvoiceId: invoice.id },
        },
        create: {
          companyId,
          subscriptionId: sub?.id,
          provider: "STRIPE",
          providerInvoiceId: invoice.id,
          number: invoice.number,
          amountCents: invoice.amount_paid ?? invoice.amount_due ?? 0,
          currency: invoice.currency ?? "usd",
          status: "PAID",
          hostedInvoiceUrl: invoice.hosted_invoice_url,
          pdfUrl: invoice.invoice_pdf,
          periodStart: invoice.period_start
            ? new Date(invoice.period_start * 1000)
            : null,
          periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
          paidAt: new Date(),
        },
        update: {
          status: "PAID",
          amountCents: invoice.amount_paid ?? invoice.amount_due ?? 0,
          hostedInvoiceUrl: invoice.hosted_invoice_url,
          pdfUrl: invoice.invoice_pdf,
          paidAt: new Date(),
        },
      });
      return;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const companyId = await findCompanyByStripeCustomer(
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
      );
      if (!companyId) return;
      const { markSubscriptionPaymentFailed } = await import(
        "@/services/billing/reconcile"
      );
      await markSubscriptionPaymentFailed({
        companyId,
        eventType: "PAYMENT_FAILED",
        metadata: { provider: "stripe", invoiceId: invoice.id },
      });
      if (invoice.id) {
        const failedSub = await prisma.subscription.findUnique({ where: { companyId } });
        await prisma.billingInvoice.upsert({
          where: {
            provider_providerInvoiceId: { provider: "STRIPE", providerInvoiceId: invoice.id },
          },
          create: {
            companyId,
            subscriptionId: failedSub?.id,
            provider: "STRIPE",
            providerInvoiceId: invoice.id,
            number: invoice.number,
            amountCents: invoice.amount_due ?? invoice.amount_remaining ?? 0,
            currency: invoice.currency ?? "usd",
            status: "OPEN",
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            pdfUrl: invoice.invoice_pdf,
          },
          update: {
            status: "OPEN",
            amountCents: invoice.amount_due ?? invoice.amount_remaining ?? 0,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            pdfUrl: invoice.invoice_pdf,
          },
        });
      }
      return;
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      if (!charge.id) return;
      const paymentId = charge.payment_intent?.toString() ?? charge.id;
      await prisma.billingPayment.updateMany({
        where: { provider: "STRIPE", providerPaymentId: paymentId },
        data: { status: charge.refunded ? "REFUNDED" : "PARTIALLY_REFUNDED" },
      });
      const companyId = await findCompanyByStripeCustomer(
        typeof charge.customer === "string" ? charge.customer : charge.customer?.id,
      );
      if (companyId && charge.refunded) {
        await revokePaidEntitlements({
          companyId,
          reason: "refund",
          provider: "stripe",
          providerReferenceId: charge.id,
        });
      }
      return;
    }
    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const chargeId =
        typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
      if (!chargeId) return;
      const stripeClient = getStripe();
      const charge = await stripeClient.charges.retrieve(chargeId);
      const companyId = await findCompanyByStripeCustomer(
        typeof charge.customer === "string" ? charge.customer : charge.customer?.id,
      );
      if (companyId) {
        await revokePaidEntitlements({
          companyId,
          reason: "chargeback",
          provider: "stripe",
          providerReferenceId: dispute.id,
        });
      }
      return;
    }
    default:
      return;
  }
}

function stripePaymentMethodFingerprint(
  method: string | Stripe.PaymentMethod | null | undefined,
): string | null {
  if (!method || typeof method === "string") return null;
  return method.card?.fingerprint ?? null;
}

function stripePaymentMethodBrand(
  method: string | Stripe.PaymentMethod | null | undefined,
): string | null {
  if (!method || typeof method === "string") return null;
  return method.card?.brand ?? method.type ?? null;
}

function stripePaymentMethodLast4(
  method: string | Stripe.PaymentMethod | null | undefined,
): string | null {
  if (!method || typeof method === "string") return null;
  return method.card?.last4 ?? null;
}

async function recordCardVerifiedTrial(input: {
  companyId: string;
  planSlug: string;
  paymentFingerprint: string | null;
}) {
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    include: { users: { where: { role: "OWNER" }, take: 1 } },
  });
  const owner = company?.users[0];
  const result = await assessTrialRisk({
    email: owner?.email ?? `${input.companyId}@trial.bidvera`,
    companyName: company?.name ?? input.companyId,
    companyDomain: company?.domain,
    emailVerified: owner?.emailVerified ?? true,
    hasPaymentIdentity: Boolean(input.paymentFingerprint),
    paymentFingerprint: input.paymentFingerprint,
  });
  result.signals.trialConsumed = true;
  await persistTrialRisk({
    companyId: input.companyId,
    email: owner?.email ?? `${input.companyId}@trial.bidvera`,
    domain: company?.domain,
    paymentFingerprint: input.paymentFingerprint,
    result,
  });
  const { recordSubscriptionEvent } = await import(
    "@/services/billing/subscription-state"
  );
  const already = await prisma.subscriptionEvent.findFirst({
    where: { companyId: input.companyId, eventType: "TRIAL_STARTED" },
    select: { id: true },
  });
  if (!already) {
    await recordSubscriptionEvent({
      companyId: input.companyId,
      eventType: "TRIAL_STARTED",
      toStatus: "TRIALING",
      toPlan: input.planSlug,
      metadata: {
        planSlug: input.planSlug,
        paymentIdentityRecorded: Boolean(input.paymentFingerprint),
      },
    });
  }
}

async function findCompanyByStripeCustomer(customerId?: string | null) {
  if (!customerId) return null;
  const matches = await prisma.subscription.findMany({
    where: { providerCustomerId: customerId },
    select: { companyId: true },
    take: 3,
  });
  return resolveUniqueCompanyIdFromCustomerMatches(matches);
}

export async function cancelStripeSubscription(companyId: string, atPeriodEnd = true) {
  const sub = await prisma.subscription.findUnique({ where: { companyId } });
  if (!sub?.providerSubscriptionId || sub.provider !== "stripe") {
    throw new AppError(ErrorCode.VALIDATION, "No Stripe subscription to cancel.", 400);
  }
  const stripe = getStripe();
  if (atPeriodEnd) {
    await stripe.subscriptions.update(sub.providerSubscriptionId, {
      cancel_at_period_end: true,
    });
    await updateSubscriptionStatus({
      companyId,
      status: sub.status,
      eventType: "SUBSCRIPTION_CANCEL_SCHEDULED",
      cancelAtPeriodEnd: true,
      metadata: { provider: "stripe" },
    });
  } else {
    await stripe.subscriptions.cancel(sub.providerSubscriptionId);
    await updateSubscriptionStatus({
      companyId,
      status: "CANCELED",
      eventType: "SUBSCRIPTION_CANCELLED",
      cancelAtPeriodEnd: false,
      canceledAt: new Date(),
      metadata: { provider: "stripe" },
    });
  }
}
