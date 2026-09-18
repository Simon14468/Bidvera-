import { assertCanManageBilling } from "@/auth/billing-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { activateStripeCheckoutSession } from "@/services/billing";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { auth, companyId } = await requireCompanyIdApi();
    assertCanManageBilling(auth.user.role);
    const body = (await request.json()) as { sessionId?: string };
    if (!body.sessionId) {
      return NextResponse.json({ error: "Missing session id" }, { status: 400 });
    }
    await activateStripeCheckoutSession({
      companyId,
      sessionId: body.sessionId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
