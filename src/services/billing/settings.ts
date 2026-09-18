import { getSetting, setSetting } from "@/services/settings";
import { z } from "zod";

export const BILLING_SETTINGS_KEY = "billing.gateways";

export const billingGatewaySettingsSchema = z.object({
  stripeEnabled: z.boolean().default(false),
  paypalEnabled: z.boolean().default(true),
  defaultGateway: z.enum(["stripe", "paypal"]).default("paypal"),
  trialEnabled: z.boolean().default(true),
  trialDays: z.number().int().min(0).max(365).default(14),
  /** After trial/paid cancel, land on the Free Workspace plan instead of EXPIRED. */
  freeWorkspaceEnabled: z.boolean().default(true),
  /** Stripe Checkout must collect a payment method before a 14-day trial starts. */
  requirePaymentMethodForTrial: z.boolean().default(true),
  /**
   * Days of continued access after payment failure (PAST_DUE).
   * 0 = revoke immediately when payment fails / grace ends.
   */
  graceDays: z.number().int().min(0).max(90).default(3),
  /** If true, disabling a plan also cancels active subscriptions on that plan */
  cancelSubsOnPlanDisable: z.boolean().default(false),
  /** If true, disabling a gateway cancels subs on that gateway */
  cancelSubsOnGatewayDisable: z.boolean().default(false),
});

export type BillingGatewaySettings = z.infer<typeof billingGatewaySettingsSchema>;

export const DEFAULT_BILLING_GATEWAY_SETTINGS: BillingGatewaySettings = {
  stripeEnabled: false,
  paypalEnabled: true,
  defaultGateway: "paypal",
  trialEnabled: true,
  trialDays: 14,
  freeWorkspaceEnabled: true,
  requirePaymentMethodForTrial: true,
  graceDays: 3,
  cancelSubsOnPlanDisable: false,
  cancelSubsOnGatewayDisable: false,
};

const PAYPAL_DEFAULT_ACTIVATION_KEY = "billing.paypal_current_default_v1";

export function parseBillingGatewaySettings(raw: unknown): BillingGatewaySettings {
  const parsed = billingGatewaySettingsSchema.safeParse(raw);
  return parsed.success
    ? parsed.data
    : { ...DEFAULT_BILLING_GATEWAY_SETTINGS };
}

async function readBillingGatewaySettings(): Promise<BillingGatewaySettings> {
  const raw = await getSetting<unknown>(
    BILLING_SETTINGS_KEY,
    DEFAULT_BILLING_GATEWAY_SETTINGS,
  );
  return parseBillingGatewaySettings(raw);
}

/**
 * One-time: persist PayPal as the current default through the existing
 * Super Admin settings blob. Later Super Admin saves remain the source of truth.
 */
export async function ensurePaypalIsCurrentDefaultProvider(): Promise<BillingGatewaySettings> {
  const already = await getSetting<boolean>(PAYPAL_DEFAULT_ACTIVATION_KEY, false);
  if (already === true) {
    return readBillingGatewaySettings();
  }
  const current = await readBillingGatewaySettings();
  const next = await saveBillingGatewaySettings({
    ...current,
    paypalEnabled: true,
    defaultGateway: "paypal",
  });
  await setSetting(
    PAYPAL_DEFAULT_ACTIVATION_KEY,
    true,
    "PayPal set as current default provider (one-time). Super Admin can change later.",
  );
  return next;
}

export async function getBillingGatewaySettings(): Promise<BillingGatewaySettings> {
  return ensurePaypalIsCurrentDefaultProvider();
}

export async function saveBillingGatewaySettings(
  input: BillingGatewaySettings,
): Promise<BillingGatewaySettings> {
  const value = billingGatewaySettingsSchema.parse(input);
  // Keep default gateway among enabled ones
  if (value.defaultGateway === "stripe" && !value.stripeEnabled && value.paypalEnabled) {
    value.defaultGateway = "paypal";
  }
  if (value.defaultGateway === "paypal" && !value.paypalEnabled && value.stripeEnabled) {
    value.defaultGateway = "stripe";
  }
  await setSetting(
    BILLING_SETTINGS_KEY,
    value,
    "Payment gateway enablement, default provider, trial policy",
  );
  return value;
}

export async function assertGatewayEnabled(
  gateway: "stripe" | "paypal",
): Promise<BillingGatewaySettings> {
  const settings = await getBillingGatewaySettings();
  if (gateway === "stripe" && !settings.stripeEnabled) {
    throw new Error("GATEWAY_DISABLED");
  }
  if (gateway === "paypal" && !settings.paypalEnabled) {
    throw new Error("GATEWAY_DISABLED");
  }
  return settings;
}
