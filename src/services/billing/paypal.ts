import { AppError, ErrorCode } from "@/lib/errors";
import { prisma } from "@/lib/db";
import {
  assertPlanAllowsCheckout,
  getCheckoutPlanOrThrow,
  resolvePlanAmountCents,
  resolvePaypalPlanId,
} from "@/services/billing/catalog";
import { recordBillingAudit } from "@/services/billing/audit";
import { assertGatewayEnabled } from "@/services/billing/settings";
import {
  applyPaidPlanActivation,
  updateSubscriptionStatus,
} from "@/services/billing/subscription-state";
import { revokePayPalSubscriptionPayment } from "@/services/billing/revocation";
import {
  verifyPayPalSubscriptionForActivation,
  type PayPalSubscriptionSnapshot,
} from "@/services/billing/verification";
import {
  beginWebhookProcessing,
  markWebhookFailed,
  markWebhookProcessed,
} from "@/services/billing/webhooks-store";
import type { BillingInterval } from "@prisma/client";

import {
  resolvePaypalCredentials,
} from "@/services/billing/provider-credentials";

/**
 * sandbox | live (sync, env-only).
 * Prefer resolvePaypalEnvironmentAsync when vault fallback is allowed.
 * Accepts PAYPAL_ENVIRONMENT=production and legacy PAYPAL_MODE=live.
 * In NODE_ENV=production never silently defaults to sandbox (defaults to live).
 */
export function resolvePaypalEnvironment(): "sandbox" | "live" {
  const raw = (
    process.env.PAYPAL_ENVIRONMENT ??
    process.env.PAYPAL_MODE ??
    ""
  )
    .trim()
    .toLowerCase();
  if (raw === "production" || raw === "live") return "live";
  if (raw === "sandbox") return "sandbox";
  return process.env.NODE_ENV === "production" ? "live" : "sandbox";
}

export function paypalBaseUrl(environment?: "sandbox" | "live") {
  const env = environment ?? resolvePaypalEnvironment();
  return env === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

/**
 * Fail-closed gate before any PayPal payment API call.
 * Uses env-first credentials with encrypted vault fallback.
 */
export async function assertPaypalRuntimeReady(): Promise<void> {
  const creds = await resolvePaypalCredentials();
  if (!creds.clientId || !creds.clientSecret) {
    throw new AppError(
      ErrorCode.UPSTREAM,
      "PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET (env or Super Admin vault).",
      503,
    );
  }
  if (creds.environment === "live") {
    const looksSandboxClient =
      creds.clientId.startsWith("sb-") || /sandbox/i.test(creds.clientId);
    if (looksSandboxClient) {
      throw new AppError(
        ErrorCode.UPSTREAM,
        "PayPal live environment requires live credentials; sandbox client IDs are blocked.",
        503,
      );
    }
    if (!creds.webhookId) {
      throw new AppError(
        ErrorCode.UPSTREAM,
        "PayPal production requires PAYPAL_WEBHOOK_ID with a valid live webhook configuration.",
        503,
      );
    }
  }
}

/** Sync env-only status — used by legacy tests. Prefer getPaypalIntegrationStatusAsync. */
export function getPaypalIntegrationStatus() {
  const raw = (
    process.env.PAYPAL_ENVIRONMENT ??
    process.env.PAYPAL_MODE ??
    ""
  )
    .trim()
    .toLowerCase();
  const explicitLive = raw === "production" || raw === "live";
  const nodeProd = process.env.NODE_ENV === "production";

  const environment: "sandbox" | "live" = explicitLive
    ? "live"
    : raw === "sandbox"
      ? "sandbox"
      : nodeProd
        ? "live"
        : "sandbox";

  const clientId = process.env.PAYPAL_CLIENT_ID?.trim() ?? "";
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim() ?? "";
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim() ?? "";
  const looksSandboxClient =
    clientId.startsWith("sb-") || /sandbox/i.test(clientId);
  const webhookConfigured = Boolean(webhookId);

  return {
    credentialsConfigured:
      Boolean(clientId && secret) && !(environment === "live" && looksSandboxClient),
    webhookConfigured,
    environment,
    productionReady:
      explicitLive &&
      Boolean(clientId && secret) &&
      !looksSandboxClient &&
      webhookConfigured,
  };
}

/** Env-first + vault-aware integration status for Super Admin / dashboards. */
export async function getPaypalIntegrationStatusAsync() {
  try {
    const creds = await resolvePaypalCredentials();
    const looksSandboxClient =
      creds.clientId.startsWith("sb-") || /sandbox/i.test(creds.clientId);
    const credentialsConfigured =
      Boolean(creds.clientId && creds.clientSecret) &&
      !(creds.environment === "live" && looksSandboxClient);
    return {
      credentialsConfigured,
      webhookConfigured: Boolean(creds.webhookId),
      environment: creds.environment,
      productionReady:
        creds.environment === "live" &&
        credentialsConfigured &&
        !looksSandboxClient &&
        Boolean(creds.webhookId),
    };
  } catch {
    return {
      credentialsConfigured: false,
      webhookConfigured: false,
      environment: (process.env.NODE_ENV === "production"
        ? "live"
        : "sandbox") as "sandbox" | "live",
      productionReady: false,
    };
  }
}

export function resolvePayPalWebhookAction(
  eventType: string | undefined,
): "activate" | "cancel" | "payment_failed" | "expired" | "refund" | "ignore" {
  switch (eventType) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "BILLING.SUBSCRIPTION.UPDATED":
      return "activate";
    case "BILLING.SUBSCRIPTION.CANCELLED":
      return "cancel";
    case "BILLING.SUBSCRIPTION.SUSPENDED":
    case "PAYMENT.SALE.DENIED":
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
      return "payment_failed";
    case "BILLING.SUBSCRIPTION.EXPIRED":
      return "expired";
    case "PAYMENT.SALE.REFUNDED":
    case "PAYMENT.SALE.REVERSED":
      return "refund";
    default:
      return "ignore";
  }
}

/** Sale events identify the subscription on billing_agreement_id, not resource.id. */
export function resolvePayPalWebhookSubscriptionId(event: {
  event_type?: string;
  resource?: { id?: string; billing_agreement_id?: string };
}): string | undefined {
  if (
    event.event_type === "PAYMENT.SALE.DENIED" ||
    event.event_type === "PAYMENT.SALE.REFUNDED" ||
    event.event_type === "PAYMENT.SALE.REVERSED"
  ) {
    return event.resource?.billing_agreement_id;
  }
  return event.resource?.id;
}

async function paypalApiBaseUrl(): Promise<string> {
  const creds = await resolvePaypalCredentials();
  return paypalBaseUrl(creds.environment);
}

export async function getPayPalAccessToken(): Promise<string> {
  await assertPaypalRuntimeReady();
  const creds = await resolvePaypalCredentials();

  const auth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString(
    "base64",
  );
  const response = await fetch(`${paypalBaseUrl(creds.environment)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new AppError(ErrorCode.UPSTREAM, "Unable to authenticate with PayPal.", 502);
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new AppError(ErrorCode.UPSTREAM, "PayPal token missing.", 502);
  }
  return json.access_token;
}

export async function createPayPalCheckoutSession(input: {
  companyId: string;
  userEmail: string;
  planIdOrSlug: string;
  interval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
}) {
  await assertGatewayEnabled("paypal");
  const plan = await getCheckoutPlanOrThrow(input.planIdOrSlug);
  await assertPlanAllowsCheckout({ plan, gateway: "paypal", interval: input.interval });
  const amountCents = resolvePlanAmountCents(plan, input.interval);
  const paypalPlanId = resolvePaypalPlanId(plan, input.interval);

  if (!paypalPlanId) {
    throw new AppError(
      ErrorCode.UPSTREAM,
      `PayPal plan is not configured for ${plan.name}. Set the plan ID in Super Admin.`,
      503,
    );
  }

  const token = await getPayPalAccessToken();
  // Correlation flag only — never put companyId/amount in the return URL (IDOR / tampering).
  // PayPal appends subscription_id; activation binds to the authenticated company server-side.
  const success = new URL(input.successUrl);
  success.searchParams.set("paypal", "1");

  const response = await fetch(`${(await paypalApiBaseUrl())}/v1/billing/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      "PayPal-Request-Id": `bv-${input.companyId}-${plan.id}-${input.interval}-${Math.floor(Date.now() / 60_000)}`,
    },
    body: JSON.stringify({
      plan_id: paypalPlanId,
      custom_id: `${input.companyId}:${plan.id}:${input.interval}:${amountCents}`,
      subscriber: { email_address: input.userEmail },
      application_context: {
        brand_name: "Bidvera",
        user_action: "SUBSCRIBE_NOW",
        return_url: success.toString(),
        cancel_url: input.cancelUrl,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new AppError(
      ErrorCode.UPSTREAM,
      `PayPal checkout failed (${response.status}).`,
      502,
      { body: body.slice(0, 300) },
    );
  }

  const json = (await response.json()) as {
    id?: string;
    links?: Array<{ rel: string; href: string }>;
  };

  const approve = json.links?.find((l) => l.rel === "approve")?.href;
  if (!approve || !json.id) {
    throw new AppError(ErrorCode.UPSTREAM, "PayPal approval URL missing.", 502);
  }

  const { recordPendingCheckout } = await import(
    "@/services/billing/pending-checkout"
  );
  await recordPendingCheckout({
    companyId: input.companyId,
    provider: "paypal",
    planId: plan.id,
    interval: input.interval,
    providerRef: json.id,
  });

  await recordBillingAudit({
    companyId: input.companyId,
    eventType: "CHECKOUT_CREATED",
    metadata: {
      provider: "paypal",
      planId: plan.id,
      interval: input.interval,
      amountCents,
      providerSubscriptionId: json.id,
    },
  });

  return { url: approve, provider: "paypal" as const, subscriptionId: json.id };
}

export async function activatePayPalSubscription(input: {
  companyId: string;
  providerSubscriptionId: string;
  /** Ignored — plan is derived from PayPal custom_id only. */
  planId?: string;
  interval?: BillingInterval;
}) {
  const token = await getPayPalAccessToken();
  const response = await fetch(
    `${(await paypalApiBaseUrl())}/v1/billing/subscriptions/${input.providerSubscriptionId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    throw new AppError(ErrorCode.UPSTREAM, "Unable to verify PayPal subscription.", 502);
  }
  const json = (await response.json()) as PayPalSubscriptionSnapshot & { id?: string };

  const verified = await verifyPayPalSubscriptionForActivation({
    companyId: input.companyId,
    providerSubscriptionId: input.providerSubscriptionId,
    snapshot: json,
  });

  const existing = await prisma.subscription.findUnique({
    where: { companyId: input.companyId },
  });
  if (
    existing?.status === "ACTIVE" &&
    existing.providerSubscriptionId === input.providerSubscriptionId &&
    existing.planId === verified.plan.id
  ) {
    const { clearPendingCheckoutIfMatch } = await import(
      "@/services/billing/pending-checkout"
    );
    await clearPendingCheckoutIfMatch({
      companyId: input.companyId,
      provider: "paypal",
      providerRef: input.providerSubscriptionId,
    });
    return;
  }

  await applyPaidPlanActivation({
    companyId: input.companyId,
    plan: verified.plan,
    provider: "paypal",
    providerSubscriptionId: input.providerSubscriptionId,
    billingInterval: verified.interval,
    currentPeriodStart: new Date(),
    currentPeriodEnd: verified.currentPeriodEnd,
  });
  const { clearPendingCheckoutIfMatch } = await import(
    "@/services/billing/pending-checkout"
  );
  await clearPendingCheckoutIfMatch({
    companyId: input.companyId,
    provider: "paypal",
    providerRef: input.providerSubscriptionId,
  });

  const paymentKey = `paypal-activate:${input.providerSubscriptionId}`;
  await prisma.billingPayment.upsert({
    where: {
      provider_providerPaymentId: { provider: "PAYPAL", providerPaymentId: paymentKey },
    },
    create: {
      companyId: input.companyId,
      provider: "PAYPAL",
      providerPaymentId: paymentKey,
      amountCents: verified.expectedAmountCents,
      currency: verified.plan.currency,
      status: "SUCCEEDED",
      billingInterval: verified.interval,
      planSlug: verified.plan.slug,
    },
    update: { status: "SUCCEEDED" },
  });

  await recordBillingAudit({
    companyId: input.companyId,
    eventType: "PAYMENT_CONFIRMED",
    metadata: {
      provider: "paypal",
      providerSubscriptionId: input.providerSubscriptionId,
      planId: verified.plan.id,
      amountCents: verified.expectedAmountCents,
    },
  });
}

export async function handlePayPalWebhook(rawBody: string, headers: Headers) {
  const creds = await resolvePaypalCredentials();
  if (!creds.webhookId || !creds.clientId) {
    throw new AppError(
      ErrorCode.UPSTREAM,
      "PayPal webhook verification is not configured.",
      503,
    );
  }

  let event: {
    id?: string;
    event_type?: string;
    resource?: {
      id?: string;
      status?: string;
      custom_id?: string;
    };
  };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    throw new AppError(ErrorCode.VALIDATION, "Invalid PayPal webhook payload.", 400);
  }

  const token = await getPayPalAccessToken();
  const verify = await fetch(
    `${paypalBaseUrl(creds.environment)}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: headers.get("paypal-auth-algo"),
        cert_url: headers.get("paypal-cert-url"),
        transmission_id: headers.get("paypal-transmission-id"),
        transmission_sig: headers.get("paypal-transmission-sig"),
        transmission_time: headers.get("paypal-transmission-time"),
        webhook_id: creds.webhookId,
        webhook_event: event,
      }),
    },
  );
  const verified = (await verify.json()) as { verification_status?: string };
  if (verified.verification_status !== "SUCCESS") {
    await recordBillingAudit({
      eventType: "WEBHOOK_REJECTED",
      metadata: { provider: "paypal", reason: "invalid_signature" },
    });
    throw new AppError(ErrorCode.FORBIDDEN, "Invalid PayPal webhook signature.", 401);
  }

  const eventId =
    event.id ??
    headers.get("paypal-transmission-id") ??
    `paypal-${event.event_type}-${event.resource?.id ?? "unknown"}`;

  const { duplicate, webhookEventId } = await beginWebhookProcessing({
    provider: "PAYPAL",
    eventId,
    eventType: event.event_type ?? "unknown",
    payload: event,
  });
  if (duplicate) return;

  try {
    await processPayPalEvent(event);
    await markWebhookProcessed(webhookEventId);
  } catch (error) {
    await markWebhookFailed(webhookEventId, error);
    throw error;
  }
}

async function processPayPalEvent(event: {
  event_type?: string;
  resource?: {
    id?: string;
    status?: string;
    custom_id?: string;
    billing_agreement_id?: string;
    state?: string;
  };
}) {
  const subId = resolvePayPalWebhookSubscriptionId(event);
  const custom = event.resource?.custom_id ?? "";
  const [companyId, planId] = custom.split(":");

  if (
    event.event_type === "PAYMENT.SALE.REFUNDED" ||
    event.event_type === "PAYMENT.SALE.REVERSED"
  ) {
    const agreementId = event.resource?.billing_agreement_id;
    const saleId = event.resource?.id;
    if (!agreementId || !saleId) return;
    await revokePayPalSubscriptionPayment({
      providerSubscriptionId: agreementId,
      reason: event.event_type === "PAYMENT.SALE.REVERSED" ? "chargeback" : "refund",
      providerReferenceId: saleId,
    });
    return;
  }

  if (event.event_type === "BILLING.SUBSCRIPTION.ACTIVATED" && subId) {
    const boundCompanyId =
      companyId && planId
        ? companyId
        : (
            await prisma.subscription.findFirst({
              where: { providerSubscriptionId: subId, provider: "paypal" },
            })
          )?.companyId;
    if (boundCompanyId) {
      await activatePayPalSubscription({
        companyId: boundCompanyId,
        providerSubscriptionId: subId,
      });
    }
    return;
  }

  if (
    event.event_type === "BILLING.SUBSCRIPTION.UPDATED" &&
    companyId &&
    planId &&
    subId &&
    event.resource?.status === "ACTIVE"
  ) {
    await activatePayPalSubscription({
      companyId,
      providerSubscriptionId: subId,
    });
    return;
  }

  if (event.event_type === "BILLING.SUBSCRIPTION.CANCELLED" && subId) {
    const existing = await prisma.subscription.findFirst({
      where: { providerSubscriptionId: subId, provider: "paypal" },
    });
    if (!existing) {
      const companyFromCustom = custom.split(":")[0];
      if (companyFromCustom) {
        const { clearPendingCheckoutIfMatch } = await import(
          "@/services/billing/pending-checkout"
        );
        await clearPendingCheckoutIfMatch({
          companyId: companyFromCustom,
          provider: "paypal",
          providerRef: subId,
        });
      }
      return;
    }
    await updateSubscriptionStatus({
      companyId: existing.companyId,
      status: "CANCELED",
      eventType: "SUBSCRIPTION_CANCELLED",
      cancelAtPeriodEnd: true,
      canceledAt: new Date(),
      metadata: { provider: "paypal" },
    });
    return;
  }

  if (
    (event.event_type === "BILLING.SUBSCRIPTION.SUSPENDED" ||
      event.event_type === "PAYMENT.SALE.DENIED" ||
      event.event_type === "BILLING.SUBSCRIPTION.PAYMENT.FAILED") &&
    subId
  ) {
    const existing = await prisma.subscription.findFirst({
      where: { providerSubscriptionId: subId, provider: "paypal" },
    });
    if (!existing) return;
    const { markSubscriptionPaymentFailed } = await import(
      "@/services/billing/reconcile"
    );
    await markSubscriptionPaymentFailed({
      companyId: existing.companyId,
      eventType: "PAYMENT_FAILED",
      metadata: { provider: "paypal", event: event.event_type },
    });
    return;
  }

  if (event.event_type === "BILLING.SUBSCRIPTION.EXPIRED" && subId) {
    const existing = await prisma.subscription.findFirst({
      where: { providerSubscriptionId: subId, provider: "paypal" },
    });
    if (!existing) return;
    const { getBillingGatewaySettings } = await import("@/services/billing/settings");
    const settings = await getBillingGatewaySettings();
    if (settings.freeWorkspaceEnabled) {
      const { assignFreeWorkspace } = await import("@/services/billing/free-workspace");
      await assignFreeWorkspace(existing.companyId, "subscription_deleted");
      return;
    }
    await updateSubscriptionStatus({
      companyId: existing.companyId,
      status: "EXPIRED",
      eventType: "SUBSCRIPTION_EXPIRED",
      metadata: { provider: "paypal" },
    });
  }
}

export async function cancelPayPalSubscription(companyId: string) {
  const sub = await prisma.subscription.findUnique({ where: { companyId } });
  if (!sub?.providerSubscriptionId || sub.provider !== "paypal") {
    throw new AppError(ErrorCode.VALIDATION, "No PayPal subscription to cancel.", 400);
  }
  const token = await getPayPalAccessToken();
  const response = await fetch(
    `${(await paypalApiBaseUrl())}/v1/billing/subscriptions/${sub.providerSubscriptionId}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "Cancelled by customer in Bidvera" }),
    },
  );
  if (!response.ok && response.status !== 204) {
    throw new AppError(ErrorCode.UPSTREAM, "Unable to cancel PayPal subscription.", 502);
  }
  await updateSubscriptionStatus({
    companyId,
    status: "CANCELED",
    eventType: "SUBSCRIPTION_CANCELLED",
    cancelAtPeriodEnd: true,
    canceledAt: new Date(),
    metadata: { provider: "paypal" },
  });
}
