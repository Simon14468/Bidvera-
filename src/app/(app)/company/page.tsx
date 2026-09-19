export const dynamic = "force-dynamic";

import { requireCompanyId } from "@/auth/session";
import { getCompanyProfileForSession } from "@/application/company-service";
import { FeatureUpgradeNotice } from "@/components/billing/feature-upgrade-notice";
import { LearningConsentCard } from "@/components/settings/learning-consent-card";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { hasFeature } from "@/services/entitlements";
import Link from "next/link";
import { CompanyProfileForm } from "./company-profile-form";

export default async function CompanyPage() {
  const locale = await getLocale();
  const copy = getDictionary(locale).app.companyProfile;
  const { companyId } = await requireCompanyId();

  const allowed = await hasFeature(companyId, "company_profile");
  if (!allowed) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Workspace
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted">{copy.subtitle}</p>
        </div>
        <FeatureUpgradeNotice featureName={copy.title} />
      </div>
    );
  }

  const company = await getCompanyProfileForSession();
  const profile = company.profile;

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted">
          Workspace
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-1 text-sm text-muted">{copy.subtitle}</p>
        <p className="mt-2 text-xs text-muted">
          {copy.supplierQualificationHint}{" "}
          <Link
            href="/supplier-qualification"
            className="font-medium text-primary hover:underline"
          >
            {copy.supplierQualificationLink}
          </Link>
          .
        </p>
      </div>
      <CompanyProfileForm
        companyName={company.name}
        copy={copy}
        initial={{
          industry: profile?.industry ?? null,
          country: profile?.country ?? company.country ?? null,
          companySize: profile?.companySize ?? company.companySize ?? null,
          experienceLevel: profile?.experienceLevel ?? null,
          services: profile?.services ?? [],
          certifications: profile?.certifications ?? [],
          experienceYears: profile?.experienceYears ?? null,
          revenueRange: profile?.revenueRange ?? null,
          employeeRange: profile?.employeeRange ?? null,
          geographicCoverage: profile?.geographicCoverage ?? [],
          contractSizeMin: profile?.contractSizeMin ?? null,
          contractSizeMax: profile?.contractSizeMax ?? null,
          customQualificationRules: profile?.customQualificationRules ?? [],
          completeness: profile?.completeness ?? 0,
        }}
      />
      <LearningConsentCard
        initialConsent={company.globalLearningConsent !== false}
        copy={copy}
      />
    </div>
  );
}
