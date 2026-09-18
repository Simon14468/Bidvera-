/**
 * Central plan configuration — never hard-code prices in UI or domain logic.
 * Amounts in smallest currency unit. Currency: USD.
 * Billing provider is modular (PayPal primary; Stripe keys retained for future).
 */
export type PlanId = "trial" | "starter" | "pro" | "business" | "free";

export interface PlanConfig {
  id: PlanId;
  name: string;
  prismaPlan: "TRIAL" | "STARTER" | "PRO" | "BUSINESS" | "FREE";
  priceMonthlyCents: number;
  currency: "usd";
  analysesLimit: number;
  seats: number;
  features: string[];
  /** PayPal Billing Plan ID (env key name) */
  paypalPlanEnvKey?: string;
  /** Optional future Stripe price env key */
  stripePriceEnvKey?: string;
  highlighted?: boolean;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free Workspace",
    prismaPlan: "FREE",
    priceMonthlyCents: 0,
    currency: "usd",
    analysesLimit: 0,
    seats: 1,
    features: ["Company profile", "Document Compliance (limited)"],
  },
  trial: {
    id: "trial",
    name: "Trial",
    prismaPlan: "TRIAL",
    priceMonthlyCents: 0,
    currency: "usd",
    analysesLimit: 3,
    seats: 1,
    features: ["3 free tender analyses", "Full decision workspace", "Company profile"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    prismaPlan: "STARTER",
    priceMonthlyCents: 1900,
    currency: "usd",
    analysesLimit: 20,
    seats: 2,
    features: ["20 analyses / month", "Deadline alerts", "Email support"],
    paypalPlanEnvKey: "PAYPAL_PLAN_STARTER",
    stripePriceEnvKey: "STRIPE_PRICE_STARTER",
  },
  pro: {
    id: "pro",
    name: "Pro",
    prismaPlan: "PRO",
    priceMonthlyCents: 4900,
    currency: "usd",
    analysesLimit: 75,
    seats: 5,
    features: [
      "75 analyses / month",
      "Up to 5 seats",
      "Decision Memory",
      "Decision Simulator",
      "Team Decision Workflow",
    ],
    paypalPlanEnvKey: "PAYPAL_PLAN_PRO",
    stripePriceEnvKey: "STRIPE_PRICE_PRO",
    highlighted: true,
  },
  business: {
    id: "business",
    name: "Business",
    prismaPlan: "BUSINESS",
    priceMonthlyCents: 9900,
    currency: "usd",
    analysesLimit: 250,
    seats: 15,
    features: [
      "250 analyses / month",
      "Up to 15 seats",
      "SSO-ready roles",
      "Priority support",
    ],
    paypalPlanEnvKey: "PAYPAL_PLAN_BUSINESS",
    stripePriceEnvKey: "STRIPE_PRICE_BUSINESS",
  },
};

export const PAID_PLANS = [PLANS.starter, PLANS.pro, PLANS.business] as const;

export function getPlanByPrisma(
  plan: "TRIAL" | "STARTER" | "PRO" | "BUSINESS" | "FREE",
): PlanConfig {
  return Object.values(PLANS).find((p) => p.prismaPlan === plan) ?? PLANS.trial;
}

export function getPlanById(planId: string): PlanConfig | null {
  return (PLANS as Record<string, PlanConfig>)[planId] ?? null;
}

export function formatPlanPrice(plan: PlanConfig): string {
  if (plan.priceMonthlyCents === 0) return "$0";
  return `$${(plan.priceMonthlyCents / 100).toFixed(0)}`;
}
