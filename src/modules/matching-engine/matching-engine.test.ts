/**
 * Feature 8B — Matching Engine focused tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildMatchingProfileRecord,
  deriveMatchingProfileSnapshot,
  MATCHING_MIN_RELEVANCE_SCORE,
  opportunityToMatchingSignals,
  scoreCompanyOpportunityMatch,
  type MatchingProfileSnapshot,
} from "@/domain/matching-engine";
import {
  MATCHING_ENGINE_FEATURE_KEY,
  MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY,
  MATCHING_ENGINE_MODULE_ID,
} from "@/modules/matching-engine";
import {
  ENTITLEMENT_FEATURE_KEYS,
  isCommerciallyAvailableFeature,
  PLAN_ENTITLEMENT_DEFAULTS,
  UNSHIPPED_ENTITLEMENT_KEYS,
} from "@/domain/billing/entitlement-catalog";
import { assertCanManageCompanySettings } from "@/auth/company-settings-access";
import { AppError } from "@/lib/errors";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function baseSnapshot(
  overrides: Partial<MatchingProfileSnapshot> = {},
): MatchingProfileSnapshot {
  return {
    services: [
      { value: "Facilities management", trust: "normal", source: "company_profile" },
    ],
    industries: [
      { value: "Facilities", trust: "normal", source: "company_profile" },
    ],
    geographies: [
      { value: "Morocco", trust: "normal", source: "company_profile" },
    ],
    certifications: [
      { value: "ISO 9001", trust: "strong", source: "dcm.valid" },
    ],
    size: { value: "51-200", trust: "normal", source: "company_profile" },
    experienceYears: { value: 10, trust: "normal", source: "company_profile" },
    dcmCategories: [
      { value: "ISO 9001", trust: "strong", source: "dcm.valid" },
    ],
    softNotes: [],
    ...overrides,
  };
}

describe("matching-engine identity & gate defaults", () => {
  it("registers matching_engine OFF by default and not sold", () => {
    assert.equal(MATCHING_ENGINE_MODULE_ID, "matching-engine");
    assert.equal(MATCHING_ENGINE_FEATURE_KEY, "matching_engine");
    assert.ok(ENTITLEMENT_FEATURE_KEYS.includes("matching_engine"));
    assert.ok(UNSHIPPED_ENTITLEMENT_KEYS.includes("matching_engine"));
    assert.equal(isCommerciallyAvailableFeature("matching_engine"), false);
    for (const keys of Object.values(PLAN_ENTITLEMENT_DEFAULTS)) {
      assert.ok(!keys.includes("matching_engine"));
    }
    const catalog = readSrc("src/domain/billing/entitlement-catalog.ts");
    assert.match(catalog, /defaultEnabledGlobal:\s*false/);
    const settings = readSrc("src/services/settings/index.ts");
    assert.match(settings, /matching_engine\.min_eligible_companies/);
    assert.match(settings, /n:\s*45/);
    assert.equal(
      MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY,
      "matching_engine.min_eligible_companies",
    );
  });

  it("access gate reads SystemSetting threshold — does not hard-code 45 in access logic", () => {
    const access = readSrc("src/modules/matching-engine/access.ts");
    assert.match(access, /getMatchingEngineMinEligibleCompanies/);
    assert.match(access, /MATCHING_ENGINE_MIN_ELIGIBLE_SETTING_KEY/);
    assert.doesNotMatch(access, /\b45\b/);
    assert.match(access, /isMatchingEngineThresholdMet/);
    assert.match(access, /hasFeature/);
  });

  it("hides navigation and dashboard matching when gate closed", () => {
    const sidebar = readSrc("src/components/app/app-sidebar.tsx");
    assert.match(sidebar, /matchedOpportunities/);
    assert.match(sidebar, /hideWhenDisabled:\s*true/);
    assert.match(sidebar, /matchingEngine/);
    const dash = readSrc("src/app/(app)/dashboard/page.tsx");
    assert.match(dash, /getMatchingDashboardOverview/);
    assert.match(dash, /MatchingEngineOverview/);
    assert.match(dash, /state !== "unavailable"/);
    const overview = readSrc("src/application/matching-dashboard-overview.ts");
    assert.match(overview, /isMatchingEngineAvailable/);
    assert.match(overview, /state:\s*"unavailable"/);
    const page = readSrc("src/app/(app)/matched-opportunities/page.tsx");
    assert.match(page, /requireMatchingEngineModule/);
  });

  it("does not scrape or reuse TenderDecision as MatchRecommendation", () => {
    const service = readSrc("src/modules/matching-engine/internal/service.ts");
    assert.doesNotMatch(service, /processTenderAnalysis|tender-processing/);
    assert.doesNotMatch(service, /prisma\.tenderDecision/);
    assert.match(service, /scoreCompanyOpportunityMatch/);
    assert.match(service, /sponsored/);
  });
});

describe("matching profile trust tiers", () => {
  it("treats verified evidence and DCM as strong; structured profile as normal", () => {
    const snapshot = deriveMatchingProfileSnapshot({
      company: { country: "Morocco", companySize: "51-200" },
      profile: {
        industry: "Facilities",
        country: "Morocco",
        companySize: "51-200",
        experienceLevel: "experienced",
        services: ["Cleaning"],
        certifications: ["ISO 14001"],
        experienceYears: 8,
        geographicCoverage: ["Casablanca"],
        employeeRange: null,
      },
      sq: null,
      verifiedEvidence: [{ title: "ISO 9001 Certificate", kind: "CERT" }],
      dcmValidCategories: [{ key: "iso9001", label: "ISO 9001" }],
      approvedQuestionnaireHints: [],
    });
    assert.ok(snapshot.services.some((s) => s.value === "Cleaning" && s.trust === "normal"));
    assert.ok(
      snapshot.certifications.some(
        (c) => c.value.includes("ISO 9001") && c.trust === "strong",
      ),
    );
    assert.ok(snapshot.dcmCategories.some((d) => d.trust === "strong"));
    const record = buildMatchingProfileRecord(snapshot);
    assert.equal(record.eligible, true);
  });

  it("treats approved questionnaire hints as soft only", () => {
    const snapshot = deriveMatchingProfileSnapshot({
      company: { country: null, companySize: null },
      profile: null,
      sq: {
        country: "Kenya",
        businessSectors: [],
        servicesProducts: ["Security"],
        certifications: [],
        geographicCoverage: ["Nairobi"],
        employeeCount: null,
        yearEstablished: null,
      },
      verifiedEvidence: [],
      dcmValidCategories: [],
      approvedQuestionnaireHints: ["We provide 24/7 manned guarding"],
    });
    const soft = snapshot.services.filter((s) => s.trust === "soft");
    assert.ok(soft.some((s) => /guarding/i.test(s.value)));
    assert.ok(snapshot.softNotes.length > 0);
  });

  it("missing data stays neutral — not eligible without geo + capability", () => {
    const snapshot = deriveMatchingProfileSnapshot({
      company: { country: null, companySize: null },
      profile: null,
      sq: null,
      verifiedEvidence: [],
      dcmValidCategories: [],
      approvedQuestionnaireHints: [],
    });
    const record = buildMatchingProfileRecord(snapshot);
    assert.equal(record.eligible, false);
    assert.equal(snapshot.services.length, 0);
  });

  it("does not fabricate signals from empty inputs", () => {
    const snapshot = deriveMatchingProfileSnapshot({
      company: { country: "UAE", companySize: null },
      profile: {
        industry: null,
        country: null,
        companySize: null,
        experienceLevel: null,
        services: [],
        certifications: [],
        experienceYears: null,
        geographicCoverage: [],
        employeeRange: null,
      },
      sq: null,
      verifiedEvidence: [],
      dcmValidCategories: [],
      approvedQuestionnaireHints: [],
    });
    assert.equal(snapshot.services.length, 0);
    assert.equal(snapshot.certifications.length, 0);
    assert.ok(snapshot.geographies.some((g) => g.value === "UAE"));
  });
});

describe("matching score & sponsored threshold", () => {
  it("scores a strong relevant match with explainable reasons", () => {
    const result = scoreCompanyOpportunityMatch({
      profile: baseSnapshot(),
      opportunity: opportunityToMatchingSignals({
        services: ["Facilities management", "Cleaning"],
        industries: ["Facilities"],
        geographies: ["Morocco"],
        certifications: ["ISO 9001"],
        sizeBand: "51-200",
        experienceHint: "5 years",
        category: "FM",
        industry: "Facilities",
      }),
    });
    assert.ok(result.score >= MATCHING_MIN_RELEVANCE_SCORE);
    assert.ok(result.meetsRelevanceThreshold);
    assert.ok(result.confidence > 0);
    assert.ok(result.reasons.length > 0);
    assert.ok(result.explanation.length > 0);
    assert.ok(result.dimensions.some((d) => d.key === "service" && (d.score ?? 0) >= 50));
  });

  it("partial match may score below threshold", () => {
    const result = scoreCompanyOpportunityMatch({
      profile: baseSnapshot({
        services: [{ value: "Catering", trust: "normal", source: "p" }],
        industries: [{ value: "Hospitality", trust: "normal", source: "p" }],
        geographies: [{ value: "Morocco", trust: "normal", source: "p" }],
        certifications: [],
        dcmCategories: [],
        size: null,
        experienceYears: null,
      }),
      opportunity: opportunityToMatchingSignals({
        services: ["Software development"],
        industries: ["IT"],
        geographies: ["Singapore"],
        certifications: ["ISO 27001"],
        sizeBand: "1000+",
        experienceHint: "15 years",
      }),
    });
    assert.equal(result.meetsRelevanceThreshold, false);
  });

  it("irrelevant opportunity does not meet relevance", () => {
    const result = scoreCompanyOpportunityMatch({
      profile: baseSnapshot(),
      opportunity: opportunityToMatchingSignals({
        services: ["Satellite manufacturing"],
        industries: ["Aerospace"],
        geographies: ["Antarctica"],
        certifications: ["AS9100"],
        sizeBand: "1000+",
        experienceHint: "20 years",
      }),
    });
    assert.ok(result.score < MATCHING_MIN_RELEVANCE_SCORE || !result.meetsRelevanceThreshold);
  });

  it("geography-only overlap does not meet relevance without capability match", () => {
    const result = scoreCompanyOpportunityMatch({
      profile: baseSnapshot({
        services: [{ value: "Construction", trust: "normal", source: "p" }],
        industries: [{ value: "Construction", trust: "normal", source: "p" }],
        certifications: [],
        dcmCategories: [],
      }),
      opportunity: opportunityToMatchingSignals({
        services: ["Agricultural Equipment"],
        industries: ["Agriculture"],
        geographies: ["Morocco"],
        certifications: [],
        sizeBand: "Medium",
        experienceHint: "5 years",
      }),
    });
    assert.equal(result.meetsRelevanceThreshold, false);
  });

  it("missing company dimension is unknown — not a positive match", () => {
    const result = scoreCompanyOpportunityMatch({
      profile: baseSnapshot({ services: [] }),
      opportunity: opportunityToMatchingSignals({
        services: ["Facilities management"],
        industries: ["Facilities"],
        geographies: ["Morocco"],
        certifications: [],
      }),
    });
    const service = result.dimensions.find((d) => d.key === "service");
    assert.equal(service?.status, "unknown");
    assert.equal(service?.score, null);
  });

  it("soft-only signals are capped and cannot alone confirm hard match", () => {
    const result = scoreCompanyOpportunityMatch({
      profile: baseSnapshot({
        services: [{ value: "Facilities management", trust: "soft", source: "qa" }],
        industries: [{ value: "Facilities", trust: "soft", source: "qa" }],
        certifications: [],
        dcmCategories: [],
        size: null,
        experienceYears: null,
      }),
      opportunity: opportunityToMatchingSignals({
        services: ["Facilities management"],
        industries: ["Facilities"],
        geographies: ["Morocco"],
        certifications: [],
      }),
    });
    const service = result.dimensions.find((d) => d.key === "service");
    assert.ok((service?.score ?? 100) <= 35);
  });

  it("sponsored flag does not bypass relevance in recommendation generation logic", () => {
    const service = readSrc("src/modules/matching-engine/internal/service.ts");
    assert.match(service, /meetsRelevanceThreshold/);
    assert.match(service, /isOpportunitySponsoredForMatching/);
    const ui = readSrc("src/modules/matching-engine/ui/matched-strip.tsx");
    assert.match(ui, /MATCHED|Matched/);
    assert.doesNotMatch(ui, /\bADS\b|ADVERTISEMENT/);
    assert.match(ui, /Sponsored/);
  });

  it("ranks organic ahead of sponsored at equal score in list sorter", () => {
    const service = readSrc("src/modules/matching-engine/internal/service.ts");
    assert.match(service, /compareMatchRank/);
    const sponsorship = readSrc("src/domain/matching-engine/sponsorship.ts");
    assert.match(sponsorship, /a\.type === "ORGANIC"/);
  });
});

describe("matching security isolation", () => {
  it("APIs assert Matching Engine availability and scope by companyId", () => {
    const rec = readSrc("src/app/api/matching-engine/recommendations/route.ts");
    assert.match(rec, /assertMatchingEngineAvailable/);
    assert.match(rec, /listRecommendationsForCompany\(companyId/);
    const profile = readSrc("src/app/api/matching-engine/profile/route.ts");
    assert.match(profile, /assertMatchingEngineAvailable/);
    const opp = readSrc(
      "src/app/api/matching-engine/opportunities/[opportunityId]/route.ts",
    );
    assert.match(opp, /getPublicOpportunity/);
    const service = readSrc("src/modules/matching-engine/internal/service.ts");
    assert.match(service, /where: \{ companyId/);
    assert.doesNotMatch(service, /knowledgeJson/);
  });

  it("company Matching Engine mutation APIs require OWNER/ADMIN", () => {
    const mutationRoutes = [
      "src/app/api/matching-engine/profile/route.ts",
      "src/app/api/matching-engine/sponsorships/route.ts",
      "src/app/api/matching-engine/sponsorship-pricing/requests/route.ts",
      "src/app/api/matching-engine/recommendations/generate/route.ts",
      "src/app/api/matching-engine/recommendations/[recommendationId]/dismiss/route.ts",
      "src/app/api/matching-engine/recommendations/[recommendationId]/read/route.ts",
      "src/app/api/matching-engine/events/route.ts",
    ];
    for (const file of mutationRoutes) {
      const src = readSrc(file);
      const post = src.slice(src.indexOf("export async function POST"));
      assert.match(
        post,
        /assertCanManageCompanySettings\(auth\.user\.role\)/,
        `${file} POST missing OWNER/ADMIN gate`,
      );
      // Gate must run before Matching Engine availability / mutation work.
      const gateIdx = post.indexOf("assertCanManageCompanySettings(auth.user.role)");
      const availIdx = post.indexOf("assertMatchingEngineAvailable");
      assert.ok(gateIdx >= 0, `${file} missing gate`);
      if (availIdx >= 0) {
        assert.ok(gateIdx < availIdx, `${file} OWNER/ADMIN gate must precede availability check`);
      }
    }
    const profileGet = readSrc("src/app/api/matching-engine/profile/route.ts");
    const getChunk = profileGet.slice(
      profileGet.indexOf("export async function GET"),
      profileGet.indexOf("export async function POST"),
    );
    assert.doesNotMatch(getChunk, /assertCanManageCompanySettings/);

    // VIEWER/MEMBER => 403 (shared company-settings gate used by ME mutations).
    for (const role of ["VIEWER", "MEMBER"] as const) {
      assert.throws(
        () => assertCanManageCompanySettings(role),
        (error: unknown) =>
          error instanceof AppError &&
          error.status === 403 &&
          /OWNER or ADMIN/i.test(error.message),
      );
    }
  });

  it("public opportunity DTO excludes private company fields", () => {
    const types = readSrc("src/modules/matching-engine/internal/types.ts");
    assert.match(types, /PublicOpportunityDto/);
    assert.doesNotMatch(types, /knowledgeJson|draftText|storageKey/);
  });

  it("rebuild hooks use application boundary", () => {
    const hook = readSrc("src/application/matching-rebuild.ts");
    assert.match(hook, /scheduleMatchingProfileRebuild/);
    assert.match(hook, /rebuildMatchingProfileForCompany/);
    const company = readSrc("src/application/company-service.ts");
    assert.match(company, /scheduleMatchingProfileRebuild/);
    const onboarding = readSrc("src/application/auth-service.ts");
    assert.match(onboarding, /scheduleMatchingProfileRebuild/);
    assert.match(onboarding, /completeCompanyOnboardingAction/);
    assert.match(onboarding, /skipCompanyOnboardingAction/);
  });
});
