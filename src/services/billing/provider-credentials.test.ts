import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SECRET_SETTING_KEYS } from "@/config/super-admin";
import {
  BILLING_PAYPAL_VAULT_KEY,
  BILLING_STRIPE_VAULT_KEY,
  decryptBillingVault,
  encryptBillingVault,
  maskSecretHint,
  paypalCredentialsSaveSchema,
  stripeCredentialsSaveSchema,
} from "@/services/billing/provider-credentials";

const root = process.cwd();
function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("billing provider credentials", () => {
  it("masks secrets without exposing the full value", () => {
    assert.equal(maskSecretHint("sk_live_abcdefghijklmnop"), "************mnop");
    assert.equal(maskSecretHint("abcd"), "************");
    assert.equal(maskSecretHint(""), null);
    assert.equal(maskSecretHint(null), null);
  });

  it("round-trips encrypted vault payloads", () => {
    const cipher = encryptBillingVault("billing-paypal-test", {
      clientId: "client-abc",
      clientSecret: "super-secret-value-xyz",
    });
    const plain = decryptBillingVault("billing-paypal-test", cipher);
    assert.equal(plain.clientId, "client-abc");
    assert.equal(plain.clientSecret, "super-secret-value-xyz");
    assert.notEqual(cipher, "super-secret-value-xyz");
  });

  it("keeps vault keys in SECRET_SETTING_KEYS", () => {
    assert.ok(SECRET_SETTING_KEYS.has(BILLING_PAYPAL_VAULT_KEY));
    assert.ok(SECRET_SETTING_KEYS.has(BILLING_STRIPE_VAULT_KEY));
    assert.ok(SECRET_SETTING_KEYS.has("PAYPAL_CLIENT_SECRET"));
    assert.ok(SECRET_SETTING_KEYS.has("STRIPE_SECRET_KEY"));
  });

  it("validates save schemas without requiring secrets on every update", () => {
    const paypal = paypalCredentialsSaveSchema.parse({
      clientId: "ABcd",
      environment: "sandbox",
    });
    assert.equal(paypal.environment, "sandbox");
    const stripe = stripeCredentialsSaveSchema.parse({
      publishableKey: "pk_test_x",
      clearSecretKey: false,
    });
    assert.equal(stripe.publishableKey, "pk_test_x");
  });

  it("wires Super Admin payments UI and actions without leaking secrets to clients", () => {
    const panel = read("src/components/super-admin/payment-credentials-panel.tsx");
    const admin = read("src/components/super-admin/payments-admin.tsx");
    const page = read("src/app/(super-admin)/[saKey]/(panel)/payments/page.tsx");
    const actions = read("src/app/actions/super-admin.ts");
    const stripe = read("src/services/billing/stripe.ts");
    const paypal = read("src/services/billing/paypal.ts");

    assert.match(panel, /Test PayPal Connection/);
    assert.match(panel, /Test Stripe Connection/);
    assert.match(panel, /clientSecretHint|secretKeyHint/);
    assert.doesNotMatch(panel, /clientSecret:\s*paypal\.|secretKey:\s*stripe\./);
    assert.match(admin, /PaymentCredentialsPanel/);
    assert.match(page, /providerCredentials/);
    assert.match(actions, /saSavePaypalCredentials/);
    assert.match(actions, /saTestStripeConnection/);
    assert.match(stripe, /resolveStripeCredentials/);
    assert.match(paypal, /resolvePaypalCredentials/);
  });

  it("documents environment precedence in example env files", () => {
    const example = read(".env.example");
    const prod = read("deploy/env.production.example");
    assert.match(example, /env always wins over vault/i);
    assert.match(prod, /Env wins over Super Admin/i);
    assert.match(example, /PAYPAL_CLIENT_ID/);
    assert.match(example, /STRIPE_SECRET_KEY/);
  });
});
