import { requireCompanyIdApi } from "@/auth/session";
import { prisma } from "@/lib/db";
import { toSafeClientError } from "@/lib/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Safe subscription snapshot for post-checkout confirmation polling.
 * Never returns provider secrets or raw webhook payloads.
 * Entitlements are never granted here — read-only.
 */
export async function GET() {
  try {
    const { companyId } = await requireCompanyIdApi();
    const sub = await prisma.subscription.findUnique({
      where: { companyId },
      select: {
        status: true,
        provider: true,
        billingInterval: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        plan: true,
        billingPlan: {
          select: {
            id: true,
            slug: true,
            name: true,
            isFree: true,
          },
        },
      },
    });

    if (!sub) {
      return NextResponse.json({
        ok: true,
        confirmed: false,
        status: null,
        planName: null,
        planSlug: null,
        isFree: true,
        provider: null,
        billingInterval: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
    }

    const paidActive =
      !sub.billingPlan?.isFree &&
      sub.plan !== "TRIAL" &&
      sub.plan !== "FREE" &&
      (sub.status === "ACTIVE" || sub.status === "TRIALING");

    return NextResponse.json({
      ok: true,
      confirmed: paidActive,
      status: sub.status,
      planName: sub.billingPlan?.name ?? null,
      planSlug: sub.billingPlan?.slug ?? null,
      isFree: Boolean(sub.billingPlan?.isFree || sub.plan === "FREE"),
      provider: sub.provider,
      billingInterval: sub.billingInterval,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
