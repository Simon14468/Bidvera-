import { assertCanManageCompanySettings } from "@/auth/company-settings-access";
import { requireCompanyId } from "@/auth/session";
import { companyProfileSchema } from "@/domain/schemas";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertFeature } from "@/services/entitlements";
import { trackEvent } from "@/services/observability";

function computeCompleteness(profile: {
  industry: string | null;
  country: string | null;
  companySize: string | null;
  experienceLevel: string | null;
  services: string[];
  certifications: string[];
  experienceYears: number | null;
  revenueRange: string | null;
  employeeRange: string | null;
  geographicCoverage: string[];
  contractSizeMin: number | null;
  contractSizeMax: number | null;
  customQualificationRules: string[];
}): number {
  const checks = [
    !!profile.industry,
    !!profile.country,
    !!profile.companySize,
    profile.services.length > 0,
    !!profile.experienceLevel || profile.experienceYears != null,
    profile.certifications.length > 0,
    !!profile.revenueRange,
    !!profile.employeeRange,
    profile.geographicCoverage.length > 0,
    profile.contractSizeMin != null || profile.contractSizeMax != null,
    profile.customQualificationRules.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export async function getCompanyProfileForSession() {
  const { companyId } = await requireCompanyId();
  await assertFeature(companyId, "company_profile");
  // Page only needs identity + profile + learning consent — skip usage/subscription payload.
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      country: true,
      companySize: true,
      globalLearningConsent: true,
      profile: true,
    },
  });
  if (!company) throw new AppError(ErrorCode.NOT_FOUND, "Company not found.", 404);
  return company;
}

export async function updateCompanyProfileAction(raw: unknown) {
  const { auth, companyId } = await requireCompanyId();
  assertCanManageCompanySettings(auth.user.role);
  await assertFeature(companyId, "company_profile");
  const data = companyProfileSchema.parse(raw);
  const normalized = {
    industry: data.industry ?? null,
    country: data.country ?? null,
    companySize: data.companySize ?? null,
    experienceLevel: data.experienceLevel ?? null,
    services: data.services,
    certifications: data.certifications,
    experienceYears: data.experienceYears ?? null,
    revenueRange: data.revenueRange ?? null,
    employeeRange: data.employeeRange ?? null,
    geographicCoverage: data.geographicCoverage,
    contractSizeMin: data.contractSizeMin ?? null,
    contractSizeMax: data.contractSizeMax ?? null,
    customQualificationRules: data.customQualificationRules,
  };
  const completeness = computeCompleteness(normalized);

  const [profile] = await prisma.$transaction([
    prisma.companyProfile.upsert({
      where: { companyId },
      create: {
        companyId,
        ...normalized,
        completeness,
      },
      update: {
        ...normalized,
        completeness,
      },
    }),
    prisma.company.update({
      where: { id: companyId },
      data: {
        ...(data.name?.trim() ? { name: data.name.trim() } : {}),
        ...(normalized.country ? { country: normalized.country } : {}),
        ...(normalized.companySize ? { companySize: normalized.companySize } : {}),
      },
    }),
  ]);

  await trackEvent({
    action: "PROFILE_UPDATED",
    companyId,
    userId: auth.user.id,
    metadata: { completeness },
  });

  const { scheduleMatchingProfileRebuild } = await import(
    "@/application/matching-rebuild"
  );
  scheduleMatchingProfileRebuild(companyId);

  return profile;
}
