export const dynamic = "force-dynamic";

import {
  requireDocumentComplianceModule,
  listDocuments,
  listCategories,
} from "@/modules/document-compliance";
import { ComplianceStatusBadge } from "@/modules/document-compliance/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getDictionary } from "@/i18n/dictionaries";
import { formatMessage } from "@/i18n/format";
import { getLocale } from "@/i18n/get-locale";
import { FileCheck2 } from "lucide-react";
import Link from "next/link";

const STATUS_LABEL_KEYS = {
  VALID: "valid",
  EXPIRING_SOON: "expiring",
  EXPIRED: "expired",
  NO_EXPIRY: "neverExpires",
  UNKNOWN: "unknown",
} as const;

export default async function DocumentComplianceListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; q?: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale).app.documentCompliance;
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

  const filtered = Boolean(sp.q || sp.status || sp.category);

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            {t.eyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{t.documentsTitle}</h1>
          <p className="mt-1 text-sm text-muted">{t.documentsSubtitle}</p>
        </div>
        <Link
          href="/document-compliance/upload"
          className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
        >
          {t.emptyCta}
        </Link>
      </div>

      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder={t.search}
          className="h-10 min-w-[12rem] flex-1 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <select
          name="category"
          defaultValue={sp.category ?? ""}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        >
          <option value="">
            {t.all} {t.category}
          </option>
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
          <option value="">
            {t.all} {t.status}
          </option>
          {(["VALID", "EXPIRING_SOON", "EXPIRED", "NO_EXPIRY", "UNKNOWN"] as const).map(
            (s) => (
              <option key={s} value={s}>
                {t[STATUS_LABEL_KEYS[s]]}
              </option>
            ),
          )}
        </select>
        <button
          type="submit"
          className="h-10 rounded-xl border border-border px-4 text-sm font-medium"
        >
          {t.filter}
        </button>
      </form>

      {documents.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title={filtered ? t.noResults : t.emptyTitle}
          description={filtered ? t.noResults : t.emptyDescription}
          actionLabel={filtered ? undefined : t.emptyCta}
          actionHref={filtered ? undefined : "/document-compliance/upload"}
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
                    {d.expiryDate
                      ? ` · ${formatMessage(t.expiresOn, { date: d.expiryDate })}`
                      : ""}
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
