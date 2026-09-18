export const dynamic = "force-dynamic";

import { requireCompanyId } from "@/auth/session";
import { FeatureUpgradeNotice } from "@/components/billing/feature-upgrade-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { isCommerciallyAvailableFeature } from "@/domain/billing/entitlement-catalog";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { formatDateTime } from "@/lib/format";
import { hasFeature } from "@/services/entitlements";
import { listDecisionMemory } from "@/services/decision-memory";
import { History } from "lucide-react";
import Link from "next/link";

export default async function DecisionMemoryPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).app.decisionMemory;
  const { companyId } = await requireCompanyId();

  const allowed = await hasFeature(companyId, "decision_memory");
  if (!allowed) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
        </div>
        <FeatureUpgradeNotice featureName={t.title} />
      </div>
    );
  }

  const { isTenderAnalysisAvailable } = await import("@/modules/tender-analysis");
  const tenderAnalysisEnabled =
    isCommerciallyAvailableFeature("tender_analysis") &&
    (await isTenderAnalysisAvailable(companyId).catch(() => false));

  const memories = await listDecisionMemory(companyId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
      </div>

      {memories.length === 0 ? (
        tenderAnalysisEnabled ? (
          <EmptyState
            icon={History}
            title={t.emptyTitle}
            description={t.emptyDescription}
            actionLabel={t.viewTender}
            actionHref="/tenders"
          />
        ) : (
          <EmptyState
            icon={History}
            title={t.emptyTitle}
            description="Stored decisions appear here when Decision Intelligence records an outcome for your company. Keep qualifications and evidence current so future decisions have strong company context."
            actionLabel="Open company profile"
            actionHref="/company"
          />
        )
      ) : (
        <ul className="space-y-3">
          {memories.map((m) => (
            <li key={m.id}>
              <Link
                href={`/decision-memory/${m.id}`}
                className="block rounded-xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {m.decisionLabel}
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {m.title}
                    </p>
                    {m.client ? (
                      <p className="mt-0.5 text-xs text-muted">{m.client}</p>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted">
                    {t.analyzed} {formatDateTime(m.analyzedAt, locale)}
                  </p>
                </div>
                <p className="mt-3 text-xs text-muted">
                  {t.scores}: Fit {m.fitScore ?? "—"} · Readiness{" "}
                  {m.readinessScore ?? "—"} · Bid {m.bidScore ?? "—"}
                </p>
                <p className="mt-2 text-xs text-muted">{m.disclaimer}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
