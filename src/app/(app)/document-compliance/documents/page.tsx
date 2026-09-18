export const dynamic = "force-dynamic";

import {
  requireDocumentComplianceModule,
  listDocuments,
  listCategories,
} from "@/modules/document-compliance";
import { ComplianceStatusBadge } from "@/modules/document-compliance/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FileCheck2 } from "lucide-react";
import Link from "next/link";

export default async function DocumentComplianceListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  const { companyId } = await requireDocumentComplianceModule();
  const sp = await searchParams;
  const [documents, categories] = await Promise.all([
    listDocuments({
      companyId,
      status: sp.status,
      categoryKey: sp.category,
      q: sp.q,
    }),
    listCategories(companyId),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Document Compliance
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        </div>
        <Link
          href="/document-compliance/upload"
          className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Upload document
        </Link>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search name, number, authority…"
          className="h-10 min-w-[12rem] flex-1 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <select
          name="category"
          defaultValue={sp.category ?? ""}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          {["VALID", "EXPIRING_SOON", "EXPIRED", "NO_EXPIRY", "UNKNOWN"].map(
            (s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ),
          )}
        </select>
        <button
          type="submit"
          className="h-10 rounded-xl border border-border px-4 text-sm font-medium"
        >
          Filter
        </button>
      </form>

      {documents.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title={
            sp.q || sp.status || sp.category
              ? "No documents match these filters"
              : "No documents yet"
          }
          description={
            sp.q || sp.status || sp.category
              ? "Try clearing filters or search for a different term."
              : "Upload your first licence, certificate, or business document to start tracking expiry."
          }
          actionLabel={
            sp.q || sp.status || sp.category ? undefined : "Upload document"
          }
          actionHref={
            sp.q || sp.status || sp.category
              ? undefined
              : "/document-compliance/upload"
          }
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {documents.map((d) => (
            <li key={d.id}>
              <Link
                href={`/document-compliance/${d.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-foreground/[0.03]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="text-xs text-muted">
                    {d.categoryLabel}
                    {d.documentNumber ? ` · ${d.documentNumber}` : ""}
                    {d.expiryDate ? ` · expiry ${d.expiryDate}` : ""}
                    {` · v${d.versionCount}`}
                  </p>
                </div>
                <ComplianceStatusBadge status={d.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
