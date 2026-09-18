export const dynamic = "force-dynamic";

import {
  requireTenderCalendarModule,
  listCalendarTenders,
} from "@/modules/tender-calendar";
import { canManageCompanySettings } from "@/auth/company-settings-access";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarDays } from "lucide-react";
import Link from "next/link";

export default async function TenderCalendarListPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    category?: string;
    country?: string;
    q?: string;
  }>;
}) {
  const { auth, companyId } = await requireTenderCalendarModule();
  const canManage = canManageCompanySettings(auth.user.role);
  const sp = await searchParams;
  const tenders = await listCalendarTenders({
    companyId,
    status: sp.status,
    category: sp.category,
    country: sp.country,
    q: sp.q,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/tender-calendar" className="text-sm text-primary hover:underline">
            ← Calendar
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Tracked opportunities
          </h1>
        </div>
        {canManage ? (
          <Link
            href="/tender-calendar/new"
            className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white"
          >
            Add opportunity
          </Link>
        ) : null}
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search title, reference, buyer…"
          className="h-10 min-w-0 flex-1 basis-full rounded-xl border border-border bg-background px-3 text-sm sm:min-w-[12rem] sm:basis-auto"
        />
        <input
          name="country"
          defaultValue={sp.country ?? ""}
          placeholder="Country"
          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm sm:w-28"
        />
        <input
          name="category"
          defaultValue={sp.category ?? ""}
          placeholder="Category"
          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm sm:w-32"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm sm:w-auto"
        >
          <option value="">All statuses</option>
          {["OPEN", "WATCHING", "SUBMITTED", "CLOSED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-xl border border-border px-4 text-sm font-medium">
          Filter
        </button>
      </form>

      {tenders.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={
            sp.q || sp.status || sp.category || sp.country
              ? "No opportunities match these filters"
              : "No tracked opportunities yet"
          }
          description={
            sp.q || sp.status || sp.category || sp.country
              ? "Try clearing filters or search for a different term."
              : "Add an opportunity with a deadline to receive calendar reminders."
          }
          actionLabel={
            canManage && !(sp.q || sp.status || sp.category || sp.country)
              ? "Add opportunity"
              : undefined
          }
          actionHref={
            canManage && !(sp.q || sp.status || sp.category || sp.country)
              ? "/tender-calendar/new"
              : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {tenders.map((t) => (
            <li key={t.id}>
              <Link
                href={`/tender-calendar/${t.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-foreground/[0.03]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted">
                    {t.status}
                    {t.country ? ` · ${t.country}` : ""}
                    {t.category ? ` · ${t.category}` : ""}
                    {t.referenceNumber ? ` · ${t.referenceNumber}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {t.nextDeadlineAt
                    ? `Next ${t.nextDeadlineAt.slice(0, 10)}`
                    : "No deadline"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
