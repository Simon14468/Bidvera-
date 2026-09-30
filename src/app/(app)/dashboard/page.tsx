export const dynamic = "force-dynamic";

import { getMatchingDashboardOverview } from "@/application/matching-dashboard-overview";
import { getWorkspaceDashboard } from "@/application/workspace-dashboard";
import { CheckoutConfirmation } from "@/components/billing/checkout-confirmation";
import { MatchingEngineOverview } from "@/components/dashboard/matching-engine-overview";
import { WorkspaceBarChart } from "@/components/dashboard/workspace-bar-chart";
import { WorkspaceKpiGrid } from "@/components/dashboard/workspace-kpi-grid";
import { WorkspacePlanCard } from "@/components/dashboard/workspace-plan-card";
import { WorkspaceQuickActions } from "@/components/dashboard/workspace-quick-actions";
import { WorkspaceRecentActivity } from "@/components/dashboard/workspace-recent-activity";
import { PwaInstallCard } from "@/components/pwa/pwa-install-card";
import { isCommerciallyAvailableFeature } from "@/domain/billing/entitlement-catalog";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const common = dict.app.common;
  const { requireCompanyId } = await import("@/auth/session");
  const { companyId } = await requireCompanyId();
  const params = await searchParams;

  // Provider return flags only trigger verification — never mean "paid".
  const stripeSessionId =
    params.stripe === "1" && typeof params.session_id === "string"
      ? params.session_id
      : null;
  const paypalSubscriptionId =
    params.paypal === "1" && typeof params.subscription_id === "string"
      ? params.subscription_id
      : null;

  // Matching commercially OFF: skip overview DB work entirely (journeys hit /dashboard 3×).
  const matchingCommerciallyOn = isCommerciallyAvailableFeature("matching_engine");

  const [data, matchingOverview] = await Promise.all([
    getWorkspaceDashboard(companyId),
    matchingCommerciallyOn
      ? getMatchingDashboardOverview(companyId).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <div className="min-w-0 space-y-6 animate-fade-in sm:space-y-8">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {common.yourWorkspace}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            {common.dashboardTitle}
          </h1>
        </div>
        <Link
          href="/billing"
          className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-border px-5 text-sm font-medium transition hover:bg-background sm:w-auto"
        >
          {common.viewPlan}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      {stripeSessionId || paypalSubscriptionId ? (
        <CheckoutConfirmation
          stripeSessionId={stripeSessionId}
          paypalSubscriptionId={paypalSubscriptionId}
        />
      ) : null}

      <PwaInstallCard copy={dict.app.pwa} />

      <section className="min-w-0 space-y-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">
            {common.workspaceOverview}
          </h2>
        </div>
        <WorkspaceKpiGrid
          kpis={data.kpis}
          lockedLabel={common.lockedPlan}
          kpiLabels={dict.app.kpi}
          emptyDataLabel={common.noDataYet}
        />
      </section>

      {matchingOverview && matchingOverview.state !== "unavailable" ? (
        <MatchingEngineOverview data={matchingOverview} locale={locale} />
      ) : null}

      <section className="grid min-w-0 gap-4 xl:grid-cols-3">
        <WorkspaceBarChart
          title={common.complianceStatus}
          series={data.complianceStatusSeries}
          emptyLabel={common.complianceEmpty}
        />
        <WorkspaceBarChart
          title={common.workspaceActivity}
          series={data.activitySeries}
          emptyLabel={
            data.hasActivityHistory
              ? common.activityEmptyPeriod
              : common.activityEmpty
          }
        />
        <WorkspaceBarChart
          title={common.deadlineOverview}
          description={common.deadlineOverviewHint}
          series={data.deadlineSeries}
          emptyLabel={common.deadlineEmpty}
        />
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.2fr_1fr]">
        <WorkspaceRecentActivity
          items={data.recentActivity}
          locale={locale}
          labels={common}
        />
        <div className="min-w-0 space-y-4">
          <WorkspacePlanCard
            plan={data.plan}
            locale={locale}
            labels={common}
            featureLabels={dict.pricing.features as unknown as Record<string, string>}
          />
          <WorkspaceQuickActions
            actions={data.quickActions}
            labels={common}
          />
        </div>
      </div>
    </div>
  );
}
