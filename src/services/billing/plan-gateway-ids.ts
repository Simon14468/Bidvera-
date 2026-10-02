/**
 * Plan gateway mapping rules.
 * Provider IDs are not secrets. Provider credentials never belong here.
 */

/** Inline price_data is a local/test fallback only — never production. */
export function allowStripeInlinePriceData(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv === "development" || nodeEnv === "test";
}

const STRIPE_PRICE_ID = /^price_[A-Za-z0-9]{8,}$/;
/** PayPal billing Plan IDs are `P-` plus 24 uppercase alphanumeric characters. */
const PAYPAL_BILLING_PLAN_ID = /^P-[A-Z0-9]{24}$/;
const STRIPE_NON_PRICE_PREFIX = /^(prod_|sub_|cus_|pi_|cs_|ch_|seti_|acct_|pm_|src_)/i;

export function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function isUsableStripePriceId(value: string | null | undefined): boolean {
  const id = blankToNull(value);
  if (!id) return false;
  if (STRIPE_NON_PRICE_PREFIX.test(id)) return false;
  return STRIPE_PRICE_ID.test(id);
}

export function isUsablePaypalBillingPlanId(value: string | null | undefined): boolean {
  const id = blankToNull(value);
  if (!id) return false;
  return PAYPAL_BILLING_PLAN_ID.test(id);
}

export function planExemptFromGatewayMappings(plan: {
  slug: string;
  isFree: boolean;
}): boolean {
  return plan.slug === "trial" || (plan.slug === "free" && plan.isFree);
}

export function enforceNonCheckoutGatewayFlags<
  T extends { slug: string; isFree?: boolean; stripeEnabled?: boolean; paypalEnabled?: boolean },
>(input: T): T {
  if (planExemptFromGatewayMappings({ slug: input.slug, isFree: Boolean(input.isFree) })) {
    return { ...input, stripeEnabled: false, paypalEnabled: false };
  }
  return input;
}

export type PaypalCheckoutEnvironment = "sandbox" | "live";

export type PaypalPlanMapping = {
  paypalPlanMonthly?: string | null;
  paypalPlanAnnual?: string | null;
  paypalSandboxPlanMonthly?: string | null;
  paypalSandboxPlanAnnual?: string | null;
  paypalPlanIdEnv?: string | null;
};

export type PlanGatewayWriteInput = {
  name: string;
  slug: string;
  isFree: boolean;
  monthlyEnabled: boolean;
  annualEnabled: boolean;
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  stripePriceMonthly: string | null;
  stripePriceAnnual: string | null;
  paypalPlanMonthly: string | null;
  paypalPlanAnnual: string | null;
  paypalSandboxPlanMonthly?: string | null;
  paypalSandboxPlanAnnual?: string | null;
};

export type PlanGatewayWriteResult = {
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  stripePriceMonthly: string | null;
  stripePriceAnnual: string | null;
  paypalPlanMonthly: string | null;
  paypalPlanAnnual: string | null;
  paypalSandboxPlanMonthly: string | null;
  paypalSandboxPlanAnnual: string | null;
  errors: string[];
};

/**
 * Live IDs live on paypalPlanMonthly/Annual.
 * Sandbox IDs live on paypalSandboxPlanMonthly/Annual.
 * A value in one environment is never read as the other environment's Plan ID.
 */
export function paypalPlanIdForEnvironment(
  plan: PaypalPlanMapping,
  interval: "MONTH" | "YEAR",
  environment: PaypalCheckoutEnvironment,
  readEnv: (name: string) => string | undefined = (name) => process.env[name],
): string | null {
  if (environment === "sandbox") {
    return blankToNull(
      interval === "YEAR" ? plan.paypalSandboxPlanAnnual : plan.paypalSandboxPlanMonthly,
    );
  }
  if (interval === "YEAR") return blankToNull(plan.paypalPlanAnnual);
  return (
    blankToNull(plan.paypalPlanMonthly) ||
    (plan.paypalPlanIdEnv ? blankToNull(readEnv(plan.paypalPlanIdEnv)) : null)
  );
}

export type PaypalIntervalStatus = "Off" | "Configured" | "Missing" | "Invalid" | "Optional";

export function paypalIntervalStatus(input: {
  paypalEnabled: boolean;
  intervalEnabled: boolean;
  id: string | null | undefined;
  required: boolean;
}): PaypalIntervalStatus {
  if (!input.paypalEnabled || !input.intervalEnabled) return "Off";
  const id = blankToNull(input.id);
  if (!id) return input.required ? "Missing" : "Optional";
  return isUsablePaypalBillingPlanId(id) ? "Configured" : "Invalid";
}

function intervalIdError(input: {
  planName: string;
  gatewayLabel: "Stripe" | "PayPal";
  intervalLabel: "Monthly" | "Annual";
  id: string | null;
  usable: (value: string | null) => boolean;
  enabled: boolean;
}): string | null {
  if (!input.enabled) {
    if (input.id && !input.usable(input.id)) {
      return `${input.gatewayLabel} ${input.intervalLabel} ID for ${input.planName} is not a valid ${input.gatewayLabel === "Stripe" ? "Stripe Price ID (price_…)" : "PayPal billing Plan ID (P-…)"}.`;
    }
    return null;
  }
  if (!input.id) {
    const field =
      input.gatewayLabel === "Stripe"
        ? `${input.intervalLabel} Stripe Price ID`
        : `${input.intervalLabel} PayPal Plan ID`;
    return `${input.gatewayLabel} is enabled for ${input.planName}, but the ${field} is missing.`;
  }
  if (!input.usable(input.id)) {
    return input.gatewayLabel === "Stripe"
      ? `Stripe is enabled for ${input.planName}, but the ${input.intervalLabel} Stripe Price ID must be a Stripe Price ID starting with price_.`
      : `PayPal is enabled for ${input.planName}, but the ${input.intervalLabel} PayPal Plan ID is not a valid PayPal billing Plan ID.`;
  }
  return null;
}

function paypalFormatError(planName: string, label: string, id: string | null): string | null {
  if (!id || isUsablePaypalBillingPlanId(id)) return null;
  return `PayPal is enabled for ${planName}, but the ${label} is not a valid PayPal billing Plan ID.`;
}

export function normalizePlanGatewayWrite(
  input: PlanGatewayWriteInput,
  options?: { paypalEnvironment?: PaypalCheckoutEnvironment },
): PlanGatewayWriteResult {
  const paypalEnvironment = options?.paypalEnvironment ?? "live";
  const stripePriceMonthly = blankToNull(input.stripePriceMonthly);
  const stripePriceAnnual = blankToNull(input.stripePriceAnnual);
  const paypalPlanMonthly = blankToNull(input.paypalPlanMonthly);
  const paypalPlanAnnual = blankToNull(input.paypalPlanAnnual);
  const paypalSandboxPlanMonthly = blankToNull(input.paypalSandboxPlanMonthly);
  const paypalSandboxPlanAnnual = blankToNull(input.paypalSandboxPlanAnnual);

  if (planExemptFromGatewayMappings(input)) {
    return {
      stripeEnabled: false,
      paypalEnabled: false,
      stripePriceMonthly,
      stripePriceAnnual,
      paypalPlanMonthly,
      paypalPlanAnnual,
      paypalSandboxPlanMonthly,
      paypalSandboxPlanAnnual,
      errors: [],
    };
  }

  const activeMonthly =
    paypalEnvironment === "sandbox" ? paypalSandboxPlanMonthly : paypalPlanMonthly;
  const activeMonthlyLabel =
    paypalEnvironment === "sandbox"
      ? "Sandbox Monthly PayPal Plan ID"
      : "Monthly PayPal Plan ID";
  const paypalErrors: Array<string | null> = [];
  if (input.paypalEnabled) {
    if (input.monthlyEnabled) {
      if (!activeMonthly) {
        paypalErrors.push(
          `PayPal is enabled for ${input.name}, but the ${activeMonthlyLabel} is missing.`,
        );
      } else {
        paypalErrors.push(paypalFormatError(input.name, activeMonthlyLabel, activeMonthly));
      }
    }
    const inactiveMonthly =
      paypalEnvironment === "sandbox" ? paypalPlanMonthly : paypalSandboxPlanMonthly;
    const inactiveMonthlyLabel =
      paypalEnvironment === "sandbox"
        ? "Live Monthly PayPal Plan ID"
        : "Sandbox Monthly PayPal Plan ID";
    paypalErrors.push(paypalFormatError(input.name, inactiveMonthlyLabel, inactiveMonthly));
    paypalErrors.push(
      paypalFormatError(input.name, "Live Annual PayPal Plan ID", paypalPlanAnnual),
    );
    paypalErrors.push(
      paypalFormatError(input.name, "Sandbox Annual PayPal Plan ID", paypalSandboxPlanAnnual),
    );
  }

  const errors = [
    intervalIdError({
      planName: input.name,
      gatewayLabel: "Stripe",
      intervalLabel: "Monthly",
      id: stripePriceMonthly,
      usable: isUsableStripePriceId,
      enabled: input.stripeEnabled && input.monthlyEnabled,
    }),
    intervalIdError({
      planName: input.name,
      gatewayLabel: "Stripe",
      intervalLabel: "Annual",
      id: stripePriceAnnual,
      usable: isUsableStripePriceId,
      enabled: input.stripeEnabled && input.annualEnabled,
    }),
    ...paypalErrors,
  ].filter((message): message is string => Boolean(message));

  return {
    stripeEnabled: input.stripeEnabled,
    paypalEnabled: input.paypalEnabled,
    stripePriceMonthly,
    stripePriceAnnual,
    paypalPlanMonthly,
    paypalPlanAnnual,
    paypalSandboxPlanMonthly,
    paypalSandboxPlanAnnual,
    errors,
  };
}

export type GatewayMappingLabel =
  | "Off"
  | "Configured"
  | "Missing Monthly"
  | "Missing Annual"
  | "Invalid Monthly"
  | "Invalid Annual";

export function gatewayMappingLabels(input: {
  enabled: boolean;
  monthlyEnabled: boolean;
  annualEnabled: boolean;
  monthlyId: string | null;
  annualId: string | null;
  usable: (value: string | null) => boolean;
}): GatewayMappingLabel[] {
  if (!input.enabled) return ["Off"];
  const labels: GatewayMappingLabel[] = [];
  if (input.monthlyEnabled) {
    if (!blankToNull(input.monthlyId)) labels.push("Missing Monthly");
    else if (!input.usable(input.monthlyId)) labels.push("Invalid Monthly");
  }
  if (input.annualEnabled) {
    if (!blankToNull(input.annualId)) labels.push("Missing Annual");
    else if (!input.usable(input.annualId)) labels.push("Invalid Annual");
  }
  return labels.length > 0 ? labels : ["Configured"];
}
