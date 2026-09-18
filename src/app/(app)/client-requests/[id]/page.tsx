export const dynamic = "force-dynamic";

import {
  getClientRequest,
  requireClientRequestsModule,
} from "@/modules/client-requests";
import { ClientRequestStatusBadge } from "@/modules/client-requests/ui/status-badge";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestDetailActions } from "./request-detail-actions";

export default async function ClientRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { companyId } = await requireClientRequestsModule();
  const { id } = await params;
  let request;
  try {
    request = await getClientRequest(companyId, id);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-fade-in">
      <div>
        <Link
          href="/client-requests"
          className="text-sm text-primary hover:underline"
        >
          ← Client Requests
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              {request.clientName}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {request.title}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Deadline {request.deadline.slice(0, 10)} · Progress{" "}
              {request.progressPercent}% ({request.completedItemCount}/
              {request.itemCount})
            </p>
          </div>
          <ClientRequestStatusBadge status={request.status} />
        </div>
      </div>

      <section className="rounded-xl border border-border p-4 space-y-2">
        <h2 className="text-base font-semibold">Request details</h2>
        {request.description ? (
          <p className="text-sm whitespace-pre-wrap">{request.description}</p>
        ) : (
          <p className="text-sm text-muted">No description provided.</p>
        )}
        <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${request.progressPercent}%` }}
          />
        </div>
      </section>

      <RequestDetailActions request={request} />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Activity</h2>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {(request.activities ?? []).length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted">No activity yet.</li>
          ) : (
            (request.activities ?? []).map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <p className="font-medium">{a.message ?? a.eventType}</p>
                <p className="text-xs text-muted">
                  {a.eventType} · {a.createdAt.slice(0, 19).replace("T", " ")} UTC
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
