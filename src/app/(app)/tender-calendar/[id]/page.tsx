export const dynamic = "force-dynamic";

import {
  requireTenderCalendarModule,
  getCalendarTender,
  listCalendarDeadlines,
  listCalendarEvents,
} from "@/modules/tender-calendar";
import { canManageCompanySettings } from "@/auth/company-settings-access";
import { MilestoneForms, DeleteMilestoneButton } from "../milestone-forms";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function CalendarTenderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { auth, companyId } = await requireTenderCalendarModule();
  const canManage = canManageCompanySettings(auth.user.role);
  const { id } = await params;
  const tender = await getCalendarTender(companyId, id);
  if (!tender) notFound();
  const [deadlines, events] = await Promise.all([
    listCalendarDeadlines(companyId, id),
    listCalendarEvents(companyId, id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <Link href="/tender-calendar/tenders" className="text-sm text-primary hover:underline">
          ← Tenders
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{tender.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {tender.status}
              {tender.country ? ` · ${tender.country}` : ""}
              {tender.category ? ` · ${tender.category}` : ""}
              {tender.referenceNumber ? ` · ${tender.referenceNumber}` : ""}
            </p>
          </div>
          {canManage ? (
            <Link
              href={`/tender-calendar/${tender.id}/edit`}
              className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium"
            >
              Edit
            </Link>
          ) : null}
        </div>
      </div>

      {(tender.buyerAuthority || tender.description || tender.notes) && (
        <dl className="space-y-2 rounded-xl border border-border p-4 text-sm">
          {tender.buyerAuthority ? (
            <div>
              <dt className="text-muted">Buyer / authority</dt>
              <dd className="font-medium">{tender.buyerAuthority}</dd>
            </div>
          ) : null}
          {tender.description ? (
            <div>
              <dt className="text-muted">Description</dt>
              <dd>{tender.description}</dd>
            </div>
          ) : null}
          {tender.notes ? (
            <div>
              <dt className="text-muted">Notes</dt>
              <dd>{tender.notes}</dd>
            </div>
          ) : null}
          {tender.sourceUrl ? (
            <div>
              <dt className="text-muted">Source</dt>
              <dd>
                <a href={tender.sourceUrl} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                  {tender.sourceUrl}
                </a>
              </dd>
            </div>
          ) : null}
        </dl>
      )}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Deadlines</h2>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {deadlines.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No deadlines yet.</li>
          ) : (
            deadlines.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{d.title}</p>
                  <p className="text-xs text-muted">
                    {d.type} · {d.status}
                    {d.dateOnly ? " · date-only" : ""}
                    {d.timezone ? ` · ${d.timezone}` : ""}
                    {" · "}
                    {d.occursAt.slice(0, d.dateOnly ? 10 : 16).replace("T", " ")}
                  </p>
                </div>
                {canManage ? (
                  <DeleteMilestoneButton id={d.id} kind="deadline" />
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Events</h2>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {events.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">No events yet.</li>
          ) : (
            events.map((ev) => (
              <li key={ev.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{ev.title}</p>
                  <p className="text-xs text-muted">
                    {ev.type} · {ev.status}
                    {ev.dateOnly ? " · date-only" : ""}
                    {" · "}
                    {ev.occursAt.slice(0, ev.dateOnly ? 10 : 16).replace("T", " ")}
                  </p>
                </div>
                {canManage ? (
                  <DeleteMilestoneButton id={ev.id} kind="event" />
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      {canManage ? <MilestoneForms tenderId={tender.id} /> : null}
    </div>
  );
}
