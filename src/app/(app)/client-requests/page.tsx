export const dynamic = "force-dynamic";

import {
  getClientRequestsDashboard,
  requireClientRequestsModule,
} from "@/modules/client-requests";
import { ClientRequestStatusBadge } from "@/modules/client-requests/ui/status-badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";
import Link from "next/link";
import { ClientRequestsFilters } from "./filters";

export default async function ClientRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; client?: string; sort?: string }>;
}) {
  const { companyId } = await requireClientRequestsModule();
  const sp = await searchParams;
  const dash = await getClientRequestsDashboard(companyId);

  const status = sp.status?.toUpperCase();
  const filtered = dash.requests.filter((r) => {
    if (status && status !== "ALL" && r.status !== status) return false;
    if (sp.client?.trim()) {
      const q = sp.client.trim().toLowerCase();
      if (!r.clientName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sp.sort === "deadline") {
      return a.deadline.localeCompare(b.deadline);
    }
    if (sp.sort === "client") {
      return a.clientName.localeCompare(b.clientName);
    }
    if (sp.sort === "status") {
      return a.status.localeCompare(b.status);
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  if (dash.total === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
        <Header />
        <EmptyState
          icon={Inbox}
          title="No client requests yet"
          description="Track buyer requests for company information and documents, link existing Bidvera evidence, and share a secure dossier."
          actionLabel="Create request"
          actionHref="/client-requests/new"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Header />
        <Link
          href="/client-requests/new"
          className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Create request
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(
          [
            ["All", dash.total],
            ["Pending", dash.byStatus.PENDING],
            ["In progress", dash.byStatus.IN_PROGRESS],
            ["Completed", dash.byStatus.COMPLETED],
            ["Overdue", dash.byStatus.OVERDUE],
          ] as const
        ).map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-4">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <ClientRequestsFilters
        status={sp.status ?? "ALL"}
        client={sp.client ?? ""}
        sort={sp.sort ?? "updated"}
      />

      <ul className="divide-y divide-border rounded-xl border border-border">
        {sorted.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-muted">
            No requests match these filters.
          </li>
        ) : (
          sorted.map((r) => (
            <li key={r.id}>
              <Link
                href={`/client-requests/${r.id}`}
                className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-foreground/[0.03] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="truncate text-sm text-muted">{r.clientName}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <ClientRequestStatusBadge status={r.status} />
                  <span className="text-muted">
                    {r.progressPercent}% · {r.completedItemCount}/{r.itemCount}
                  </span>
                  <span className="text-muted">
                    Due {r.deadline.slice(0, 10)}
                  </span>
                  <span className="text-muted">
                    Updated {r.updatedAt.slice(0, 10)}
                  </span>
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function Header() {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">
        Client Requests
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">Requests portal</h1>
      <p className="mt-1 text-sm text-muted">
        Centralize buyer requests for information and documents — link existing
        Bidvera evidence, track completion, and share securely.
      </p>
    </div>
  );
}
