import {
  assertTenderCalendarAvailable,
  editCalendarDeadline,
  removeCalendarDeadline,
  removeCalendarEvent,
} from "@/modules/tender-calendar";
import { assertCanManageCompanySettings } from "@/auth/company-settings-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(request: NextRequest) {
  try {
    const { auth, companyId } = await requireCompanyIdApi();
    assertCanManageCompanySettings(auth.user.role);
    await assertTenderCalendarAvailable(companyId);
    const body = (await request.json()) as { id?: string } & Record<string, unknown>;
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const deadline = await editCalendarDeadline(companyId, body.id, body);
    return NextResponse.json({ deadline });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { auth, companyId } = await requireCompanyIdApi();
    assertCanManageCompanySettings(auth.user.role);
    await assertTenderCalendarAvailable(companyId);    const sp = new URL(request.url).searchParams;
    const id = sp.get("id");
    const kind = sp.get("kind") ?? "deadline";
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    if (kind === "event") {
      await removeCalendarEvent(companyId, id);
    } else {
      await removeCalendarDeadline(companyId, id);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
