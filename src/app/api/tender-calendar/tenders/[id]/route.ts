import {
  assertTenderCalendarAvailable,
  getCalendarTender,
  updateCalendarTender,
  removeCalendarTender,
  listCalendarDeadlines,
  listCalendarEvents,
  addCalendarDeadline,
  addCalendarEvent,
} from "@/modules/tender-calendar";
import { assertCanManageCompanySettings } from "@/auth/company-settings-access";
import { requireCompanyIdApi } from "@/auth/session";
import { toSafeClientError } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { companyId } = await requireCompanyIdApi();
    await assertTenderCalendarAvailable(companyId);
    const { id } = await context.params;
    const tender = await getCalendarTender(companyId, id);
    if (!tender) {
      return NextResponse.json({ error: "Tender not found." }, { status: 404 });
    }
    const [deadlines, events] = await Promise.all([
      listCalendarDeadlines(companyId, id),
      listCalendarEvents(companyId, id),
    ]);
    return NextResponse.json({ tender, deadlines, events });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { auth, companyId } = await requireCompanyIdApi();
    assertCanManageCompanySettings(auth.user.role);
    await assertTenderCalendarAvailable(companyId);
    const { id } = await context.params;
    const body = await request.json();
    const tender = await updateCalendarTender(companyId, id, body);
    return NextResponse.json({ tender });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { auth, companyId } = await requireCompanyIdApi();
    assertCanManageCompanySettings(auth.user.role);
    await assertTenderCalendarAvailable(companyId);
    const { id } = await context.params;
    await removeCalendarTender(companyId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { auth, companyId } = await requireCompanyIdApi();
    assertCanManageCompanySettings(auth.user.role);
    await assertTenderCalendarAvailable(companyId);
    const { id } = await context.params;
    const body = (await request.json()) as { kind?: string } & Record<string, unknown>;
    if (body.kind === "event") {
      const event = await addCalendarEvent(companyId, id, body);
      return NextResponse.json({ event }, { status: 201 });
    }
    const deadline = await addCalendarDeadline(companyId, id, body);
    return NextResponse.json({ deadline }, { status: 201 });
  } catch (error) {
    const safe = toSafeClientError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
