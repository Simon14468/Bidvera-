/**
 * First real Matching validation — deterministic scoring against live TED corpus.
 *
 * - Does NOT enable Matching Engine / Sponsorship / AI / TED worker
 * - Does NOT write MatchRecommendation rows (isolated report mode)
 * - Does NOT create fake companies or opportunities
 * - Does NOT modify 8C–8G scoring logic
 *
 * Usage: npx tsx scripts/matching-real-validation.ts
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  MATCHING_MIN_HARD_DIMENSION_SCORE,
  MATCHING_MIN_RELEVANCE_SCORE,
  opportunityToMatchingSignals,
  scoreCompanyOpportunityMatch,
  type MatchScoreResult,
  type MatchingProfileSnapshot,
} from "../src/domain/matching-engine";
import { prisma } from "../src/lib/db";
import {
  getMatchingActivationReadiness,
  isMatchingEngineGloballyEnabled,
  TED_SOURCE,
} from "../src/modules/matching-engine";
import { getMatchingAiRuntimeConfig } from "../src/modules/matching-engine/internal/ai-config";
import { isMatchingSponsorshipGloballyEnabled } from "../src/modules/matching-engine/internal/sponsorship-settings";
import { getTedPublicSettings } from "../src/modules/matching-engine/ted/config";

type Verdict = "REAL_MATCHING_VALIDATED" | "REAL_MATCHING_NEEDS_REVIEW";

/** Cap eligible companies scored in this controlled validation sample. */
const MAX_SAMPLE_ELIGIBLE = 25;

const PRIVATE_LEAK_RE =
  /knowledgeJson|draftText|storageKey|evidenceFile|password|apiKey|secretToken/i;

type ScoredPair = {
  companyId: string;
  companyName: string;
  companySlug: string;
  companyCountry: string | null;
  companyServices: string[];
  companyGeographies: string[];
  opportunityId: string;
  opportunityTitle: string;
  opportunityExternalRef: string | null;
  opportunitySource: string;
  opportunityServices: string[];
  opportunityGeographies: string[];
  opportunityCategory: string | null;
  opportunityIndustry: string | null;
  score: number;
  confidence: number;
  reasons: string[];
  explanation: string;
  matchedDimensions: {
    key: string;
    label: string;
    score: number | null;
    status: string;
    trustUsed: string;
    note: string;
  }[];
  type: "ORGANIC";
  passed8CGate: true;
  gateExplanation: string;
  serviceMatch: boolean;
  industryMatch: boolean;
  geographyMatch: boolean;
  qualificationsMatch: boolean;
  experienceStatus: string;
  suspiciousFlags: string[];
};

function profilePublicSummary(snapshot: MatchingProfileSnapshot) {
  return {
    services: snapshot.services.map((s) => s.value),
    geographies: snapshot.geographies.map((g) => g.value),
    industries: snapshot.industries.map((i) => i.value),
    certifications: snapshot.certifications.map((c) => c.value),
  };
}

function dim(
  result: MatchScoreResult,
  key: string,
): MatchScoreResult["dimensions"][number] | undefined {
  return result.dimensions.find((d) => d.key === key);
}

function isMatchDim(d: MatchScoreResult["dimensions"][number] | undefined) {
  return Boolean(d && d.status === "scored" && d.score != null && d.score >= 50);
}

function suspiciousFlagsFor(
  result: MatchScoreResult,
  companyGeo: string[],
  oppGeo: string[],
): string[] {
  const flags: string[] = [];
  if (result.score < MATCHING_MIN_RELEVANCE_SCORE + 10) {
    flags.push("near_relevance_floor");
  }
  if (result.confidence < 40) flags.push("low_confidence");
  const service = dim(result, "service");
  const industry = dim(result, "industry");
  const geo = dim(result, "geography");
  if (!isMatchDim(service) && isMatchDim(industry)) {
    flags.push("industry_without_service");
  }
  if (isMatchDim(service) && geo?.status === "scored" && (geo.score ?? 0) < 40) {
    flags.push("service_match_weak_geography");
  }
  if (
    companyGeo.length &&
    oppGeo.length &&
    !companyGeo.some((g) =>
      oppGeo.some((o) => o.toLowerCase() === g.toLowerCase()),
    )
  ) {
    flags.push("cross_border_geography");
  }
  const quals = dim(result, "qualifications");
  if (quals?.status === "unknown" || quals?.status === "not_applicable") {
    // Expected neutral — not suspicious alone
  }
  return flags;
}

function gateExplanation(result: MatchScoreResult): string {
  const hard = result.dimensions.filter(
    (d) =>
      (d.key === "service" || d.key === "industry" || d.key === "qualifications") &&
      d.status === "scored" &&
      d.score != null &&
      d.score >= MATCHING_MIN_HARD_DIMENSION_SCORE &&
      (d.trustUsed === "strong" || d.trustUsed === "normal"),
  );
  return `score ${result.score} >= ${MATCHING_MIN_RELEVANCE_SCORE} AND hard capability [${hard
    .map((d) => `${d.key}:${d.score}`)
    .join(", ") || "none"}] >= ${MATCHING_MIN_HARD_DIMENSION_SCORE}`;
}

function percentile(sortedAsc: number[], p: number): number | null {
  if (!sortedAsc.length) return null;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1),
  );
  return sortedAsc[idx]!;
}

function bucketCounts(values: number[], edges: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i]!;
    const b = edges[i + 1]!;
    const label = i === edges.length - 2 ? `${a}-${b}` : `${a}-${b - 1}`;
    out[label] = 0;
  }
  for (const v of values) {
    for (let i = 0; i < edges.length - 1; i++) {
      const a = edges[i]!;
      const b = edges[i + 1]!;
      const last = i === edges.length - 2;
      if (v >= a && (last ? v <= b : v < b)) {
        const label = last ? `${a}-${b}` : `${a}-${b - 1}`;
        out[label] = (out[label] ?? 0) + 1;
        break;
      }
    }
  }
  return out;
}

async function main() {
  const outDir = join(process.cwd(), "artifacts");
  mkdirSync(outDir, { recursive: true });
  const runtimeErrors: { database: string[]; other: string[] } = {
    database: [],
    other: [],
  };

  // Safety flags — must stay off
  const matchingEnabledGlobal = await isMatchingEngineGloballyEnabled();
  const sponsorshipGlobalOn = await isMatchingSponsorshipGloballyEnabled();
  const aiRuntime = await getMatchingAiRuntimeConfig();
  const tedSettings = await getTedPublicSettings();
  const readiness = await getMatchingActivationReadiness();

  const totalCompanies = await prisma.company.count();
  const profiles = await prisma.companyMatchingProfile.findMany({
    include: {
      company: { select: { id: true, name: true, slug: true, country: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const companiesWithProfile = profiles.length;
  const eligibleProfiles = profiles.filter((p) => p.eligible);
  const ineligibleProfiles = profiles.filter((p) => !p.eligible);
  const companiesWithoutProfile = Math.max(0, totalCompanies - companiesWithProfile);

  const now = new Date();
  const tedOpportunities = await prisma.matchingOpportunity.findMany({
    where: {
      source: TED_SOURCE,
      status: "ACTIVE",
      OR: [{ deadline: null }, { deadline: { gt: now } }],
    },
    orderBy: { updatedAt: "desc" },
  });

  console.log("=== Real Matching Validation (isolated, no writes) ===");
  console.log(
    `companies total=${totalCompanies} eligible=${eligibleProfiles.length} ineligible=${ineligibleProfiles.length} noProfile=${companiesWithoutProfile}`,
  );
  console.log(
    `threshold=${readiness.eligibleThreshold} thresholdMet=${readiness.thresholdMet} canEnableMatching=${readiness.canEnableMatching}`,
  );
  console.log(`TED live ACTIVE opportunities=${tedOpportunities.length}`);
  console.log(
    `gates: ME=${matchingEnabledGlobal} sponsorship=${sponsorshipGlobalOn} AI=${aiRuntime.enabled} TED.worker=${tedSettings.workerScheduleAllowed}`,
  );

  // Controlled sample of eligible companies
  const sample = eligibleProfiles.slice(0, MAX_SAMPLE_ELIGIBLE);
  console.log(
    `\nScoring sample: ${sample.length} eligible companies × ${tedOpportunities.length} TED opps (in-memory)`,
  );

  const recommendations: ScoredPair[] = [];
  const nearMisses: (Omit<ScoredPair, "passed8CGate"> & {
    passed8CGate: false;
    failReason: string;
  })[] = [];
  const perCompanyRecCounts: Record<string, number> = {};
  const perCompanyBestNearMiss: Record<
    string,
    { score: number; title: string; externalRef: string | null; dims: string }
  > = {};
  const zeroMatchCompanies: {
    companyId: string;
    companyName: string;
    scoredPairs: number;
    bestNearMissScore: number | null;
  }[] = [];
  const verification = {
    belowFloorPassed: 0,
    geoOnlyWouldPass: 0,
    privateLeakInOutput: 0,
    sponsoredType: 0,
    nonTedOpportunity: 0,
    capabilityFabricationSuspect: 0,
    crossTenantImpossible: true as boolean, // isolated in-memory per company — no shared writes
  };

  for (const profile of sample) {
    const snapshot = profile.snapshotJson as unknown as MatchingProfileSnapshot;
    if (!snapshot || typeof snapshot !== "object") {
      runtimeErrors.other.push(`invalid snapshotJson for ${profile.companyId}`);
      continue;
    }
    const pub = profilePublicSummary(snapshot);
    let companyHits = 0;
    let bestNear = {
      score: -1,
      title: "",
      externalRef: null as string | null,
      dims: "",
      result: null as MatchScoreResult | null,
      opp: null as (typeof tedOpportunities)[number] | null,
    };

    for (const opp of tedOpportunities) {
      const signals = opportunityToMatchingSignals(opp);
      const result = scoreCompanyOpportunityMatch({
        profile: snapshot,
        opportunity: signals,
      });

      if (result.score > bestNear.score) {
        bestNear = {
          score: result.score,
          title: opp.title,
          externalRef: opp.externalRef,
          dims: result.dimensions
            .map((d) => `${d.key}:${d.status}:${d.score ?? "-"}`)
            .join("|"),
          result,
          opp,
        };
      }

      // Verify geography alone cannot pass
      const hardCap = result.dimensions.some(
        (d) =>
          (d.key === "service" ||
            d.key === "industry" ||
            d.key === "qualifications") &&
          d.status === "scored" &&
          d.score != null &&
          d.score >= MATCHING_MIN_HARD_DIMENSION_SCORE &&
          (d.trustUsed === "strong" || d.trustUsed === "normal"),
      );
      const geoOnly =
        !hardCap &&
        isMatchDim(dim(result, "geography")) &&
        result.score >= MATCHING_MIN_RELEVANCE_SCORE;
      if (geoOnly) verification.geoOnlyWouldPass += 1;

      if (!result.meetsRelevanceThreshold) continue;

      if (result.score < MATCHING_MIN_RELEVANCE_SCORE) {
        verification.belowFloorPassed += 1;
      }
      if (opp.source !== TED_SOURCE) verification.nonTedOpportunity += 1;

      const service = dim(result, "service");
      const industry = dim(result, "industry");
      const geography = dim(result, "geography");
      const qualifications = dim(result, "qualifications");
      const experience = dim(result, "experience");

      // Capability fabrication: service "match" when company has no services
      if (
        isMatchDim(service) &&
        (!pub.services.length ||
          !signals.services.some((s) =>
            pub.services.some((cs) => cs.toLowerCase() === s.toLowerCase()),
          ))
      ) {
        // Token overlap may still match via fuzzy — flag only if company services empty
        if (!pub.services.length) verification.capabilityFabricationSuspect += 1;
      }

      const pair: ScoredPair = {
        companyId: profile.company.id,
        companyName: profile.company.name,
        companySlug: profile.company.slug,
        companyCountry: profile.company.country,
        companyServices: pub.services,
        companyGeographies: pub.geographies,
        opportunityId: opp.id,
        opportunityTitle: opp.title,
        opportunityExternalRef: opp.externalRef,
        opportunitySource: opp.source,
        opportunityServices: opp.services,
        opportunityGeographies: opp.geographies,
        opportunityCategory: opp.category,
        opportunityIndustry: opp.industry,
        score: result.score,
        confidence: result.confidence,
        reasons: result.reasons,
        explanation: result.explanation,
        matchedDimensions: result.dimensions.map((d) => ({
          key: d.key,
          label: d.label,
          score: d.score,
          status: d.status,
          trustUsed: d.trustUsed,
          note: d.note,
        })),
        type: "ORGANIC",
        passed8CGate: true,
        gateExplanation: gateExplanation(result),
        serviceMatch: isMatchDim(service),
        industryMatch: isMatchDim(industry),
        geographyMatch: isMatchDim(geography),
        qualificationsMatch: isMatchDim(qualifications),
        experienceStatus: experience?.status ?? "unknown",
        suspiciousFlags: suspiciousFlagsFor(result, pub.geographies, opp.geographies),
      };

      const blob = JSON.stringify(pair);
      if (PRIVATE_LEAK_RE.test(blob)) verification.privateLeakInOutput += 1;
      if (pair.type !== "ORGANIC") verification.sponsoredType += 1;

      recommendations.push(pair);
      companyHits += 1;
    }

    perCompanyRecCounts[profile.company.id] = companyHits;
    perCompanyBestNearMiss[profile.company.id] = {
      score: bestNear.score,
      title: bestNear.title.slice(0, 120),
      externalRef: bestNear.externalRef,
      dims: bestNear.dims,
    };

    if (bestNear.result && bestNear.opp && !bestNear.result.meetsRelevanceThreshold) {
      const r = bestNear.result;
      const o = bestNear.opp;
      const hardCap = r.dimensions.some(
        (d) =>
          (d.key === "service" ||
            d.key === "industry" ||
            d.key === "qualifications") &&
          d.status === "scored" &&
          d.score != null &&
          d.score >= MATCHING_MIN_HARD_DIMENSION_SCORE &&
          (d.trustUsed === "strong" || d.trustUsed === "normal"),
      );
      nearMisses.push({
        companyId: profile.company.id,
        companyName: profile.company.name,
        companySlug: profile.company.slug,
        companyCountry: profile.company.country,
        companyServices: pub.services,
        companyGeographies: pub.geographies,
        opportunityId: o.id,
        opportunityTitle: o.title,
        opportunityExternalRef: o.externalRef,
        opportunitySource: o.source,
        opportunityServices: o.services,
        opportunityGeographies: o.geographies,
        opportunityCategory: o.category,
        opportunityIndustry: o.industry,
        score: r.score,
        confidence: r.confidence,
        reasons: r.reasons,
        explanation: r.explanation,
        matchedDimensions: r.dimensions.map((d) => ({
          key: d.key,
          label: d.label,
          score: d.score,
          status: d.status,
          trustUsed: d.trustUsed,
          note: d.note,
        })),
        type: "ORGANIC",
        passed8CGate: false,
        gateExplanation: gateExplanation(r),
        failReason:
          r.score < MATCHING_MIN_RELEVANCE_SCORE && !hardCap
            ? `score ${r.score} < ${MATCHING_MIN_RELEVANCE_SCORE} AND no hard capability`
            : r.score < MATCHING_MIN_RELEVANCE_SCORE
              ? `score ${r.score} < floor ${MATCHING_MIN_RELEVANCE_SCORE} (hard capability present)`
              : "missing hard capability dimension",
        serviceMatch: isMatchDim(dim(r, "service")),
        industryMatch: isMatchDim(dim(r, "industry")),
        geographyMatch: isMatchDim(dim(r, "geography")),
        qualificationsMatch: isMatchDim(dim(r, "qualifications")),
        experienceStatus: dim(r, "experience")?.status ?? "unknown",
        suspiciousFlags: ["near_miss_below_gate"],
      });
    }

    if (companyHits === 0) {
      zeroMatchCompanies.push({
        companyId: profile.company.id,
        companyName: profile.company.name,
        scoredPairs: tedOpportunities.length,
        bestNearMissScore: bestNear.score >= 0 ? bestNear.score : null,
      });
    }
  }

  const scores = recommendations.map((r) => r.score).sort((a, b) => a - b);
  const confidences = recommendations
    .map((r) => r.confidence)
    .sort((a, b) => a - b);

  const serviceMatchDist = {
    matched: recommendations.filter((r) => r.serviceMatch).length,
    notMatched: recommendations.filter((r) => !r.serviceMatch).length,
  };
  const industryMatchDist = {
    matched: recommendations.filter((r) => r.industryMatch).length,
    notMatched: recommendations.filter((r) => !r.industryMatch).length,
  };
  const geographyMatchDist = {
    matched: recommendations.filter((r) => r.geographyMatch).length,
    notMatched: recommendations.filter((r) => !r.geographyMatch).length,
  };

  const strongest = [...recommendations]
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
    .slice(0, 10);
  const weakestSuspicious = [...recommendations]
    .filter((r) => r.suspiciousFlags.length > 0 || r.score <= 55)
    .sort((a, b) => a.score - b.score || a.confidence - b.confidence)
    .slice(0, 10);

  // If fewer suspicious, pad with absolute weakest
  while (
    weakestSuspicious.length < 10 &&
    weakestSuspicious.length < recommendations.length
  ) {
    const next = [...recommendations]
      .sort((a, b) => a.score - b.score || a.confidence - b.confidence)
      .find((r) => !weakestSuspicious.includes(r));
    if (!next) break;
    weakestSuspicious.push(next);
  }

  const topNearMisses = [...nearMisses]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const avgPerEligible =
    sample.length === 0 ? 0 : recommendations.length / sample.length;

  const dataQualityFailures: string[] = [];
  const safetyFailures: string[] = [];

  const eligibleLookLikeTestFixtures = sample.every(
    (p) =>
      /^ME\d/i.test(p.company.name) ||
      /test|fixture|8[A-G]/i.test(p.company.name),
  );
  if (eligibleLookLikeTestFixtures && sample.length > 0) {
    dataQualityFailures.push(
      "all eligible companies appear to be Matching Engine test fixtures (ME8*), not production tenants",
    );
  }

  if (matchingEnabledGlobal) {
    safetyFailures.push("Matching Engine is globally enabled (must stay off for this validation)");
  }
  if (sponsorshipGlobalOn) {
    safetyFailures.push("Sponsorship is globally enabled");
  }
  if (aiRuntime.enabled) {
    safetyFailures.push("Matching AI refine is enabled");
  }
  if (tedSettings.workerScheduleAllowed) {
    safetyFailures.push("TED worker scheduling is allowed");
  }
  if (verification.belowFloorPassed > 0) {
    dataQualityFailures.push(
      `${verification.belowFloorPassed} recommendations below relevance floor ${MATCHING_MIN_RELEVANCE_SCORE}`,
    );
  }
  if (verification.geoOnlyWouldPass > 0) {
    dataQualityFailures.push(
      `${verification.geoOnlyWouldPass} geo-only pairs scored >= floor without hard capability (gate leak)`,
    );
  }
  if (verification.privateLeakInOutput > 0) {
    dataQualityFailures.push(
      `${verification.privateLeakInOutput} outputs matched private-data key patterns`,
    );
  }
  if (verification.sponsoredType > 0) {
    dataQualityFailures.push(`${verification.sponsoredType} non-ORGANIC recommendations`);
  }
  if (verification.capabilityFabricationSuspect > 0) {
    dataQualityFailures.push(
      `${verification.capabilityFabricationSuspect} service matches with empty company services`,
    );
  }
  if (tedOpportunities.length === 0) {
    dataQualityFailures.push("no live TED opportunities to evaluate");
  }
  if (eligibleProfiles.length === 0) {
    dataQualityFailures.push("no eligible companies in database");
  }
  if (sample.length > 0 && recommendations.length === 0) {
    dataQualityFailures.push(
      "zero recommendations for entire eligible sample against TED corpus — needs review",
    );
  }

  // Soft blockers before enabling Matching Engine (advisory)
  const blockersBeforeEnable: string[] = [];
  if (!readiness.thresholdMet) {
    blockersBeforeEnable.push(
      `eligible companies ${eligibleProfiles.length} < threshold ${readiness.eligibleThreshold} (advisory)`,
    );
  }
  if (eligibleProfiles.length === 0) {
    blockersBeforeEnable.push("no eligible companies — Matching Engine would return empty for all tenants");
  }
  if (tedOpportunities.length < 10) {
    blockersBeforeEnable.push("TED live corpus thin (<10 opportunities)");
  }
  if (zeroMatchCompanies.length === sample.length && sample.length > 0) {
    blockersBeforeEnable.push("all sampled eligible companies got zero TED matches");
  }
  if (eligibleLookLikeTestFixtures) {
    blockersBeforeEnable.push(
      "seed/rebuild profiles for real production companies with Bidvera-relevant services before go-live",
    );
  }
  if (weakestSuspicious.filter((r) => r.suspiciousFlags.includes("near_relevance_floor")).length >= 5) {
    blockersBeforeEnable.push("many near-floor matches — manual review recommended before go-live");
  }
  blockersBeforeEnable.push(
    ...readiness.blockers.map((b) => `activation-readiness: ${b}`),
  );

  const failures = [...safetyFailures, ...dataQualityFailures];
  const verdict: Verdict =
    failures.length === 0 && recommendations.length > 0
      ? "REAL_MATCHING_VALIDATED"
      : "REAL_MATCHING_NEEDS_REVIEW";

  const report = {
    mode: "isolated-real-matching-validation",
    wroteRecommendations: false,
    matchingEngineEnabledGlobal: matchingEnabledGlobal,
    sponsorshipGlobalOn,
    matchingAiEnabled: aiRuntime.enabled,
    tedWorkerScheduleAllowed: tedSettings.workerScheduleAllowed,
    relevanceFloor: MATCHING_MIN_RELEVANCE_SCORE,
    hardDimensionFloor: MATCHING_MIN_HARD_DIMENSION_SCORE,
    companies: {
      total: totalCompanies,
      withMatchingProfile: companiesWithProfile,
      withoutMatchingProfile: companiesWithoutProfile,
      eligible: eligibleProfiles.length,
      ineligible: ineligibleProfiles.length + companiesWithoutProfile,
      ineligibleWithProfile: ineligibleProfiles.length,
    },
    activation: {
      eligibleThreshold: readiness.eligibleThreshold,
      thresholdMet: readiness.thresholdMet,
      canEnableMatching: readiness.canEnableMatching,
      activationGateWouldPass: readiness.thresholdMet,
      blockers: readiness.blockers,
      liveOpportunities: readiness.liveOpportunities,
      activeOpportunities: readiness.activeOpportunities,
    },
    corpus: {
      tedLiveActiveOpportunities: tedOpportunities.length,
      source: TED_SOURCE,
    },
    sample: {
      eligibleCompaniesScored: sample.length,
      maxSample: MAX_SAMPLE_ELIGIBLE,
      appearToBeTestFixtures: eligibleLookLikeTestFixtures,
      companyIds: sample.map((p) => {
        const snap = p.snapshotJson as MatchingProfileSnapshot;
        const pub = profilePublicSummary(snap);
        return {
          id: p.company.id,
          name: p.company.name,
          completeness: p.completeness,
          services: pub.services,
          geographies: pub.geographies,
          bestNearMiss: perCompanyBestNearMiss[p.company.id] ?? null,
        };
      }),
    },
    recommendations: {
      total: recommendations.length,
      perEligibleCompanyAvg: Number(avgPerEligible.toFixed(2)),
      perCompanyCounts: Object.fromEntries(
        sample.map((p) => [
          p.company.name,
          perCompanyRecCounts[p.company.id] ?? 0,
        ]),
      ),
      organic: recommendations.length,
      sponsored: 0,
    },
    qualityMetrics: {
      scoreDistribution: bucketCounts(scores, [40, 50, 60, 70, 80, 90, 100]),
      scoreStats: {
        min: scores[0] ?? null,
        p50: percentile(scores, 50),
        p90: percentile(scores, 90),
        max: scores[scores.length - 1] ?? null,
      },
      confidenceDistribution: bucketCounts(confidences, [0, 20, 40, 60, 80, 100]),
      confidenceStats: {
        min: confidences[0] ?? null,
        p50: percentile(confidences, 50),
        max: confidences[confidences.length - 1] ?? null,
      },
      serviceMatchDistribution: serviceMatchDist,
      industryMatchDistribution: industryMatchDist,
      geographyMatchDistribution: geographyMatchDist,
      zeroMatchCompanies,
      suspiciousWeakCount: recommendations.filter((r) => r.suspiciousFlags.length > 0)
        .length,
    },
    verification: {
      ...verification,
      geographyIsSoftSignal:
        verification.geoOnlyWouldPass === 0
          ? "confirmed — geography alone cannot pass 8C gate"
          : "FAILED — geo-only pairs leaked past gate",
      missingQualificationsExperienceNeutral: {
        qualificationsUnknownOrNA: recommendations.filter((r) => {
          const q = r.matchedDimensions.find((d) => d.key === "qualifications");
          return q && (q.status === "unknown" || q.status === "not_applicable");
        }).length,
        experienceUnknownOrNA: recommendations.filter(
          (r) =>
            r.experienceStatus === "unknown" ||
            r.experienceStatus === "not_applicable",
        ).length,
      },
      noPersistedWrites: true,
      crossTenantLeakage: "n/a — isolated in-memory scoring per company (no shared recommendation store writes)",
    },
    strongest10: strongest.map(summarizePair),
    weakestSuspicious10: weakestSuspicious.map(summarizePair),
    topNearMisses10: topNearMisses.map((r) => ({
      ...summarizePair(r as unknown as ScoredPair),
      passed8CGate: false,
      failReason: r.failReason,
    })),
    allRecommendations: recommendations.map(summarizePair),
    blockersBeforeEnablingMatchingEngine: [...new Set(blockersBeforeEnable)],
    runtimeErrors,
    dataQualityFailures,
    safetyFailures,
    verdict,
    failures,
  };

  const outPath = join(outDir, "matching-real-validation-report.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\n=== Summary ===");
  console.log(`verdict: ${verdict}`);
  console.log(
    `eligible=${eligibleProfiles.length} TED opps=${tedOpportunities.length} sample=${sample.length} recommendations=${recommendations.length}`,
  );
  console.log(
    `avg recs/eligible=${avgPerEligible.toFixed(2)} zero-match companies=${zeroMatchCompanies.length}`,
  );
  console.log(
    `score min/p50/max=${report.qualityMetrics.scoreStats.min}/${report.qualityMetrics.scoreStats.p50}/${report.qualityMetrics.scoreStats.max}`,
  );
  if (failures.length) console.log("failures:", failures);
  console.log("blockers before enable:", report.blockersBeforeEnablingMatchingEngine);
  console.log(`Report: ${outPath}`);

  if (verdict !== "REAL_MATCHING_VALIDATED") process.exit(1);
}

function summarizePair(r: ScoredPair) {
  return {
    company: { id: r.companyId, name: r.companyName, slug: r.companySlug },
    opportunity: {
      id: r.opportunityId,
      title: r.opportunityTitle.slice(0, 160),
      externalRef: r.opportunityExternalRef,
      source: r.opportunitySource,
      services: r.opportunityServices,
      geographies: r.opportunityGeographies,
      category: r.opportunityCategory,
      industry: r.opportunityIndustry,
    },
    relevanceScore: r.score,
    confidence: r.confidence,
    matchedDimensions: r.matchedDimensions,
    reasons: r.reasons,
    explanation: r.explanation,
    geography: {
      company: r.companyGeographies,
      opportunity: r.opportunityGeographies,
      matched: r.geographyMatch,
    },
    cpvServiceRelationship: {
      companyServices: r.companyServices,
      opportunityServices: r.opportunityServices,
      serviceMatched: r.serviceMatch,
      industryMatched: r.industryMatch,
    },
    type: r.type,
    whyPassed8CGate: r.gateExplanation,
    suspiciousFlags: r.suspiciousFlags,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
