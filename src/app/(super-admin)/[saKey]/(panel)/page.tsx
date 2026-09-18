import { getPlatformOverview } from "@/application/admin/metrics-service";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { MetricGrid } from "@/components/super-admin/metric-grid";

export const dynamic = "force-dynamic";

export default async function SaOverviewPage() {
  await requireSuperAdmin();
  const o = await getPlatformOverview();
  const money = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Platform overview</h1>
        <p className="mt-1 text-sm text-slate-400">
          Live metrics across companies, billing, analyses, and AI.
        </p>
      </div>
      <MetricGrid
        items={[
          { label: "Total companies", value: o.totalCompanies },
          { label: "New companies (30d)", value: o.newCompanies30d },
          { label: "Active subscriptions", value: o.activeSubscriptions },
          { label: "Trial companies", value: o.trialCompanies },
          { label: "Trial → paid conversion", value: `${o.trialToPaidConversionPct}%` },
          { label: "MRR", value: money(o.mrrCents) },
          { label: "Revenue (MRR signal)", value: money(o.revenueMonthCents) },
          { label: "Tender analyses", value: o.tenderAnalyses },
          { label: "BID", value: o.bidCount },
          { label: "REVIEW", value: o.reviewCount },
          { label: "NO-BID", value: o.noBidCount },
          { label: "AI requests", value: o.aiRequests },
          { label: "Est. AI cost", value: money(o.aiCostCents) },
          { label: "Failed analyses", value: o.failedAnalyses },
          { label: "Failed AI calls", value: o.failedAiRequests },
          {
            label: "System health",
            value: `${o.systemHealth.status} (${o.systemHealth.pendingJobs} jobs)`,
          },
        ]}
      />
    </div>
  );
}
