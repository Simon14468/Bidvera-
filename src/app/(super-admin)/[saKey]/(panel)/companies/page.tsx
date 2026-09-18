import { listCompaniesForAdmin } from "@/application/admin/company-service";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { CompanyListActions } from "@/components/super-admin/company-list-actions";
import { CompanyListPlanControl } from "@/components/super-admin/company-list-plan";
import { EnterCompanyForm } from "@/components/super-admin/enter-company-form";
import { saHref } from "@/lib/super-admin-nav";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SaCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const companies = await listCompaniesForAdmin({
    query: sp.q,
    status: sp.status === "SUSPENDED" || sp.status === "ACTIVE" ? sp.status : "ALL",
    plan: sp.plan,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Companies</h1>
        <p className="mt-1 text-sm text-slate-400">
          Search, inspect, change plans manually (no payment), ban/suspend, delete, and
          override.
        </p>
      </div>
      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search name, slug, email…"
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={sp.status ?? "ALL"}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
        >
          Filter
        </button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900 text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Usage</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Last activity</th>
              <th className="px-3 py-2 font-medium">Access</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-b border-slate-800/80 hover:bg-slate-900/40">
                <td className="px-3 py-2">
                  <Link
                    href={saHref(`/companies/${c.id}`)}
                    className="font-medium text-emerald-400 hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-slate-500">{c.slug}</p>
                </td>
                <td className="px-3 py-2 align-top">
                  <CompanyListPlanControl
                    companyId={c.id}
                    planName={c.planName}
                    planEnum={String(c.plan)}
                    subscriptionStatus={c.subscriptionStatus}
                  />
                </td>
                <td className="px-3 py-2">
                  {c.analysesUsed}/{c.analysesLimit === 0 ? "∞" : c.analysesLimit}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      c.status === "SUSPENDED" ? "text-amber-400" : "text-slate-200"
                    }
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-400">
                  {new Date(c.lastActivity).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  <EnterCompanyForm
                    action={saHref(`/companies/${c.id}/enter`)}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <CompanyListActions
                    companyId={c.id}
                    companyName={c.name}
                    companySlug={c.slug}
                    suspended={c.status === "SUSPENDED"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
