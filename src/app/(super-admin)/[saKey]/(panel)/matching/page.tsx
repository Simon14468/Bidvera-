import { requireSuperAdmin } from "@/auth/super-admin-session";
import { getMatchingEngineHealthAnalytics } from "@/modules/matching-engine";

export const dynamic = "force-dynamic";

function pct(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export default async function SaMatchingHealthPage() {
  await requireSuperAdmin();
  const health = await getMatchingEngineHealthAnalytics();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Matching health</h1>
        <p className="mt-1 text-sm text-slate-400">
          Aggregate Matching Engine ops metrics. Company-private behavior is not
          exposed. Interest is self-reported — not a verified deal outcome.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Active opportunities"
          value={String(health.opportunities.active)}
        />
        <Stat
          label="Eligible companies"
          value={`${health.eligibleCompanies} / ${health.eligibleThreshold}`}
        />
        <Stat
          label="Visible recommendations"
          value={String(health.recommendationsVisible)}
        />
        <Stat
          label="Interest rate (30d)"
          value={pct(health.funnel.rates.interestRate)}
        />
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200">
          Activation readiness
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Aggregate signals only — no company-private payloads. Super Admin may
          enable Matching Engine freely; eligible-company count is advisory
          (recommended default: 45).
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Metric
            label="Matching global"
            value={health.readiness.matchingEnabledGlobal ? "ON" : "OFF"}
          />
          <Metric
            label="Sponsorship global"
            value={health.readiness.sponsorshipEnabledGlobal ? "ON" : "OFF"}
          />
          <Metric
            label="AI refine"
            value={
              health.readiness.aiRefineReady
                ? "ready"
                : health.readiness.aiRefineEnabled
                  ? "enabled (not ready)"
                  : "OFF"
            }
          />
          <Metric
            label="SA can enable"
            value={health.readiness.canEnableMatching ? "yes (free)" : "no"}
          />
          <Metric
            label="Live opportunities"
            value={health.readiness.liveOpportunities}
          />
          <Metric
            label="Recs organic / sponsored"
            value={`${health.readiness.recommendationsOrganic} / ${health.readiness.recommendationsSponsored}`}
          />
          <Metric
            label="Corpus threshold met"
            value={health.readiness.thresholdMet ? "yes" : "no (advisory)"}
          />
          <Metric
            label="Eligible / threshold"
            value={`${health.readiness.eligibleCompanies} / ${health.readiness.eligibleThreshold}`}
          />
        </dl>
        {health.readiness.blockers.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-300/90">
            {health.readiness.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-emerald-300/90">
            Corpus advisory clear — Matching Engine still remains OFF until
            explicitly enabled.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200">Opportunity lifecycle</h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          {(
            [
              ["Active", health.opportunities.active],
              ["Paused", health.opportunities.paused],
              ["Expired", health.opportunities.expired],
              ["Draft", health.opportunities.draft],
              ["Archived", health.opportunities.archived],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-white">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200">
          Engagement funnel ({health.funnel.source})
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          <Metric label="Impressions" value={health.funnel.impressions} />
          <Metric label="Views" value={health.funnel.views} />
          <Metric label="Clicks" value={health.funnel.clicks} />
          <Metric label="Interest" value={health.funnel.interest} />
          <Metric label="Dismissals" value={health.funnel.dismissals} />
        </dl>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Metric label="View rate" value={pct(health.funnel.rates.viewRate)} />
          <Metric label="Click rate" value={pct(health.funnel.rates.clickRate)} />
          <Metric
            label="Engagement rate"
            value={pct(health.funnel.rates.engagementRate)}
          />
          <Metric
            label="Dismissal rate"
            value={pct(health.funnel.rates.dismissalRate)}
          />
        </dl>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-800 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Organic</p>
            <p className="mt-1 text-sm text-slate-300">
              Imp {health.funnel.byType.ORGANIC.impressions} · Interest{" "}
              {health.funnel.byType.ORGANIC.interest} ·{" "}
              {pct(health.funnel.byType.ORGANIC.rates.interestRate)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Sponsored</p>
            <p className="mt-1 text-sm text-slate-300">
              Imp {health.funnel.byType.SPONSORED.impressions} · Interest{" "}
              {health.funnel.byType.SPONSORED.interest} ·{" "}
              {pct(health.funnel.byType.SPONSORED.rates.interestRate)}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-sm font-semibold text-slate-200">Top categories</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {health.topCategories.length === 0 ? (
              <li className="text-slate-500">No rollup data yet.</li>
            ) : (
              health.topCategories.map((c) => (
                <li
                  key={c.category}
                  className="flex justify-between gap-3 border-b border-slate-800/80 py-1.5 last:border-0"
                >
                  <span className="text-slate-200">{c.category}</span>
                  <span className="tabular-nums text-slate-400">
                    {c.interest} interest / {c.impressions} imp
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-sm font-semibold text-slate-200">
            Top opportunities (interest)
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {health.topOpportunities.length === 0 ? (
              <li className="text-slate-500">No rollup data yet.</li>
            ) : (
              health.topOpportunities.map((o) => (
                <li
                  key={o.opportunityId}
                  className="border-b border-slate-800/80 py-1.5 last:border-0"
                >
                  <p className="truncate text-slate-200">{o.title}</p>
                  <p className="text-xs text-slate-500">
                    {o.interest} interest · {pct(o.rates.interestRate)} ·{" "}
                    {o.sponsored ? "Sponsored" : "Organic"}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200">
          Weak-performing opportunities
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {health.weakOpportunities.length === 0 ? (
            <li className="text-slate-500">Insufficient impression volume.</li>
          ) : (
            health.weakOpportunities.map((o) => (
              <li
                key={o.opportunityId}
                className="flex justify-between gap-3 border-b border-slate-800/80 py-1.5 last:border-0"
              >
                <span className="truncate text-slate-200">{o.title}</span>
                <span className="shrink-0 tabular-nums text-slate-400">
                  interest {pct(o.rates.interestRate)} · dismiss{" "}
                  {pct(o.rates.dismissalRate)}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums text-white">{value}</dd>
    </div>
  );
}
