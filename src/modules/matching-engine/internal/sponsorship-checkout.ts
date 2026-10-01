/**
 * Sponsored Matching one-time checkout — uses Super Admin Payments credentials
 * (resolveStripeCredentials / resolvePaypalCredentials). Never invents keys.
 */

import Stripe from "stripe";
import { AppError, ErrorCode } from "@/lib/errors";
import { prisma } from "@/lib/db";
import {
  assertGatewayEnabled,
  getBillingGatewaySettings,
} from "@/services/billing/settings";
import {
  resolvePaypalCredentials,
  resolveStripeCredentials,
} from "@/services/billing/provider-credentials";
import {
  getPayPalAccessToken,
  paypalBaseUrl,
} from "@/services/billing/paypal";

export type SponsorshipCheckoutGateway = "stripe" | "paypal";

export type SponsorshipCheckoutResult = {
  url: string;
  provider: SponsorshipCheckoutGateway;
  billingRef: string;
};

async function getStripeClient(): Promise<Stripe> {
  const creds = await resolveStripeCredentials();
  if (!creds.secretKey) {
    throw new AppError(
      ErrorCode.UPSTREAM,
      "Stripe is not configured. Set STRIPE_SECRET_KEY (env or Super Admin vault).",
      503,
    );
  }
  return new Stripe(creds.secretKey);
}

export async function listEnabledSponsorshipGateways(): Promise<
  SponsorshipCheckoutGateway[]
> {
  const settings = await getBillingGatewaySettings();
  const out: SponsorshipCheckoutGateway[] = [];
  if (settings.stripeEnabled) out.push("stripe");
  if (settings.paypalEnabled) out.push("paypal");
  return out;
}

export async function resolveSponsorshipCheckoutGateway(
  preferred?: SponsorshipCheckoutGateway | null,
): Promise<SponsorshipCheckoutGateway> {
  const enabled = await listEnabledSponsorshipGateways();
  if (enabled.length === 0) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "No payment methods are available. Configure Stripe or PayPal in Super Admin Payments.",
      403,
    );
  }
  if (preferred && enabled.includes(preferred)) return preferred;
  const settings = await getBillingGatewaySettings();
  if (enabled.includes(settings.defaultGateway as SponsorshipCheckoutGateway)) {
    return settings.defaultGateway as SponsorshipCheckoutGateway;
  }
  return enabled[0]!;
}

export async function createSponsorshipStripeCheckout(input: {
  companyId: string;
  userEmail: string;
  requestId: string;
  planId: string;
  planName: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<SponsorshipCheckoutResult> {
  await assertGatewayEnabled("stripe");
  if (input.amountCents < 50) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Sponsorship amount is too low for checkout.",
      400,
    );
  }
  const stripe = await getStripeClient();
  // Stripe requires literal {CHECKOUT_SESSION_ID} placeholder — keep it unencoded.
  const successUrl = `${input.successUrl}${input.successUrl.includes("?") ? "&" : "?"}paid=1&provider=stripe&session_id={CHECKOUT_SESSION_ID}`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: input.userEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amountCents,
            product_data: {
              name: `Sponsored Matching — ${input.planName}`,
              description: "One-time Sponsored Matching purchase",
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.companyId,
      metadata: {
        kind: "matching_sponsorship",
        companyId: input.companyId,
        requestId: input.requestId,
        planId: input.planId,
        amountCents: String(input.amountCents),
      },
      payment_intent_data: {
        metadata: {
          kind: "matching_sponsorship",
          companyId: input.companyId,
          requestId: input.requestId,
          planId: input.planId,
        },
      },
    },
    {
      idempotencyKey: `msponsor:${input.requestId}:${Math.floor(Date.now() / 60_000)}`,
    },
  );

  if (!session.url || !session.id) {
    throw new AppError(ErrorCode.UPSTREAM, "Stripe checkout URL missing.", 502);
  }

  return {
    url: session.url,
    provider: "stripe",
    billingRef: session.id,
  };
}

export async function createSponsorshipPayPalCheckout(input: {
  companyId: string;
  userEmail: string;
  requestId: string;
  planId: string;
  planName: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<SponsorshipCheckoutResult> {
  await assertGatewayEnabled("paypal");
  if (input.amountCents < 50) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Sponsorship amount is too low for checkout.",
      400,
    );
  }

  const token = await getPayPalAccessToken();
  const creds = await resolvePaypalCredentials();
  const base = paypalBaseUrl(creds.environment);
  const amount = (input.amountCents / 100).toFixed(2);

  const success = new URL(input.successUrl);
  success.searchParams.set("paid", "1");
  success.searchParams.set("provider", "paypal");

  const response = await fetch(`${base}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      "PayPal-Request-Id": `msponsor-${input.requestId}-${Math.floor(Date.now() / 60_000)}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.requestId,
          custom_id: `msponsor:${input.companyId}:${input.requestId}:${input.planId}`,
          description: `Sponsored Matching — ${input.planName}`,
          amount: {
            currency_code: input.currency.toUpperCase(),
            value: amount,
          },
        },
      ],
      payer: { email_address: input.userEmail },
      application_context: {
        brand_name: "Bidvera",
        user_action: "PAY_NOW",
        return_url: success.toString(),
        cancel_url: input.cancelUrl,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new AppError(
      ErrorCode.UPSTREAM,
      `PayPal sponsorship checkout failed (${response.status}).`,
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

  return {
    url: approve,
    provider: "paypal",
    billingRef: json.id,
  };
}

export async function createSponsorshipCheckoutSession(input: {
  companyId: string;
  userEmail: string;
  requestId: string;
  planId: string;
  planName: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  gateway?: SponsorshipCheckoutGateway | null;
}): Promise<SponsorshipCheckoutResult> {
  if (checkoutImplForTests) {
    return checkoutImplForTests(input);
  }
  const gateway = await resolveSponsorshipCheckoutGateway(input.gateway);
  if (gateway === "stripe") {
    return createSponsorshipStripeCheckout(input);
  }
  return createSponsorshipPayPalCheckout(input);
}

type CheckoutImpl = (
  input: Parameters<typeof createSponsorshipCheckoutSession>[0],
) => Promise<SponsorshipCheckoutResult>;

let checkoutImplForTests: CheckoutImpl | null = null;

/** Test hook — production keeps null. */
export function setSponsorshipCheckoutImplForTests(impl: CheckoutImpl | null) {
  checkoutImplForTests = impl;
}

export async function verifySponsorshipStripePayment(input: {
  companyId: string;
  sessionId: string;
}): Promise<{ requestId: string; paid: boolean }> {
  const stripe = await getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(input.sessionId);
  if (session.metadata?.kind !== "matching_sponsorship") {
    throw new AppError(ErrorCode.VALIDATION, "Not a sponsorship checkout.", 400);
  }
  if (session.metadata.companyId !== input.companyId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Checkout does not match company.", 403);
  }
  const requestId = session.metadata.requestId;
  if (!requestId) {
    throw new AppError(ErrorCode.VALIDATION, "Missing sponsorship request.", 400);
  }
  const paid =
    session.payment_status === "paid" || session.status === "complete";
  return { requestId, paid };
}

export async function verifySponsorshipPayPalPayment(input: {
  companyId: string;
  orderId: string;
}): Promise<{ requestId: string; paid: boolean }> {
  const token = await getPayPalAccessToken();
  const creds = await resolvePaypalCredentials();
  const base = paypalBaseUrl(creds.environment);

  // Capture if still approved
  const captureRes = await fetch(`${base}/v2/checkout/orders/${input.orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  });

  let order: {
    id?: string;
    status?: string;
    purchase_units?: Array<{
      custom_id?: string;
      reference_id?: string;
    }>;
  };

  if (captureRes.ok) {
    order = (await captureRes.json()) as typeof order;
  } else {
    // Already captured — fetch order
    const getRes = await fetch(`${base}/v2/checkout/orders/${input.orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!getRes.ok) {
      throw new AppError(ErrorCode.UPSTREAM, "Unable to verify PayPal order.", 502);
    }
    order = (await getRes.json()) as typeof order;
  }

  const custom = order.purchase_units?.[0]?.custom_id ?? "";
  const parts = custom.split(":");
  // msponsor:companyId:requestId:planId
  if (parts[0] !== "msponsor" || parts[1] !== input.companyId || !parts[2]) {
    throw new AppError(ErrorCode.FORBIDDEN, "PayPal order does not match company.", 403);
  }
  const requestId = parts[2];
  const paid = order.status === "COMPLETED" || order.status === "APPROVED";
  return { requestId, paid };
}

export async function markSponsorshipRequestPaid(input: {
  companyId: string;
  requestId: string;
  billingRef: string;
  billingStatus: string;
}) {
  const row = await prisma.matchingSponsorshipPricingRequest.findFirst({
    where: { id: input.requestId, companyId: input.companyId },
  });
  if (!row) {
    throw new AppError(ErrorCode.NOT_FOUND, "Sponsorship request not found.", 404);
  }
  if (row.status === "PAID") {
    return row;
  }
  return prisma.matchingSponsorshipPricingRequest.update({
    where: { id: row.id },
    data: {
      status: "PAID",
      billingRef: input.billingRef,
      billingStatus: input.billingStatus,
    },
  });
}
