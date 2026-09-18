import { billingService } from "@/services/billing";
import { assertBillingWebhookSignatureHeaders } from "@/services/billing/webhook-guard";
import { toSafeClientError } from "@/lib/errors";
import { webhookRateLimiter } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertBillingWebhookSignatureHeaders(request.headers);
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    await webhookRateLimiter.check(`billing-webhook:${ip}`);
    const rawBody = await request.text();
    await billingService.handleWebhook(rawBody, request.headers);
    return NextResponse.json({ received: true });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
