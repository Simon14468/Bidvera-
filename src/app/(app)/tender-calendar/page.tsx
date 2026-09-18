export const dynamic = "force-dynamic";

import {
  requireTenderCalendarModule,
  getCalendarDashboard,
  getCalendarMonth,
} from "@/modules/tender-calendar";
import { canManageCompanySettings } from "@/auth/company-settings-access";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarDays } from "lucide-react";
import Link from "next/link";

export default async function TenderCalendarHomePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { auth, companyId } = await requireTenderCalendarModule();
  const canManage = canManageCompanySettings(auth.user.role);
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year || now.getUTCFullYear());
  const month = Number(sp.month || now.getUTCMonth() + 1);
  const [dash, monthItems] = await Promise.all([
    getCalendarDashboard(companyId),
    getCalendarMonth({ companyId, year, month }),
  ]);

  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Tender Calendar
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Deadlines & reminders</h1>
          <p className="mt-1 text-sm text-muted">
            Track submission dates and get reminder alerts for opportunities you follow.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/tender-calendar/tenders"
            className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            Tracked opportunities
          </Link>
          <Link
            href="/tender-calendar/settings"
            className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            Reminders
          </Link>
          {canManage ? (
            <Link
              href="/tender-calendar/new"
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
            >
              Add tender
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Tracked tenders</CardDescription>
            <CardTitle className="text-2xl">{dash.tenderCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Upcoming deadlines</CardDescription>
            <CardTitle className="text-2xl">{dash.upcoming.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Past deadlines</CardDescription>
            <CardTitle className="text-2xl">{dash.past.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Calendar · {monthLabel}</h2>
          <div className="flex gap-2 text-sm">
            <Link
              href={`/tender-calendar?year=${prev.year}&month=${prev.month}`}
              className="rounded-lg border border-border px-2 py-1"
            >
              Prev
            </Link>
            <Link
              href={`/tender-calendar?year=${next.year}&month=${next.month}`}
              className="rounded-lg border border-border px-2 py-1"
            >
              Next
            </Link>
          </div>
        </div>
        {monthItems.length === 0 ? (
          dash.tenderCount === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No opportunities on your calendar yet"
              description="Add a tender opportunity with a submission deadline to start tracking reminders."
              actionLabel={canManage ? "Add opportunity" : undefined}
              actionHref={canManage ? "/tender-calendar/new" : undefined}
            />
          ) : (
            <p className="text-sm text-muted">No deadlines or events this month.</p>
          )
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {monthItems.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={`/tender-calendar/${item.tenderId}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-foreground/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted">
                      {item.tenderTitle} · {item.kind === "deadline" ? "Deadline" : "Event"}
                      {item.timezone ? ` · ${item.timezone}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {item.occursAt.slice(0, item.dateOnly ? 10 : 16).replace("T", " ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Upcoming deadlines</h2>
        {dash.upcoming.length === 0 ? (
          <p className="text-sm text-muted">No upcoming deadlines.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {dash.upcoming.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/tender-calendar/${d.tenderId}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-foreground/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className="text-xs text-muted">
                      {d.tenderTitle} · {d.type} · {d.status}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {d.occursAt.slice(0, d.dateOnly ? 10 : 16).replace("T", " ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
