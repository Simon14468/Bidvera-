/**
 * Super Admin Matching readiness diagnostics — read-only.
 * Uses previewCompanyMatchingProfile; never mutates company data.
 */

import { listOverlapScore } from "@/domain/matching-engine";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import {
  isMatchingTestFixtureCompany,
  previewMatchingProfileForCompany,
  rebuildMatchingProfileForCompany,
  TED_SOURCE,
} from "@/modules/matching-engine";

export type SaMatchingReadinessDto = {
  companyId: string;
  isTestFixture: boolean;
  eligible: boolean;
  completeness: number;
  blockers: string[];
  missingSignals: string[];
  services: string[];
  geographies: string[];
  certifications: string[];
  storedProfile: {
    exists: boolean;
    eligible: boolean | null;
    completeness: number | null;
    stale: boolean;
    version: number | null;
    builtAt: string | null;
  };
  tedOverlap: {
    serviceOverlapScore: number;
    liveTedOpportunityCount: number;
  } | null;
};

function missingSignalsFromSnapshot(snapshot: {
  services: { trust: string }[];
  industries: { trust: string }[];
  geographies: unknown[];
  certifications: { trust: string }[];
  dcmCategories: { trust: string }[];
  size: unknown;
  experienceYears: unknown;
}): string[] {
  const missing: string[] = [];
  if (!snapshot.services.some((s) => s.trust !== "soft")) missing.push("services");
  if (
    !snapshot.industries.some((s) => s.trust !== "soft") &&
    !snapshot.services.some((s) => s.trust === "strong")
  ) {
    missing.push("industry");
  }
  if (!snapshot.geographies.length) missing.push("geography");
  if (
    !snapshot.certifications.some((s) => s.trust !== "soft") &&
    !snapshot.dcmCategories.some((s) => s.trust === "strong")
  ) {
    missing.push("certifications_or_dcm");
  }
  if (!snapshot.size) missing.push("size");
  if (!snapshot.experienceYears) missing.push("experience");
  return missing;
}

export async function getCompanyMatchingReadinessForAdmin(
  companyId: string,
): Promise<SaMatchingReadinessDto> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, slug: true },
  });
  if (!company) {
    throw new AppError(ErrorCode.NOT_FOUND, "Company not found.", 404);
  }

  const preview = await previewMatchingProfileForCompany(companyId);
  const snap = preview.derived.snapshot;
  const hardServices = snap.services.filter((s) => s.trust !== "soft");
  const hardCerts = snap.certifications.filter((s) => s.trust !== "soft");
  const hardDcm = snap.dcmCategories.filter((s) => s.trust === "strong");
  const blockers: string[] = [];
  if (!hardServices.length && !hardCerts.length && !hardDcm.length) {
    blockers.push(
      "No hard capability (non-soft services, certifications, or strong DCM)",
    );
  }
  if (!snap.geographies.length) {
    blockers.push("No geography (HQ country or geographic coverage)");
  }
  if (preview.propagationStale && !preview.stored) {
    blockers.push("CompanyMatchingProfile not materialized yet");
  } else if (preview.propagationStale) {
    blockers.push("Stored Matching Profile is stale vs live sources");
  }

  const now = new Date();
  const ted = await prisma.matchingOpportunity.findMany({
    where: {
      source: TED_SOURCE,
      status: "ACTIVE",
      OR: [{ deadline: null }, { deadline: { gt: now } }],
    },
    select: { services: true },
    take: 500,
  });
  const tedServices = [...new Set(ted.flatMap((o) => o.services))];
  const serviceOverlapScore = listOverlapScore(
    hardServices.map((s) => s.value),
    tedServices,
  );

  return {
    companyId,
    isTestFixture: isMatchingTestFixtureCompany(company),
    eligible: preview.derived.eligible,
    completeness: preview.derived.completeness,
    blockers,
    missingSignals: missingSignalsFromSnapshot(snap),
    services: hardServices.map((s) => s.value),
    geographies: snap.geographies.map((g) => g.value),
    certifications: [
      ...hardCerts.map((c) => c.value),
      ...hardDcm.map((c) => c.value),
    ],
    storedProfile: {
      exists: Boolean(preview.stored),
      eligible: preview.stored?.eligible ?? null,
      completeness: preview.stored?.completeness ?? null,
      stale: preview.propagationStale,
      version: preview.stored?.version ?? null,
      builtAt: preview.stored?.builtAt ?? null,
    },
    tedOverlap: {
      serviceOverlapScore,
      liveTedOpportunityCount: ted.length,
    },
  };
}

/**
 * Explicit Super Admin rebuild via existing rebuildMatchingProfileForCompany.
 * Derives only from live sources — does not invent capabilities.
 */
export async function rebuildMatchingProfileForAdmin(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) {
    throw new AppError(ErrorCode.NOT_FOUND, "Company not found.", 404);
  }
  const dto = await rebuildMatchingProfileForCompany(companyId);
  const readiness = await getCompanyMatchingReadinessForAdmin(companyId);
  return { profile: dto, readiness };
}
