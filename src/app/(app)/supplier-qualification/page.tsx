export const dynamic = "force-dynamic";

import {
  requireSupplierQualificationModule,
  getSupplierDashboard,
} from "@/modules/supplier-qualification";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardCheck } from "lucide-react";
import Link from "next/link";

export default async function SupplierQualificationDashboardPage() {
  const { companyId } = await requireSupplierQualificationModule();
  const dash = await getSupplierDashboard(companyId);
  const name =
    dash.profile?.legalCompanyName ||
    dash.profile?.tradingName ||
    "Supplier profile";
  const isFresh =
    !dash.profile?.legalCompanyName &&
    dash.completenessPercent === 0 &&
    dash.evidenceCount === 0;

  if (isFresh) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Supplier Qualification
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Build your qualification profile
          </h1>
          <p className="mt-1 text-sm text-muted">
            Supplier readiness for bids and questionnaires — separate from{" "}
            <Link
              href="/company"
              className="font-medium text-primary hover:underline"
            >
              Company Profile
            </Link>{" "}
            used for tender-fit analysis.
          </p>
        </div>
        <EmptyState
          icon={ClipboardCheck}
          title="Your supplier profile is empty"
          description="Start with legal company details, then add qualifications, services, coverage, and evidence references."
          actionLabel="Start supplier profile"
          actionHref="/supplier-qualification/profile"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Supplier Qualification
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="mt-1 text-sm text-muted">
            Maintain reusable qualification and evidence for bids — not your
            workspace{" "}
            <Link
              href="/company"
              className="font-medium text-primary hover:underline"
            >
              Company Profile
            </Link>
            .
          </p>
        </div>
        <Link
          href="/supplier-qualification/profile"
          className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Edit supplier profile
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardDescription>Profile completeness</CardDescription>
          <CardTitle className="text-3xl">{dash.completenessPercent}%</CardTitle>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${dash.completenessPercent}%` }}
            />
          </div>
          {dash.missingRequired.length > 0 ? (
            <p className="mt-2 text-xs text-muted">
              Missing: {dash.missingRequired.join(", ")}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted">All required fields populated.</p>
          )}
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["Company", "/supplier-qualification/profile"],
            ["Qualifications", "/supplier-qualification/qualifications"],
            ["Services & sectors", "/supplier-qualification/services"],
            ["Coverage", "/supplier-qualification/coverage"],
            ["Evidence", "/supplier-qualification/evidence"],
          ] as const
        ).map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-foreground/[0.03]"
          >
            {label}
            {label === "Evidence" ? (
              <span className="mt-1 block text-xs font-normal text-muted">
                {dash.evidenceCount} reference
                {dash.evidenceCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
