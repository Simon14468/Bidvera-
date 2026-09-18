import {
  assertTenderCalendarAvailable,
  createCalendarTender,
  getCalendarDashboard,
  getCalendarMonth,
  listCalendarTenders,
} from "@/modules/tender-calendar";
import { assertCanManageCompanySettings } from "@/auth/company-settings-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertTenderCalendarAvailable(companyId);
    const sp = new URL(request.url).searchParams;
    const view = sp.get("view");
    if (view === "dashboard") {
      return NextResponse.json(await getCalendarDashboard(companyId));
    }
    if (view === "month") {
      const year = Number(sp.get("year") || new Date().getUTCFullYear());
      const month = Number(sp.get("month") || new Date().getUTCMonth() + 1);
      if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
      ) {
        return NextResponse.json(
          { error: "Invalid year or month." },
          { status: 400 },
        );
      }
      return NextResponse.json({
        items: await getCalendarMonth({ companyId, year, month }),
      });
    }
    return NextResponse.json({
      tenders: await listCalendarTenders({
        companyId,
        status: sp.get("status") ?? undefined,
        category: sp.get("category") ?? undefined,
        country: sp.get("country") ?? undefined,
        q: sp.get("q") ?? undefined,
      }),
    });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { auth, companyId } = await requireCompanyIdApi();
    assertCanManageCompanySettings(auth.user.role);
    await assertTenderCalendarAvailable(companyId);
    const body = await request.json();
    const tender = await createCalendarTender(companyId, body);
    return NextResponse.json({ tender }, { status: 201 });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
