export const dynamic = "force-dynamic";

import { requireDocumentComplianceModule, getDashboard } from "@/modules/document-compliance";
import { ComplianceStatusBadge } from "@/modules/document-compliance/ui/status-badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FileCheck2 } from "lucide-react";
import Link from "next/link";

export default async function DocumentComplianceDashboardPage() {
  const { companyId } = await requireDocumentComplianceModule();
  const dash = await getDashboard(companyId);

  if (dash.total === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Document Compliance
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Compliance documents
          </h1>
          <p className="mt-1 text-sm text-muted">
            Track licences, certificates, and expiry reminders for your business.
          </p>
        </div>
        <EmptyState
          icon={FileCheck2}
          title="No compliance documents yet"
          description="Upload licences, certificates, and other business documents to track expiry and get reminders."
          actionLabel="Upload document"
          actionHref="/document-compliance/upload"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Document Compliance
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Track business documents, expiry status, and reminders.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/document-compliance/documents"
            className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium"
          >
            All documents
          </Link>
          <Link
            href="/document-compliance/upload"
            className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Upload
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(
          [
            ["Total", dash.total],
            ["Valid", dash.byStatus.VALID],
            ["Expiring", dash.byStatus.EXPIRING_SOON],
            ["Expired", dash.byStatus.EXPIRED],
            ["Unknown", dash.byStatus.UNKNOWN + dash.byStatus.NO_EXPIRY],
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

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Expiring soon</h2>
          <Link
            href="/document-compliance/settings"
            className="text-sm text-primary hover:underline"
          >
            Reminder settings
          </Link>
        </div>
        {dash.expiringSoon.length === 0 ? (
          <p className="text-sm text-muted">No documents expiring soon.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {dash.expiringSoon.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/document-compliance/${d.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-foreground/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted">
                      {d.categoryLabel}
                      {d.expiryDate ? ` · expires ${d.expiryDate}` : ""}
                    </p>
                  </div>
                  <ComplianceStatusBadge status={d.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Expired</h2>
        {dash.expired.length === 0 ? (
          <p className="text-sm text-muted">No expired documents.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {dash.expired.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/document-compliance/${d.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-foreground/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted">
                      {d.categoryLabel}
                      {d.expiryDate ? ` · expired ${d.expiryDate}` : ""}
                    </p>
                  </div>
                  <ComplianceStatusBadge status={d.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
