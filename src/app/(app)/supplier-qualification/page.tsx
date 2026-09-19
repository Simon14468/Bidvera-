export const dynamic = "force-dynamic";

import {
  requireSupplierQualificationModule,
  getSupplierDashboard,
} from "@/modules/supplier-qualification";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getDictionary } from "@/i18n/dictionaries";
import { formatMessage } from "@/i18n/format";
import { getLocale } from "@/i18n/get-locale";
import { ClipboardCheck } from "lucide-react";
import Link from "next/link";

export default async function SupplierQualificationDashboardPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).app.supplierQualification;
  const { companyId } = await requireSupplierQualificationModule();
  const dash = await getSupplierDashboard(companyId);
  const name =
    dash.profile?.legalCompanyName ||
    dash.profile?.tradingName ||
    t.defaultProfileName;
  const isFresh =
    !dash.profile?.legalCompanyName &&
    dash.completenessPercent === 0 &&
    dash.evidenceCount === 0;

  if (isFresh) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            {t.eyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{t.buildTitle}</h1>
          <p className="mt-1 text-sm text-muted">
            {t.buildSubtitle}{" "}
            <Link
              href="/company"
              className="font-medium text-primary hover:underline"
            >
              {t.companyProfileLink}
            </Link>
          </p>
        </div>
        <EmptyState
          icon={ClipboardCheck}
          title={t.emptyTitle}
          description={t.emptyDescription}
          actionLabel={t.emptyCta}
          actionHref="/supplier-qualification/profile"
        />
      </div>
    );
  }

  const navSections = [
    [t.profile, "/supplier-qualification/profile"],
    [t.qualifications, "/supplier-qualification/qualifications"],
    [t.services, "/supplier-qualification/services"],
    [t.coverage, "/supplier-qualification/coverage"],
    [t.evidence, "/supplier-qualification/evidence"],
  ] as const;

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            {t.eyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="mt-1 text-sm text-muted">
            {t.subtitle}{" "}
            <Link
              href="/company"
              className="font-medium text-primary hover:underline"
            >
              {t.companyProfileLink}
            </Link>
          </p>
        </div>
        <Link
          href="/supplier-qualification/profile"
          className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover"
        >
          {t.editProfile}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardDescription>{t.completeness}</CardDescription>
          <CardTitle className="text-3xl">{dash.completenessPercent}%</CardTitle>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${dash.completenessPercent}%` }}
            />
          </div>
          {dash.missingRequired.length > 0 ? (
            <p className="mt-2 text-xs text-muted">
              {formatMessage(t.missing, {
                fields: dash.missingRequired.join(", "),
              })}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted">{t.allRequired}</p>
          )}
        </CardHeader>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {navSections.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-foreground/[0.03]"
          >
            {label}
            {label === t.evidence ? (
              <span className="mt-1 block text-xs font-normal text-muted">
                {dash.evidenceCount}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
