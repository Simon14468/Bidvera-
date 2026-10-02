/**
 * Super Admin — billing provider credentials (PayPal / Stripe vault).
 */

import type { SuperAdminContext } from "@/auth/super-admin-session";
import { writeAdminAudit } from "@/services/admin/audit";
import { revalidatePublicPlanSurfaces } from "@/application/admin/revalidate-plans";
import {
  getPaypalCredentialsAdminSnapshot,
  getStripeCredentialsAdminSnapshot,
  paypalCredentialsAuditSafe,
  savePaypalCredentialsAdmin,
  saveStripeCredentialsAdmin,
  stripeCredentialsAuditSafe,
  testPaypalConnection,
  testStripeConnection,
} from "@/services/billing/provider-credentials";

export async function getBillingProviderCredentialsForAdmin() {
  const [paypal, stripe] = await Promise.all([
    getPaypalCredentialsAdminSnapshot(),
    getStripeCredentialsAdminSnapshot(),
  ]);
  return { paypal, stripe };
}

export async function savePaypalCredentialsForAdmin(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const before = paypalCredentialsAuditSafe(
    await getPaypalCredentialsAdminSnapshot(),
  );
  const snap = await savePaypalCredentialsAdmin(raw);
  const after = paypalCredentialsAuditSafe(snap);
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "BILLING_PAYPAL_CREDENTIALS_UPDATED",
    targetType: "billing_credentials",
    targetId: "billing.paypal.vault",
    previousValue: before,
    newValue: after,
    ipHash,
    metadata: {
      secretRotated: Boolean(
        (raw as { clientSecret?: string | null })?.clientSecret?.trim?.(),
      ),
      cleared: Boolean((raw as { clearAll?: boolean })?.clearAll),
    },
  });
  if (before.environment !== after.environment) {
    revalidatePublicPlanSurfaces();
  }
  return snap;
}

export async function saveStripeCredentialsForAdmin(
  ctx: SuperAdminContext,
  raw: unknown,
  ipHash?: string | null,
) {
  const before = stripeCredentialsAuditSafe(
    await getStripeCredentialsAdminSnapshot(),
  );
  const snap = await saveStripeCredentialsAdmin(raw);
  const after = stripeCredentialsAuditSafe(snap);
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "BILLING_STRIPE_CREDENTIALS_UPDATED",
    targetType: "billing_credentials",
    targetId: "billing.stripe.vault",
    previousValue: before,
    newValue: after,
    ipHash,
    metadata: {
      secretRotated: Boolean(
        (raw as { secretKey?: string | null })?.secretKey?.trim?.(),
      ),
      cleared: Boolean((raw as { clearAll?: boolean })?.clearAll),
    },
  });
  return snap;
}

export async function testPaypalConnectionForAdmin(
  ctx: SuperAdminContext,
  ipHash?: string | null,
) {
  const result = await testPaypalConnection();
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "BILLING_PAYPAL_CONNECTION_TESTED",
    targetType: "billing_credentials",
    targetId: "billing.paypal.vault",
    newValue: {
      ok: result.ok,
      connectionStatus: result.snapshot.connectionStatus,
      environment: result.snapshot.environment,
    },
    ipHash,
  });
  return result;
}

export async function testStripeConnectionForAdmin(
  ctx: SuperAdminContext,
  ipHash?: string | null,
) {
  const result = await testStripeConnection();
  await writeAdminAudit({
    adminUserId: ctx.admin.id,
    action: "BILLING_STRIPE_CONNECTION_TESTED",
    targetType: "billing_credentials",
    targetId: "billing.stripe.vault",
    newValue: {
      ok: result.ok,
      connectionStatus: result.snapshot.connectionStatus,
    },
    ipHash,
  });
  return result;
}
