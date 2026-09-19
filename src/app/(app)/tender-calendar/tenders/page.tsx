export const dynamic = "force-dynamic";

import {
  requireTenderCalendarModule,
  listCalendarTenders,
} from "@/modules/tender-calendar";
import { canManageCompanySettings } from "@/auth/company-settings-access";
import { EmptyState } from "@/components/ui/empty-state";
import { getDictionary } from "@/i18n/dictionaries";
import { formatMessage } from "@/i18n/format";
import { getLocale } from "@/i18n/get-locale";
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
  const locale = await getLocale();
  const t = getDictionary(locale).app.tenderCalendar;
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

  const filtered = Boolean(sp.q || sp.status || sp.category || sp.country);

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/tender-calendar" className="text-sm text-primary hover:underline">
            ← {t.calendarHome}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {t.trackedOpportunities}
          </h1>
        </div>
        {canManage ? (
          <Link
            href="/tender-calendar/new"
            className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white"
          >
            {t.addTender}
          </Link>
        ) : null}
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder={t.searchOpportunitiesPlaceholder}
          className="h-10 min-w-0 flex-1 basis-full rounded-xl border border-border bg-background px-3 text-sm sm:min-w-[12rem] sm:basis-auto"
        />
        <input
          name="country"
          defaultValue={sp.country ?? ""}
          placeholder={t.countryPlaceholder}
          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm sm:w-28"
        />
        <input
          name="category"
          defaultValue={sp.category ?? ""}
          placeholder={t.category}
          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm sm:w-32"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm sm:w-auto"
        >
          <option value="">{t.allStatuses}</option>
          {["OPEN", "WATCHING", "SUBMITTED", "CLOSED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" className="h-10 rounded-xl border border-border px-4 text-sm font-medium">
          {t.filter}
        </button>
      </form>

      {tenders.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={filtered ? t.emptyFilterTitle : t.emptyTitle}
          description={filtered ? t.emptyFilterDescription : t.emptyDescription}
          actionLabel={canManage && !filtered ? t.addTender : undefined}
          actionHref={canManage && !filtered ? "/tender-calendar/new" : undefined}
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {tenders.map((row) => (
            <li key={row.id}>
              <Link
                href={`/tender-calendar/${row.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-foreground/[0.03]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.title}</p>
                  <p className="text-xs text-muted">
                    {row.status}
                    {row.country ? ` · ${row.country}` : ""}
                    {row.category ? ` · ${row.category}` : ""}
                    {row.referenceNumber ? ` · ${row.referenceNumber}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {row.nextDeadlineAt
                    ? formatMessage(t.nextDeadlineLabel, {
                        date: row.nextDeadlineAt.slice(0, 10),
                      })
                    : t.noDeadline}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
