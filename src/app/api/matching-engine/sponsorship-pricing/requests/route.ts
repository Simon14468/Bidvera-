import {
  assertMatchingEngineAvailable,
  isMatchingSponsorshipGloballyEnabled,
  listEnabledSponsorshipGateways,
  listSponsoredMatchingPlanRequestsForCompany,
  requestSponsoredMatchingPlanForCompany,
} from "@/modules/matching-engine";
import { assertCanManageCompanySettings } from "@/auth/company-settings-access";
import { requireCompanyIdApi } from "@/auth/session";
import { AppError, ErrorCode, toSafeClientError } from "@/lib/errors";
import { NextResponse } from "next/server";

async function assertSponsoredMatchingAvailable() {
  if (!(await isMatchingSponsorshipGloballyEnabled())) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Sponsored Matching is not available.",
      403,
    );
  }
}

function appOrigin(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) return `${proto}://${host}`;
  try {
    return new URL(req.url).origin;
  } catch {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  }
}

/** Company-scoped sponsorship pricing requests (own tenant only). */
export async function GET() {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertMatchingEngineAvailable(companyId);
    await assertSponsoredMatchingAvailable();
    const [requests, gateways] = await Promise.all([
      listSponsoredMatchingPlanRequestsForCompany(companyId),
      listEnabledSponsorshipGateways(),
    ]);
    return NextResponse.json({ requests, gateways });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function POST(req: Request) {
  try {
    const { auth, companyId } = await requireCompanyIdApi();
    assertCanManageCompanySettings(auth.user.role);
    await assertMatchingEngineAvailable(companyId);
    await assertSponsoredMatchingAvailable();
    const body = (await req.json()) as {
      planId?: string;
      notes?: string;
      gateway?: "stripe" | "paypal";
    };
    if (!body.planId?.trim()) {
      throw new AppError(ErrorCode.VALIDATION, "planId is required.", 400);
    }
    const origin = appOrigin(req);
    const successUrl = `${origin}/matched-opportunities/sponsored`;
    const cancelUrl = `${origin}/matched-opportunities/sponsored?cancelled=1`;
    const result = await requestSponsoredMatchingPlanForCompany({
      companyId,
      planId: body.planId.trim(),
      notes: body.notes ?? null,
      userEmail: auth.user.email,
      successUrl,
      cancelUrl,
      gateway: body.gateway ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
