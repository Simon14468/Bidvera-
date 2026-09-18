import { assertCanManageBilling } from "@/auth/billing-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { billingService } from "@/services/billing";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Server-side activation after PayPal return.
 * Never trusts client-only payment success — verifies subscription with PayPal.
 */
export async function POST(request: NextRequest) {
  try {
    const { auth, companyId } = await requireCompanyIdApi();
    assertCanManageBilling(auth.user.role);
    const body = (await request.json()) as {
      subscriptionId?: string;
      planId?: string;
      interval?: "MONTH" | "YEAR";
    };

    if (!body.subscriptionId) {
      return NextResponse.json({ error: "Invalid activation payload" }, { status: 400 });
    }

    if (!billingService.activateFromProviderSubscription) {
      return NextResponse.json({ error: "Provider does not support activation" }, { status: 501 });
    }

    await billingService.activateFromProviderSubscription({
      companyId,
      providerSubscriptionId: body.subscriptionId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
