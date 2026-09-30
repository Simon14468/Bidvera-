import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  billingAbsoluteUrl,
  buildCheckoutCancelUrl,
  buildCheckoutSuccessUrl,
  CHECKOUT_SUCCESS_PATH,
  sanitizeCheckoutCancelPath,
} from "@/services/billing/billing-app-url";

function readSrc(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const PROD = { NEXT_PUBLIC_APP_URL: "https://getbidvera.com" };

test("checkout success URL is always /dashboard on production origin", () => {
  assert.equal(CHECKOUT_SUCCESS_PATH, "/dashboard");
  assert.equal(
    buildCheckoutSuccessUrl(PROD),
    "https://getbidvera.com/dashboard",
  );
  assert.doesNotMatch(buildCheckoutSuccessUrl(PROD), /localhost|127\.0\.0\.1/);
});

test("checkout cancel path allowlist rejects open redirects", () => {
  assert.equal(sanitizeCheckoutCancelPath("/upgrade"), "/upgrade");
  assert.equal(sanitizeCheckoutCancelPath("/billing"), "/billing");
  assert.equal(sanitizeCheckoutCancelPath("/onboarding/plan"), "/onboarding/plan");
  assert.equal(sanitizeCheckoutCancelPath("https://evil.example/phish"), "/upgrade");
  assert.equal(sanitizeCheckoutCancelPath("//evil.example"), "/upgrade");
  assert.equal(sanitizeCheckoutCancelPath("/upgrade?next=https://evil"), "/upgrade");
  assert.equal(sanitizeCheckoutCancelPath("../etc/passwd"), "/upgrade");
  assert.equal(sanitizeCheckoutCancelPath("javascript:alert(1)"), "/upgrade");
  assert.equal(
    buildCheckoutCancelUrl("/onboarding/plan", PROD),
    "https://getbidvera.com/onboarding/plan?canceled=1",
  );
  assert.equal(
    buildCheckoutCancelUrl("https://evil.example", PROD),
    "https://getbidvera.com/upgrade?canceled=1",
  );
});

test("startCheckoutAction uses fixed success URL builders (no client success path)", () => {
  const actions = readSrc("src/app/actions.ts");
  const start = actions.slice(actions.indexOf("export async function startCheckoutAction"));
  const fn = start.slice(0, start.indexOf("export async function openBillingPortalAction"));
  assert.match(fn, /buildCheckoutSuccessUrl/);
  assert.match(fn, /buildCheckoutCancelUrl/);
  assert.match(fn, /sanitizeCheckoutCancelPath/);
  assert.doesNotMatch(fn, /successUrl: `\$\{base\}\$\{returnPath\}/);
  assert.doesNotMatch(fn, /checkout=success/);
});

test("PayPal return URL does not embed companyId or client plan amount", () => {
  const paypal = readSrc("src/services/billing/paypal.ts");
  const start = paypal.indexOf("export async function createPayPalCheckoutSession");
  const end = paypal.indexOf("export async function activatePayPalSubscription");
  const fn = paypal.slice(start, end);
  assert.match(fn, /success\.searchParams\.set\("paypal", "1"\)/);
  assert.doesNotMatch(fn, /searchParams\.set\("companyId"/);
  assert.doesNotMatch(fn, /searchParams\.set\("planId"/);
  assert.doesNotMatch(fn, /searchParams\.set\("amount/);
  assert.match(fn, /custom_id: `\$\{input\.companyId\}:\$\{plan\.id\}/);
});

test("Stripe success URL still correlates session_id for server verification only", () => {
  const stripe = readSrc("src/services/billing/stripe.ts");
  const start = stripe.indexOf("export async function createStripeCheckoutSession");
  const end = stripe.indexOf("export async function activateStripeCheckoutSession");
  const fn = stripe.slice(start, end);
  assert.match(fn, /session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.match(fn, /stripe=1/);
  assert.match(fn, /metadata:\s*\{[\s\S]*companyId: input\.companyId/);
  assert.match(fn, /planId: plan\.id/);
});

test("dashboard confirmation never treats query alone as payment success", () => {
  const dash = readSrc("src/app/(app)/dashboard/page.tsx");
  assert.match(dash, /CheckoutConfirmation/);
  assert.match(dash, /never mean "paid"/);
  assert.doesNotMatch(dash, /Payment successful/);
  const confirm = readSrc("src/components/billing/checkout-confirmation.tsx");
  assert.match(confirm, /Your payment is being confirmed/);
  assert.match(confirm, /Payment could not be confirmed/);
  assert.match(confirm, /\/api\/billing\/activate-stripe/);
  assert.match(confirm, /\/api\/billing\/subscription-status/);
  assert.doesNotMatch(confirm, /Payment successful/);
  assert.match(confirm, /confirmed/);
});

test("activate APIs bind to authenticated company (IDOR defense)", () => {
  const stripeActivate = readSrc("src/app/api/billing/activate-stripe/route.ts");
  assert.match(stripeActivate, /requireCompanyIdApi/);
  assert.match(stripeActivate, /assertCanManageBilling/);
  assert.match(stripeActivate, /companyId/);
  assert.doesNotMatch(stripeActivate, /body\.companyId/);

  const paypalActivate = readSrc("src/app/api/billing/activate/route.ts");
  assert.match(paypalActivate, /requireCompanyIdApi/);
  assert.match(paypalActivate, /companyId/);
  assert.doesNotMatch(paypalActivate, /body\.companyId/);

  const status = readSrc("src/app/api/billing/subscription-status/route.ts");
  assert.match(status, /requireCompanyIdApi/);
  assert.match(status, /confirmed: paidActive/);
  assert.doesNotMatch(status, /STRIPE_SECRET_KEY|PAYPAL_CLIENT_SECRET|webhookSecret/);
});

test("billingAbsoluteUrl production dashboard matches requirement", () => {
  assert.equal(
    billingAbsoluteUrl("/dashboard", PROD),
    "https://getbidvera.com/dashboard",
  );
});
