import type { CompanyKnowledge } from "@/domain/company-knowledge";
import { knowledgeToProfileFields } from "@/domain/company-knowledge";
import { prisma } from "@/lib/db";

function computeCompleteness(profile: {
  industry: string | null;
  country: string | null;
  companySize: string | null;
  services: string[];
  certifications: string[];
  experienceYears: number | null;
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
    profile.experienceYears != null,
    profile.certifications.length > 0,
    !!profile.employeeRange,
    profile.geographicCoverage.length > 0,
    profile.contractSizeMin != null || profile.contractSizeMax != null,
    profile.customQualificationRules.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/**
 * Persist extracted company knowledge and merge into CompanyProfile flat fields.
 * Does not invent values — only writes what extraction produced.
 */
export async function persistCompanyKnowledge(input: {
  companyId: string;
  knowledge: CompanyKnowledge;
  mergeName?: boolean;
}): Promise<void> {
  const fields = knowledgeToProfileFields(input.knowledge);
  const existing = await prisma.companyProfile.findUnique({
    where: { companyId: input.companyId },
  });

  // Prefer richer extracted lists; keep manual fields when extraction left them empty
  const merged = {
    industry: fields.industry ?? existing?.industry ?? null,
    country: fields.country ?? existing?.country ?? null,
    companySize: fields.companySize ?? existing?.companySize ?? null,
    experienceLevel: existing?.experienceLevel ?? null,
    services:
      fields.services.length > 0 ? fields.services : (existing?.services ?? []),
    certifications:
      fields.certifications.length > 0
        ? fields.certifications
        : (existing?.certifications ?? []),
    experienceYears: fields.experienceYears ?? existing?.experienceYears ?? null,
    revenueRange: existing?.revenueRange ?? null,
    employeeRange: fields.employeeRange ?? existing?.employeeRange ?? null,
    geographicCoverage:
      fields.geographicCoverage.length > 0
        ? fields.geographicCoverage
        : (existing?.geographicCoverage ?? []),
    contractSizeMin: fields.contractSizeMin ?? existing?.contractSizeMin ?? null,
    contractSizeMax: fields.contractSizeMax ?? existing?.contractSizeMax ?? null,
    customQualificationRules:
      fields.customQualificationRules.length > 0
        ? fields.customQualificationRules
        : (existing?.customQualificationRules ?? []),
  };

  const completeness = computeCompleteness(merged);

  await prisma.companyProfile.upsert({
    where: { companyId: input.companyId },
    create: {
      companyId: input.companyId,
      ...merged,
      knowledgeJson: input.knowledge as object,
      completeness,
    },
    update: {
      ...merged,
      knowledgeJson: input.knowledge as object,
      completeness,
    },
  });

  const name = input.knowledge.identity.companyName;
  if (input.mergeName && name) {
    await prisma.company.update({
      where: { id: input.companyId },
      data: {
        name,
        ...(merged.country ? { country: merged.country } : {}),
        ...(merged.companySize ? { companySize: merged.companySize } : {}),
      },
    });
  } else if (merged.country || merged.companySize) {
    await prisma.company.update({
      where: { id: input.companyId },
      data: {
        ...(merged.country ? { country: merged.country } : {}),
        ...(merged.companySize ? { companySize: merged.companySize } : {}),
      },
    });
  }
}

export function parseStoredKnowledge(raw: unknown): CompanyKnowledge | null {
  if (!raw || typeof raw !== "object") return null;
  const k = raw as CompanyKnowledge;
  if (!k.documentKind || !Array.isArray(k.services)) return null;
  if (!k.operationalCapacity) {
    k.operationalCapacity = {
      totalEmployees: k.identity?.employees ?? null,
      developers: null,
      projectManagers: null,
      qa: null,
      typicalConcurrentProjects: null,
      typicalDuration: null,
      typicalDurationMonthsMin: null,
      typicalDurationMonthsMax: null,
      notes: [],
      provenance: null,
    };
  }
  return k;
}
