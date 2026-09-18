import { getCompanyDetailForAdmin } from "@/application/admin/company-service";
import { getCompanyMatchingReadinessForAdmin } from "@/application/admin/matching-readiness";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { CompanyAdminActions } from "@/components/super-admin/company-actions";
import { EnterCompanyForm } from "@/components/super-admin/enter-company-form";
import { MatchingReadinessCard } from "@/components/super-admin/matching-readiness-card";
import { MetricGrid } from "@/components/super-admin/metric-grid";
import { saHref } from "@/lib/super-admin-nav";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SaCompanyDetailPage({
  params,
}: {
  params: Promise<{ saKey: string; companyId: string }>;
}) {
  await requireSuperAdmin();
  const { companyId } = await params;
  let detail;
  let matchingReadiness;
  try {
    detail = await getCompanyDetailForAdmin(companyId);
    matchingReadiness = await getCompanyMatchingReadinessForAdmin(companyId);
  } catch {
    notFound();
  }
  const { company, limits, aiCost } = detail;

  return (
    <div className="space-y-6">
      <div>
        <Link href={saHref("/companies")} className="text-sm text-slate-400 hover:text-white">
          ← Companies
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-white">{company.name}</h1>
            <p className="text-sm text-slate-400">
              {company.slug} · {company.status} · created{" "}
              {company.createdAt.toLocaleDateString()}
            </p>
          </div>
          <EnterCompanyForm
            action={saHref(`/companies/${company.id}/enter`)}
            size="md"
          />
        </div>
      </div>

      <MetricGrid
        items={[
          { label: "Plan", value: limits.planName },
          { label: "Analyses used", value: company.usage?.analysesUsed ?? 0 },
          { label: "Analyses limit", value: limits.analysesLimit },
          { label: "Monthly $", value: `$${(limits.monthlyPriceCents / 100).toFixed(0)}` },
          { label: "AI requests", value: aiCost._count },
          { label: "AI cost", value: `$${((aiCost._sum.costCentsEst ?? 0) / 100).toFixed(2)}` },
          { label: "Users", value: company.users.length },
          { label: "Tenders", value: company.tenders.length },
        ]}
      />

      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="font-medium text-white">Users</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          {company.users.map((u) => (
            <li key={u.id}>
              {u.name} · {u.email} · {u.role}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="font-medium text-white">Company profile</h2>
        {company.profile ? (
          <dl className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Industry</dt>
              <dd>{company.profile.industry ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Country</dt>
              <dd>{company.profile.country ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Size</dt>
              <dd>{company.profile.companySize ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Experience</dt>
              <dd>
                {company.profile.experienceYears != null
                  ? `${company.profile.experienceYears} years`
                  : (company.profile.experienceLevel ?? "—")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Completeness</dt>
              <dd>{company.profile.completeness}%</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Revenue / employees</dt>
              <dd>
                {company.profile.revenueRange ?? "—"} ·{" "}
                {company.profile.employeeRange ?? "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Services</dt>
              <dd>{company.profile.services.join(", ") || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Certifications</dt>
              <dd>{company.profile.certifications.join(", ") || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-slate-500">Coverage</dt>
              <dd>{company.profile.geographicCoverage.join(", ") || "—"}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-400">No profile yet.</p>
        )}
      </section>

      <MatchingReadinessCard
        companyId={company.id}
        readiness={matchingReadiness}
      />

      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="font-medium text-white">Recent tenders</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {company.tenders.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 text-slate-300">
              <span>
                {t.title} · {t.analysisStatus} · {t.decision?.decision ?? "—"}
              </span>
              <Link
                href={saHref(`/companies/${company.id}/tenders/${t.id}/trace`)}
                className="text-xs text-emerald-400 hover:underline"
              >
                Trace
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <CompanyAdminActions
        companyId={company.id}
        companySlug={company.slug}
        companyName={company.name}
        companiesHref={saHref("/companies")}
        suspended={company.status === "SUSPENDED"}
        users={company.users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
        }))}
      />
    </div>
  );
}
