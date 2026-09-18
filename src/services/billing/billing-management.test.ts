import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { billingGatewayAdminSchema, planUpsertSchema } from "@/domain/schemas/admin";
import { ADMIN_ENTITLEMENT_KEYS } from "@/domain/billing/entitlement-catalog";
import {
  canOpenStripeBillingPortal,
  isPaypalManagedBilling,
} from "@/services/billing/billing-portal";
import { toCustomerFacingInvoice } from "@/services/billing/customer-invoices";
import {
  applyFreeWorkspaceCheckoutGuard,
  parseOptionalQuotaLimit,
} from "@/services/billing/free-plan-guard";
import { resolveBillingDisplayStatus } from "@/services/billing/billing-display";
import { getDictionary } from "@/i18n/dictionaries";
import { locales } from "@/i18n/config";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("A. billing history DTO never exposes Stripe identifiers", () => {
  const dto = toCustomerFacingInvoice({
    id: "local-history-1",
    companyId: "co_1",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    paidAt: new Date("2026-09-01T01:00:00.000Z"),
    amountCents: 4900,
    currency: "usd",
    status: "PAID",
    hostedInvoiceUrl: "https://invoice.stripe.com/i/example",
    pdfUrl: null,
  });
  assert.equal(dto.amountCents, 4900);
  assert.equal(dto.currency, "usd");
  assert.equal(dto.status, "PAID");
  assert.equal(dto.receiptUrl, "https://invoice.stripe.com/i/example");
  assert.equal("providerInvoiceId" in dto, false);
  assert.doesNotMatch(JSON.stringify(dto), /in_/);
});

test("B. payment method portal is Stripe-only when a customer exists", () => {
  assert.equal(
    canOpenStripeBillingPortal({ provider: "stripe", providerCustomerId: "cus_123" }),
    true,
  );
  assert.equal(
    canOpenStripeBillingPortal({ provider: "stripe", providerCustomerId: null }),
    false,
  );
  assert.equal(
    canOpenStripeBillingPortal({ provider: "paypal", providerCustomerId: "cus_123" }),
    false,
  );
});

test("C. payment method update uses the authorized server action", () => {
  const actions = readSrc("src/app/actions.ts");
  assert.match(actions, /export async function openBillingPortalAction/);
  assert.match(actions, /requireCompanyId/);
  assert.match(actions, /createStripeBillingPortalSession/);
  assert.doesNotMatch(actions, /cardNumber|cvc|paymentFingerprint/i);
  const button = readSrc("src/components/billing/update-payment-method-button.tsx");
  assert.match(button, /openBillingPortalAction/);
});

test("D/E. payment failure and past due stay on lifecycle statuses", () => {
  assert.equal(
    resolveBillingDisplayStatus({ status: "PAYMENT_FAILED", plan: "PRO" }),
    "PAYMENT_FAILED",
  );
  assert.equal(
    resolveBillingDisplayStatus({ status: "PAST_DUE", plan: "STARTER" }),
    "PAST_DUE",
  );
  assert.equal(
    resolveBillingDisplayStatus({ status: "UNPAID", plan: "BUSINESS" }),
    "UNPAID",
  );
});

test("F. Free Workspace cannot become a checkout product", () => {
  const guarded = applyFreeWorkspaceCheckoutGuard({
    slug: "free",
    isFree: true,
    stripeEnabled: true,
    paypalEnabled: true,
    trialEligible: true,
    monthlyPriceCents: 1900,
    annualPriceCents: 19000,
  });
  assert.equal(guarded.isFree, true);
  assert.equal(guarded.stripeEnabled, false);
  assert.equal(guarded.paypalEnabled, false);
  assert.equal(guarded.trialEligible, false);
  assert.equal(guarded.monthlyPriceCents, 0);
  assert.equal(guarded.annualPriceCents, null);
  const paid = applyFreeWorkspaceCheckoutGuard({
    slug: "pro",
    isFree: false,
    stripeEnabled: true,
    paypalEnabled: true,
    monthlyPriceCents: 4900,
  });
  assert.equal(paid.monthlyPriceCents, 4900);
  assert.equal(paid.stripeEnabled, true);
});

test("G/H. Super Admin schemas keep prices and trialDays DB-backed", () => {
  const plan = planUpsertSchema.parse({
    slug: "pro",
    name: "Pro",
    monthlyPriceCents: 4900,
    annualPriceCents: 49000,
    analysesLimit: 75,
    seatsLimit: 5,
    trialEligible: true,
    trialDays: 14,
    status: "ACTIVE",
    featureList: [],
    featureKeys: ["company_profile"],
  });
  assert.equal(plan.monthlyPriceCents, 4900);
  assert.equal(plan.trialDays, 14);
  const settings = billingGatewayAdminSchema.parse({
    stripeEnabled: true,
    paypalEnabled: true,
    defaultGateway: "stripe",
    trialEnabled: true,
    trialDays: 21,
    freeWorkspaceEnabled: true,
    requirePaymentMethodForTrial: true,
    graceDays: 3,
    cancelSubsOnPlanDisable: false,
    cancelSubsOnGatewayDisable: false,
  });
  assert.equal(settings.trialDays, 21);
  assert.equal(settings.requirePaymentMethodForTrial, true);
  assert.equal(settings.freeWorkspaceEnabled, true);
});

test("I. Super Admin entitlement update stays on authorized actions", () => {
  const sa = readSrc("src/app/actions/super-admin.ts");
  assert.match(sa, /saUpsertPlan/);
  assert.match(sa, /requireWritableSuperAdmin/);
  assert.match(readSrc("src/application/admin/plan-service.ts"), /syncPlanFeatureKeys/);
});

test("J. AI limit configuration: null unlimited, 0 blocked, positive enforced", () => {
  assert.equal(parseOptionalQuotaLimit(""), null);
  assert.equal(parseOptionalQuotaLimit("   "), null);
  assert.equal(parseOptionalQuotaLimit("0"), 0);
  assert.equal(parseOptionalQuotaLimit("12000"), 12000);
  const plan = planUpsertSchema.parse({
    slug: "starter",
    name: "Starter",
    monthlyPriceCents: 1900,
    analysesLimit: 20,
    seatsLimit: 2,
    aiTokensLimit: 0,
    status: "ACTIVE",
    featureList: [],
    featureKeys: [],
  });
  assert.equal(plan.aiTokensLimit, 0);
  const unlimited = planUpsertSchema.parse({
    slug: "business",
    name: "Business",
    monthlyPriceCents: 9900,
    analysesLimit: 250,
    seatsLimit: 15,
    aiTokensLimit: null,
    status: "ACTIVE",
    featureList: [],
    featureKeys: [],
  });
  assert.equal(unlimited.aiTokensLimit, null);
});

test("K. PayPal billing stays provider-native", () => {
  assert.equal(isPaypalManagedBilling({ provider: "paypal" }), true);
  assert.equal(isPaypalManagedBilling({ provider: "stripe" }), false);
});

test("L. billing mutations stay tenant-scoped", () => {
  const page = readSrc("src/app/(app)/billing/page.tsx");
  const actions = readSrc("src/app/actions.ts");
  assert.match(page, /requireCompanyId/);
  assert.match(actions, /openBillingPortalAction/);
  assert.match(actions, /requireCompanyId/);
  assert.doesNotMatch(page, /STRIPE_SECRET_KEY|paymentFingerprint|riskScore/);
});

test("M. commercially-off features stay out of purchasable admin keys", () => {
  assert.equal(ADMIN_ENTITLEMENT_KEYS.includes("matching_engine"), false);
  assert.equal(ADMIN_ENTITLEMENT_KEYS.includes("tender_discovery"), false);
  assert.equal(ADMIN_ENTITLEMENT_KEYS.includes("tender_analysis"), false);
  assert.ok(ADMIN_ENTITLEMENT_KEYS.includes("company_profile"));
  assert.ok(ADMIN_ENTITLEMENT_KEYS.includes("document_compliance"));
});

test("N. billing dictionaries include payment and history copy", () => {
  for (const locale of locales) {
    const billing = getDictionary(locale).app.billing;
    assert.ok(billing.billingHistory);
    assert.ok(billing.updatePaymentMethod);
    assert.ok(billing.retryPayment);
    assert.ok(billing.paymentFailed);
    assert.ok(billing.pastDue);
    assert.ok(billing.freeWorkspace);
  }
});
