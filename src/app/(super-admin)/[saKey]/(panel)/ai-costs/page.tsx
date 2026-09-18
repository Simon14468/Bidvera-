import { getAiCostBreakdown } from "@/application/admin/metrics-service";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { MetricGrid } from "@/components/super-admin/metric-grid";

export const dynamic = "force-dynamic";

export default async function SaAiCostsPage() {
  await requireSuperAdmin();
  const data = await getAiCostBreakdown();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">AI cost control</h1>
        <p className="mt-1 text-sm text-slate-400">
          Usage and estimated cost by model and company.
        </p>
      </div>
      <MetricGrid
        items={[
          { label: "Failed AI requests", value: data.failedAiRequests },
          {
            label: "Models tracked",
            value: data.byModel.length,
          },
        ]}
      />
      <section className="overflow-x-auto rounded-xl border border-slate-800">
        <h2 className="border-b border-slate-800 px-3 py-2 text-sm font-medium text-white">
          By model
        </h2>
        <table className="min-w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="px-3 py-2">Model</th>
              <th className="px-3 py-2">Requests</th>
              <th className="px-3 py-2">Tokens</th>
              <th className="px-3 py-2">Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {data.byModel.map((m) => (
              <tr key={`${m.provider}-${m.model}`} className="border-t border-slate-800/70">
                <td className="px-3 py-2">
                  {m.model}
                  <p className="text-xs text-slate-500">{m.provider}</p>
                </td>
                <td className="px-3 py-2">{m.requests}</td>
                <td className="px-3 py-2">{m.tokensIn + m.tokensOut}</td>
                <td className="px-3 py-2">${(m.costCents / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="overflow-x-auto rounded-xl border border-slate-800">
        <h2 className="border-b border-slate-800 px-3 py-2 text-sm font-medium text-white">
          By company
        </h2>
        <table className="min-w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Requests</th>
              <th className="px-3 py-2">Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {data.byCompany.map((c) => (
              <tr key={c.companyId ?? "x"} className="border-t border-slate-800/70">
                <td className="px-3 py-2">{c.companyName}</td>
                <td className="px-3 py-2">{c.plan ?? "—"}</td>
                <td className="px-3 py-2">{c.requests}</td>
                <td className="px-3 py-2">${(c.costCents / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
