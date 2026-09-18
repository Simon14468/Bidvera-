import {
  assertMatchingEngineAvailable,
  createCompanySponsorship,
  isMatchingSponsorshipGloballyEnabled,
  listCompanySponsorships,
  transitionCompanySponsorship,
} from "@/modules/matching-engine";
import { assertCanManageCompanySettings } from "@/auth/company-settings-access";
import { requireCompanyIdApi } from "@/auth/session";
import { AppError, ErrorCode, toSafeClientError } from "@/lib/errors";
import { NextResponse } from "next/server";

async function assertCompanySponsorshipAvailable(companyId: string) {
  await assertMatchingEngineAvailable(companyId);
  if (!(await isMatchingSponsorshipGloballyEnabled())) {
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "Matching sponsorship is not enabled.",
      403,
    );
  }
}

/** Company-scoped sponsorship management — own sponsorships only. */
export async function GET() {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertCompanySponsorshipAvailable(companyId);
    const sponsorships = await listCompanySponsorships(companyId);
    return NextResponse.json({ sponsorships });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function POST(req: Request) {
  try {
    const { auth, companyId } = await requireCompanyIdApi();
    assertCanManageCompanySettings(auth.user.role);
    await assertCompanySponsorshipAvailable(companyId);
    const body = (await req.json()) as {
      opportunityId?: string;
      startsAt?: string | null;
      endsAt?: string | null;
      campaignMeta?: unknown;
      action?: "create" | "transition";
      sponsorshipId?: string;
      to?: "ACTIVE" | "PAUSED" | "ENDED";
    };

    if (body.action === "transition") {
      if (!body.sponsorshipId || !body.to) {
        return NextResponse.json(
          { error: "sponsorshipId and to are required." },
          { status: 400 },
        );
      }
      if (body.to === "ACTIVE") {
        throw new AppError(
          ErrorCode.FORBIDDEN,
          "Sponsorship activation requires Super Admin approval while payment is not integrated.",
          403,
        );
      }
      const sponsorship = await transitionCompanySponsorship({
        companyId,
        sponsorshipId: body.sponsorshipId,
        to: body.to,
      });
      return NextResponse.json({ sponsorship });
    }

    if (!body.opportunityId) {
      return NextResponse.json(
        { error: "opportunityId is required." },
        { status: 400 },
      );
    }
    const sponsorship = await createCompanySponsorship({
      companyId,
      opportunityId: body.opportunityId,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      campaignMeta: body.campaignMeta,
    });
    return NextResponse.json({ sponsorship });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
