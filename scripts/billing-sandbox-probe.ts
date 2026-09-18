/**
 * Probes PayPal/Stripe sandbox credentials and reports BLOCKED vs reachable.
 * Does NOT simulate payments — only verifies env + auth/token endpoints.
 *
 * Usage: npx tsx scripts/billing-sandbox-probe.ts
 */

export {};

type ProbeResult = "PASS" | "FAIL" | "BLOCKED";

interface ProbeReport {
  paypal: { status: ProbeResult; detail: string };
  stripe: { status: ProbeResult; detail: string };
  timestamp: string;
}

async function probePayPal(): Promise<{ status: ProbeResult; detail: string }> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  if (!clientId || !secret) {
    return {
      status: "BLOCKED",
      detail: "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not set in environment.",
    };
  }

  const raw = (
    process.env.PAYPAL_ENVIRONMENT ??
    process.env.PAYPAL_MODE ??
    "sandbox"
  )
    .trim()
    .toLowerCase();
  const base =
    raw === "production" || raw === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

  try {
    const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!response.ok) {
      return {
        status: "FAIL",
        detail: `OAuth token request failed (${response.status}). Check sandbox credentials.`,
      };
    }
    const json = (await response.json()) as { access_token?: string };
    if (!json.access_token) {
      return { status: "FAIL", detail: "OAuth succeeded but access_token missing." };
    }
    const webhookNote = webhookId
      ? "Webhook ID configured."
      : "PAYPAL_WEBHOOK_ID missing — webhook E2E will fail until configured.";
    return {
      status: "PASS",
      detail: `Sandbox OAuth OK (${mode}). ${webhookNote} Full checkout E2E still requires manual sandbox payment.`,
    };
  } catch (error) {
    return {
      status: "FAIL",
      detail: error instanceof Error ? error.message : "PayPal probe failed.",
    };
  }
}

async function probeStripe(): Promise<{ status: ProbeResult; detail: string }> {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    return {
      status: "BLOCKED",
      detail: "STRIPE_SECRET_KEY not set in environment.",
    };
  }

  try {
    const response = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (response.status === 401) {
      return { status: "FAIL", detail: "Stripe secret key rejected (401)." };
    }
    if (!response.ok) {
      return {
        status: "FAIL",
        detail: `Stripe API probe failed (${response.status}).`,
      };
    }
    const webhookNote = webhookSecret
      ? "Webhook secret configured."
      : "STRIPE_WEBHOOK_SECRET missing — signed webhook E2E blocked.";
    return {
      status: "PASS",
      detail: `Stripe API reachable (test/live key accepted). ${webhookNote} Full checkout E2E requires manual sandbox payment + webhook.`,
    };
  } catch (error) {
    return {
      status: "FAIL",
      detail: error instanceof Error ? error.message : "Stripe probe failed.",
    };
  }
}

async function main() {
  const report: ProbeReport = {
    paypal: await probePayPal(),
    stripe: await probeStripe(),
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.paypal.status === "FAIL" || report.stripe.status === "FAIL" ? 1 : 0);
}

main();
