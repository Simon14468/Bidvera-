import { listSubscriptionsForAdmin } from "@/application/admin/plan-service";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { PLANS } from "@/config/plans";
import { saHref } from "@/lib/super-admin-nav";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SaSubscriptionsPage() {
  await requireSuperAdmin();
  const subs = await listSubscriptionsForAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Subscriptions</h1>
        <p className="mt-1 text-sm text-slate-400">
          Trial, active, past due, cancelled — with provider status.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900 text-slate-400">
            <tr>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Renewal</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => {
              const legacy = Object.values(PLANS).find((p) => p.prismaPlan === s.plan);
              const price =
                s.billingPlan?.monthlyPriceCents ?? legacy?.priceMonthlyCents ?? 0;
              return (
                <tr key={s.id} className="border-b border-slate-800/70">
                  <td className="px-3 py-2">
                    <Link
                      href={saHref(`/companies/${s.companyId}`)}
                      className="text-emerald-400 hover:underline"
                    >
                      {s.company.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{s.billingPlan?.name ?? s.plan}</td>
                  <td className="px-3 py-2">${(price / 100).toFixed(0)}/mo</td>
                  <td className="px-3 py-2">{s.status}</td>
                  <td className="px-3 py-2">
                    {s.provider}
                    <p className="text-xs text-slate-500">
                      {s.providerSubscriptionId ?? "—"}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {s.currentPeriodEnd
                      ? s.currentPeriodEnd.toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
