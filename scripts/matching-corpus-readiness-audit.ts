/**
 * Real company corpus readiness audit — READ ONLY.
 *
 * - Does NOT modify company / matching profile data
 * - Does NOT enable Matching Engine / Sponsorship / AI / TED worker
 * - Does NOT invent capabilities or create fake companies
 * - Does NOT change scoring / thresholds
 *
 * Usage: npx tsx scripts/matching-corpus-readiness-audit.ts
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  listOverlapScore,
  type MatchingProfileSnapshot,
} from "../src/domain/matching-engine";
import { prisma } from "../src/lib/db";
import {
  getMatchingActivationReadiness,
  isMatchingEngineGloballyEnabled,
  isMatchingTestFixtureCompany,
  previewMatchingProfileForCompany,
  TED_SOURCE,
} from "../src/modules/matching-engine";
import { getMatchingAiRuntimeConfig } from "../src/modules/matching-engine/internal/ai-config";
import { isMatchingSponsorshipGloballyEnabled } from "../src/modules/matching-engine/internal/sponsorship-settings";
import { getTedPublicSettings } from "../src/modules/matching-engine/ted/config";

function isTestFixture(name: string, slug: string): boolean {
  return isMatchingTestFixtureCompany({ name, slug });
}

function missingDimensions(snapshot: MatchingProfileSnapshot): string[] {
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

function eligibilityReason(snapshot: MatchingProfileSnapshot): {
  eligible: boolean;
  reasons: string[];
  blockers: string[];
} {
  const hardServices = snapshot.services.filter((s) => s.trust !== "soft");
  const hardCerts = snapshot.certifications.filter((s) => s.trust !== "soft");
  const hardDcm = snapshot.dcmCategories.filter((s) => s.trust === "strong");
  const hasCapability =
    hardServices.length > 0 || hardCerts.length > 0 || hardDcm.length > 0;
  const hasGeo = snapshot.geographies.length > 0;
  const reasons: string[] = [];
  const blockers: string[] = [];
  if (hardServices.length) {
    reasons.push(`hard_services:${hardServices.map((s) => s.value).join("|")}`);
  }
  if (hardCerts.length) {
    reasons.push(`hard_certs:${hardCerts.map((s) => s.value).join("|")}`);
  }
  if (hardDcm.length) {
    reasons.push(`dcm:${hardDcm.map((s) => s.value).join("|")}`);
  }
  if (hasGeo) {
    reasons.push(`geography:${snapshot.geographies.map((g) => g.value).join("|")}`);
  }
  if (!hasCapability) {
    blockers.push(
      "no hard capability (need non-soft services OR certifications OR strong DCM)",
    );
  }
  if (!hasGeo) blockers.push("no geography (HQ country or geographic coverage)");
  return { eligible: hasCapability && hasGeo, reasons, blockers };
}

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

async function main() {
  const outDir = join(process.cwd(), "artifacts");
  mkdirSync(outDir, { recursive: true });

  const matchingEnabled = await isMatchingEngineGloballyEnabled();
  const sponsorshipOn = await isMatchingSponsorshipGloballyEnabled();
  const ai = await getMatchingAiRuntimeConfig();
  const tedSettings = await getTedPublicSettings();
  const readiness = await getMatchingActivationReadiness();

  const now = new Date();
  const tedOpps = await prisma.matchingOpportunity.findMany({
    where: {
      source: TED_SOURCE,
      status: "ACTIVE",
      OR: [{ deadline: null }, { deadline: { gt: now } }],
    },
    select: { services: true, industries: true, category: true, industry: true },
  });
  const tedServices = [...new Set(tedOpps.flatMap((o) => o.services))];
  const tedIndustries = [
    ...new Set(
      tedOpps.flatMap((o) => [
        ...o.industries,
        ...(o.industry ? [o.industry] : []),
      ]),
    ),
  ];

  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      country: true,
      companySize: true,
      createdAt: true,
      profile: {
        select: {
          industry: true,
          country: true,
          companySize: true,
          experienceLevel: true,
          experienceYears: true,
          services: true,
          certifications: true,
          geographicCoverage: true,
          employeeRange: true,
        },
      },
      matchingProfile: {
        select: {
          eligible: true,
          completeness: true,
          contentHash: true,
          builtAt: true,
          version: true,
        },
      },
      supplierQualificationProfile: {
        select: {
          servicesProducts: true,
          certifications: true,
          geographicCoverage: true,
          country: true,
          businessSectors: true,
        },
      },
      _count: {
        select: {
          complianceDocuments: true,
          users: true,
          tenders: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows = [];
  const missingSignalCounts: Record<string, number> = {};
  let realCount = 0;
  let fixtureCount = 0;
  let incompleteCount = 0;
  let eligibleReal = 0;
  let eligibleFixture = 0;
  let ineligibleReal = 0;
  let propagationStaleCount = 0;
  let lostSignalCompanies = 0;
  const potentiallyMatchableTed: unknown[] = [];
  const needingUserAction: unknown[] = [];
  const fixturesNeverCount: unknown[] = [];

  for (const c of companies) {
    const fixture = isTestFixture(c.name, c.slug);
    const preview = await previewMatchingProfileForCompany(c.id);
    const snap = preview.derived.snapshot;
    const elig = eligibilityReason(snap);
    const missing = missingDimensions(snap);
    for (const m of missing) bump(missingSignalCounts, m);

    const hasProfileRow = Boolean(c.profile);
    const incomplete =
      !hasProfileRow ||
      ((!c.profile?.services?.length &&
        !c.supplierQualificationProfile?.servicesProducts?.length) &&
        !c.profile?.country &&
        !c.country);

    if (fixture) {
      fixtureCount += 1;
      fixturesNeverCount.push({
        id: c.id,
        name: c.name,
        slug: c.slug,
        storedEligible: c.matchingProfile?.eligible ?? null,
        derivedEligible: preview.derived.eligible,
        note: "Exclude from activation eligible count",
      });
      if (preview.derived.eligible) eligibleFixture += 1;
    } else {
      realCount += 1;
      if (preview.derived.eligible) eligibleReal += 1;
      else ineligibleReal += 1;
    }
    if (incomplete) incompleteCount += 1;
    if (preview.propagationStale) propagationStaleCount += 1;
    if (preview.lostSignals.length) lostSignalCompanies += 1;

    const hardServices = snap.services
      .filter((s) => s.trust !== "soft")
      .map((s) => s.value);
    const serviceOverlap = listOverlapScore(hardServices, tedServices);
    const industryOverlap = listOverlapScore(
      snap.industries.filter((s) => s.trust !== "soft").map((s) => s.value),
      tedIndustries,
    );
    const potentiallyMatchable =
      !fixture &&
      preview.derived.eligible &&
      (serviceOverlap >= 50 || industryOverlap >= 70);

    const userActions: string[] = [];
    if (!fixture) {
      if (!hasProfileRow) userActions.push("complete company onboarding / profile");
      if (missing.includes("services")) {
        userActions.push("add services/capabilities on Company Profile (or SQ)");
      }
      if (missing.includes("geography")) {
        userActions.push("set HQ country and/or geographic coverage");
      }
      if (missing.includes("industry")) userActions.push("set industry");
      if (missing.includes("certifications_or_dcm")) {
        userActions.push("add certifications and/or upload valid DCM evidence");
      }
      if (missing.includes("size")) userActions.push("set company size");
      if (missing.includes("experience")) {
        userActions.push("set experience level or years");
      }
      if (preview.propagationStale) {
        userActions.push(
          "save Company Profile (or SQ/DCM) to refresh Matching Profile — or SA rebuild",
        );
      }
      if (
        preview.derived.eligible &&
        serviceOverlap < 40 &&
        hardServices.length > 0
      ) {
        userActions.push(
          "review service labels vs TED corpus (e.g. Construction work, IT services, Architectural and engineering services)",
        );
      }
    }

    const row = {
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      classification: fixture
        ? "test_fixture"
        : incomplete
          ? "incomplete_real"
          : "production_real",
      isTestFixture: fixture,
      isIncomplete: incomplete,
      derivedEligible: preview.derived.eligible,
      storedEligible: c.matchingProfile?.eligible ?? null,
      derivedCompleteness: preview.derived.completeness,
      storedCompleteness: c.matchingProfile?.completeness ?? null,
      eligibilityReasons: elig.reasons,
      eligibilityBlockers: elig.blockers,
      missingDimensions: missing,
      snapshotPublic: {
        services: snap.services.map((s) => ({
          value: s.value,
          trust: s.trust,
          source: s.source,
        })),
        industries: snap.industries.map((s) => ({
          value: s.value,
          trust: s.trust,
          source: s.source,
        })),
        geographies: snap.geographies.map((s) => ({
          value: s.value,
          trust: s.trust,
          source: s.source,
        })),
        certifications: snap.certifications.map((s) => ({
          value: s.value,
          trust: s.trust,
          source: s.source,
        })),
        dcmCategories: snap.dcmCategories.map((s) => ({
          value: s.value,
          trust: s.trust,
          source: s.source,
        })),
        size: snap.size,
        experienceYears: snap.experienceYears,
      },
      sourcePresence: {
        hasCompanyProfile: hasProfileRow,
        hasSqProfile: Boolean(c.supplierQualificationProfile),
        complianceDocumentCount: c._count.complianceDocuments,
        profileServices: c.profile?.services ?? [],
        profileCountry: c.profile?.country ?? c.country,
        profileCoverage: c.profile?.geographicCoverage ?? [],
        profileCerts: c.profile?.certifications ?? [],
        sqServices: c.supplierQualificationProfile?.servicesProducts ?? [],
      },
      propagation: {
        hasStoredMatchingProfile: Boolean(c.matchingProfile),
        stale: preview.propagationStale,
        lostSignals: preview.lostSignals,
        derivedHash: preview.derived.contentHash,
        storedHash: preview.stored?.contentHash ?? null,
      },
      tedOverlap: {
        serviceOverlapScore: serviceOverlap,
        industryOverlapScore: industryOverlap,
        potentiallyMatchableAgainstTedCorpus: potentiallyMatchable,
      },
      userActionsNeeded: userActions,
      users: c._count.users,
      tenders: c._count.tenders,
    };
    rows.push(row);

    if (potentiallyMatchable) {
      potentiallyMatchableTed.push({
        id: c.id,
        name: c.name,
        services: hardServices,
        geographies: snap.geographies.map((g) => g.value),
        serviceOverlap,
        industryOverlap,
      });
    }
    if (!fixture && userActions.length) {
      needingUserAction.push({
        id: c.id,
        name: c.name,
        actions: userActions,
        eligible: preview.derived.eligible,
      });
    }
  }

  const onboardingGaps = {
    capturesToday: [
      "services (tags)",
      "industry",
      "company size",
      "HQ country",
      "optional experience level",
    ],
    missingFromOnboarding: [
      "certifications",
      "geographicCoverage (beyond HQ country)",
      "experienceYears (numeric)",
      "employeeRange",
      "Supplier Qualification / DCM (separate modules)",
    ],
    matchingEligibilityMinimum:
      "non-soft services|certs|DCM + any geography (HQ country alone is enough for geo)",
    completenessNeedsAlso: [
      "industry OR strong service",
      "certs OR DCM",
      "size",
      "experienceYears",
    ],
    knownPipelineGaps: [
      "completeCompanyOnboardingAction / skipCompanyOnboardingAction do not schedule Matching Profile rebuild",
      "profile edit / SQ / DCM / questionnaire DO schedule rebuild",
      "soft questionnaire hints alone never create eligibility",
    ],
  };

  const proposedAdminUi = {
    surface: "Super Admin → Companies → [company] detail",
    existing: "Shows CompanyProfile fields but not CompanyMatchingProfile eligibility",
    proposedExtension: [
      "Matching readiness card: eligible yes/no, completeness %, builtAt",
      "Eligibility reason + blockers (capability / geography)",
      "Missing signals checklist (services, industry, geo, certs/DCM, size, experience)",
      "Propagation status: stored vs derived contentHash (stale banner)",
      "Optional: TED corpus overlap score (services) — diagnostic only",
      "Exclude ME8* fixtures from activation health eligible count (label as fixture)",
    ],
    safety: "Read-only; no enable Matching Engine; no private questionnaire text dump",
  };

  const blockers = [];
  if (eligibleReal === 0) {
    blockers.push(
      "No eligible REAL production companies — cannot validate Matching Engine on production tenants",
    );
  }
  if (eligibleReal < readiness.eligibleThreshold) {
    blockers.push(
      `Eligible real companies (${eligibleReal}) below threshold ${readiness.eligibleThreshold} (do not lower threshold; grow real corpus)`,
    );
  }
  if (eligibleFixture > 0) {
    blockers.push(
      `${eligibleFixture} ME/test fixtures remain in DB (excluded from production activation eligible count via isMatchingTestFixtureCompany)`,
    );
  }
  if (propagationStaleCount > 0) {
    blockers.push(
      `${propagationStaleCount} companies have stale/missing Matching Profile vs live sources (refresh via profile save — do not auto-write in audit)`,
    );
  }
  if (potentiallyMatchableTed.length === 0 && eligibleReal > 0) {
    blockers.push(
      "Eligible real companies have weak service overlap with current TED CPV corpus",
    );
  } else if (eligibleReal === 0) {
    blockers.push(
      "Need at least one real company with services overlapping TED labels (Construction work, IT services, Architectural and engineering services, Business services, …)",
    );
  }

  const smallestNextActions = [
    "Exclude ME8* fixtures from activation eligible counts in SA Matching health",
    "Add SA company-detail Matching readiness card (read-only previewMatchingProfileForCompany)",
    "Ensure onboarding completion schedules Matching Profile rebuild (no capability invention)",
    "Have 1–N real tenants complete Company Profile: services + country (+ industry/size/experience for quality)",
    "Re-run matching:real-validation once ≥1 eligible real company exists with TED-overlapping services",
  ];

  const report = {
    mode: "corpus-readiness-audit",
    wroteToDatabase: false,
    matchingEngineEnabled: matchingEnabled,
    sponsorshipEnabled: sponsorshipOn,
    matchingAiEnabled: ai.enabled,
    tedWorkerAllowed: tedSettings.workerScheduleAllowed,
    matchingEngineCodeChangesRequired: false,
    summary: {
      totalCompanies: companies.length,
      realProductionCompanies: realCount,
      testFixtures: fixtureCount,
      incompleteCompanies: incompleteCount,
      eligibleRealCompanies: eligibleReal,
      eligibleFixtures: eligibleFixture,
      ineligibleRealCompanies: ineligibleReal,
      storedEligibleAll: companies.filter((c) => c.matchingProfile?.eligible)
        .length,
      activationThreshold: readiness.eligibleThreshold,
      thresholdMetIfFixturesExcluded: eligibleReal >= readiness.eligibleThreshold,
      tedLiveOpportunities: tedOpps.length,
      tedServiceLabels: tedServices,
      propagationStaleOrMissing: propagationStaleCount,
      companiesWithLostSignalsVsStored: lostSignalCompanies,
      potentiallyMatchableAgainstTed: potentiallyMatchableTed.length,
      needingUserAction: needingUserAction.length,
    },
    mostCommonMissingSignals: Object.entries(missingSignalCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([signal, count]) => ({ signal, count })),
    companies: rows,
    potentiallyMatchableAgainstTedCorpus: potentiallyMatchableTed,
    companiesNeedingUserAction: needingUserAction,
    testFixturesNeverCountTowardActivation: fixturesNeverCount,
    onboardingDataGaps: onboardingGaps,
    proposedAdminUiExtension: proposedAdminUi,
    blockers,
    smallestNextProductActions: smallestNextActions,
    exactBlockersForRealMatchingValidation: blockers,
  };

  const outPath = join(outDir, "matching-corpus-readiness-report.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("=== Matching Corpus Readiness Audit (read-only) ===");
  console.log(
    `total=${companies.length} real=${realCount} fixtures=${fixtureCount} incomplete=${incompleteCount}`,
  );
  console.log(
    `eligibleReal=${eligibleReal} eligibleFixtures=${eligibleFixture} ineligibleReal=${ineligibleReal}`,
  );
  console.log(
    `threshold=${readiness.eligibleThreshold} metIfFixturesExcluded=${eligibleReal >= readiness.eligibleThreshold}`,
  );
  console.log(
    `TED opps=${tedOpps.length} potentiallyMatchable=${potentiallyMatchableTed.length} staleProfiles=${propagationStaleCount}`,
  );
  console.log("missing signals:", report.mostCommonMissingSignals);
  console.log("blockers:", blockers);
  console.log("Matching Engine code changes required: NO");
  console.log(`Report: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
