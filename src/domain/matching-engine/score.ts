import { capabilityMatchesText, CAPABILITY_GROUPS } from "@/domain/company-knowledge/normalize";
import {
  listOverlapScore,
  normalizeMatchingToken,
  tokens,
} from "./normalize";
import type {
  MatchScoreResult,
  MatchedDimensionResult,
  MatchingDimensionKey,
  MatchingProfileSnapshot,
  MatchingTrustTier,
  OpportunityMatchingSignals,
} from "./types";
import {
  MATCHING_DIMENSION_WEIGHTS,
  MATCHING_MIN_HARD_DIMENSION_SCORE,
  MATCHING_MIN_RELEVANCE_SCORE,
} from "./types";

function bestTrust(signals: { trust: MatchingTrustTier }[]): MatchingTrustTier | "none" {
  if (signals.length === 0) return "none";
  if (signals.some((s) => s.trust === "strong")) return "strong";
  if (signals.some((s) => s.trust === "normal")) return "normal";
  return "soft";
}

function applyTrustCap(score: number, trust: MatchingTrustTier | "none"): number {
  if (trust === "none") return 0;
  if (trust === "soft") return Math.min(score, 35);
  if (trust === "normal") return Math.min(score, 92);
  return score;
}

function valuesByTrust(
  signals: { value: string; trust: MatchingTrustTier }[],
  includeSoft: boolean,
): string[] {
  return signals
    .filter((s) => includeSoft || s.trust !== "soft")
    .map((s) => s.value);
}

function scoreServiceDimension(
  profile: MatchingProfileSnapshot,
  opportunity: OpportunityMatchingSignals,
): MatchedDimensionResult {
  const oppServices = [
    ...opportunity.services,
    opportunity.category ? opportunity.category : "",
  ].filter(Boolean);
  if (oppServices.length === 0) {
    return {
      key: "service",
      label: "Service",
      score: null,
      status: "not_applicable",
      trustUsed: "none",
      note: "Opportunity has no service signals.",
    };
  }
  if (profile.services.length === 0) {
    return {
      key: "service",
      label: "Service",
      score: null,
      status: "unknown",
      trustUsed: "none",
      note: "Company services not provided — not treated as a match.",
    };
  }

  const hard = valuesByTrust(profile.services, false);
  const soft = valuesByTrust(profile.services, true);
  const trust = bestTrust(profile.services);
  const corpus = oppServices.map(normalizeMatchingToken).join(" ");

  let raw = listOverlapScore(hard.length > 0 ? hard : soft, oppServices);
  const semanticHits = (hard.length > 0 ? hard : soft).filter((s) => {
    const group = CAPABILITY_GROUPS.find(
      (g) =>
        normalizeMatchingToken(g.normalized) === normalizeMatchingToken(s) ||
        capabilityMatchesText(g.normalized, s),
    );
    const normalized = group?.normalized ?? s;
    return capabilityMatchesText(normalized, corpus);
  }).length;
  if (semanticHits > 0) {
    raw = Math.max(raw, Math.min(96, 55 + semanticHits * 12));
  }

  const capped = applyTrustCap(raw, trust);
  return {
    key: "service",
    label: "Service",
    score: capped,
    status: "scored",
    trustUsed: trust,
    note:
      capped >= 50
        ? `Service overlap with opportunity (${trust} signals).`
        : "Limited service overlap.",
  };
}

function scoreListDimension(input: {
  key: MatchingDimensionKey;
  label: string;
  company: { value: string; trust: MatchingTrustTier }[];
  opportunity: string[];
  emptyOppNote: string;
  missingCompanyNote: string;
}): MatchedDimensionResult {
  if (input.opportunity.length === 0) {
    return {
      key: input.key,
      label: input.label,
      score: null,
      status: "not_applicable",
      trustUsed: "none",
      note: input.emptyOppNote,
    };
  }
  if (input.company.length === 0) {
    return {
      key: input.key,
      label: input.label,
      score: null,
      status: "unknown",
      trustUsed: "none",
      note: input.missingCompanyNote,
    };
  }
  const trust = bestTrust(input.company);
  const hard = valuesByTrust(input.company, false);
  const raw = listOverlapScore(
    hard.length > 0 ? hard : valuesByTrust(input.company, true),
    input.opportunity,
  );
  const capped = applyTrustCap(raw, trust);
  return {
    key: input.key,
    label: input.label,
    score: capped,
    status: "scored",
    trustUsed: trust,
    note:
      capped >= 50
        ? `${input.label} alignment (${trust}).`
        : `Weak ${input.label.toLowerCase()} alignment.`,
  };
}

function scoreExperience(
  profile: MatchingProfileSnapshot,
  opportunity: OpportunityMatchingSignals,
): MatchedDimensionResult {
  if (opportunity.experienceYearsRequired == null) {
    return {
      key: "experience",
      label: "Experience",
      score: null,
      status: "not_applicable",
      trustUsed: "none",
      note: "Opportunity has no experience requirement.",
    };
  }
  if (!profile.experienceYears) {
    return {
      key: "experience",
      label: "Experience",
      score: null,
      status: "unknown",
      trustUsed: "none",
      note: "Company experience not provided — not treated as a match.",
    };
  }
  const required = opportunity.experienceYearsRequired;
  const have = profile.experienceYears.value;
  const trust = profile.experienceYears.trust;
  let raw = 0;
  if (have >= required) raw = 90;
  else if (have >= required * 0.75) raw = 60;
  else raw = 25;
  const capped = applyTrustCap(raw, trust);
  return {
    key: "experience",
    label: "Experience",
    score: capped,
    status: "scored",
    trustUsed: trust,
    note:
      have >= required
        ? `Experience meets opportunity requirement (${have}y / ${required}y).`
        : `Experience below requirement (${have}y / ${required}y).`,
  };
}

function scoreSize(
  profile: MatchingProfileSnapshot,
  opportunity: OpportunityMatchingSignals,
): MatchedDimensionResult {
  if (!opportunity.sizeBand) {
    return {
      key: "size",
      label: "Company size",
      score: null,
      status: "not_applicable",
      trustUsed: "none",
      note: "Opportunity has no size band.",
    };
  }
  if (!profile.size) {
    return {
      key: "size",
      label: "Company size",
      score: null,
      status: "unknown",
      trustUsed: "none",
      note: "Company size not provided — not treated as a match.",
    };
  }
  const trust = profile.size.trust;
  const a = normalizeMatchingToken(profile.size.value);
  const b = normalizeMatchingToken(opportunity.sizeBand);
  let raw = 0;
  if (a === b) raw = 95;
  else if (a.includes(b) || b.includes(a)) raw = 75;
  else if (tokens(a).some((t) => tokens(b).includes(t))) raw = 55;
  else raw = 15;
  const capped = applyTrustCap(raw, trust);
  return {
    key: "size",
    label: "Company size",
    score: capped,
    status: "scored",
    trustUsed: trust,
    note:
      capped >= 50
        ? `Size band compatible (${profile.size.value}).`
        : "Size band does not align.",
  };
}

/**
 * Deterministic, explainable first-generation matcher.
 * Missing company data → unknown (never positive). Soft/VERIFY-tier → capped.
 */
export function scoreCompanyOpportunityMatch(input: {
  profile: MatchingProfileSnapshot;
  opportunity: OpportunityMatchingSignals;
}): MatchScoreResult {
  const { profile, opportunity } = input;

  const industries = [
    ...opportunity.industries,
    ...(opportunity.industry ? [opportunity.industry] : []),
  ];

  const dimensions: MatchedDimensionResult[] = [
    scoreServiceDimension(profile, opportunity),
    scoreListDimension({
      key: "industry",
      label: "Industry",
      company: profile.industries,
      opportunity: industries,
      emptyOppNote: "Opportunity has no industry signals.",
      missingCompanyNote: "Company industry not provided — not treated as a match.",
    }),
    scoreListDimension({
      key: "geography",
      label: "Geography",
      company: profile.geographies,
      opportunity: opportunity.geographies,
      emptyOppNote: "Opportunity has no geography signals.",
      missingCompanyNote: "Company geography not provided — not treated as a match.",
    }),
    scoreListDimension({
      key: "qualifications",
      label: "Qualifications",
      company: [...profile.certifications, ...profile.dcmCategories],
      opportunity: opportunity.certifications,
      emptyOppNote: "Opportunity has no qualification signals.",
      missingCompanyNote:
        "Company qualifications not provided — not treated as a match.",
    }),
    scoreExperience(profile, opportunity),
    scoreSize(profile, opportunity),
  ];

  let weightSum = 0;
  let weighted = 0;
  for (const d of dimensions) {
    if (d.status !== "scored" || d.score == null) continue;
    const w = MATCHING_DIMENSION_WEIGHTS[d.key];
    weightSum += w;
    weighted += d.score * w;
  }

  const score = weightSum > 0 ? Math.round(weighted / weightSum) : 0;

  const scoredHard = dimensions.filter(
    (d) =>
      d.status === "scored" &&
      d.score != null &&
      d.score >= MATCHING_MIN_HARD_DIMENSION_SCORE &&
      (d.trustUsed === "strong" || d.trustUsed === "normal"),
  );
  const applicable = dimensions.filter((d) => d.status !== "not_applicable").length;
  const known = dimensions.filter((d) => d.status === "scored").length;
  const confidence =
    applicable === 0
      ? 0
      : Math.round(
          Math.min(
            100,
            (known / applicable) * 55 +
              (scoredHard.length / Math.max(1, applicable)) * 45,
          ),
        );

  const reasons = dimensions
    .filter((d) => d.status === "scored" && d.score != null && d.score >= 50)
    .map((d) => d.note)
    .slice(0, 4);

  const explanation =
    reasons[0] ??
    (score >= MATCHING_MIN_RELEVANCE_SCORE
      ? "Partial alignment across available dimensions."
      : "Insufficient alignment for a recommendation.");

  /** Geography/size/experience alone must not recommend an irrelevant opportunity. */
  const CAPABILITY_KEYS: MatchingDimensionKey[] = [
    "service",
    "industry",
    "qualifications",
  ];
  const hardCapabilityMatch = scoredHard.some((d) =>
    CAPABILITY_KEYS.includes(d.key),
  );

  const meetsRelevanceThreshold =
    score >= MATCHING_MIN_RELEVANCE_SCORE && hardCapabilityMatch;

  return {
    score,
    confidence,
    dimensions,
    reasons,
    explanation,
    meetsRelevanceThreshold,
  };
}

export function opportunityToMatchingSignals(opp: {
  services?: string[] | null;
  industries?: string[] | null;
  geographies?: string[] | null;
  certifications?: string[] | null;
  sizeBand?: string | null;
  experienceHint?: string | null;
  category?: string | null;
  industry?: string | null;
  signalsJson?: unknown;
}): OpportunityMatchingSignals {
  const fromJson =
    opp.signalsJson && typeof opp.signalsJson === "object"
      ? (opp.signalsJson as Record<string, unknown>)
      : {};

  const experienceYearsRequired = (() => {
    if (typeof fromJson.experienceYearsRequired === "number") {
      return fromJson.experienceYearsRequired;
    }
    if (opp.experienceHint) {
      const m = opp.experienceHint.match(/(\d+)/);
      return m ? Number(m[1]) : null;
    }
    return null;
  })();

  return {
    services: opp.services ?? [],
    industries: opp.industries ?? [],
    geographies: opp.geographies ?? [],
    certifications: opp.certifications ?? [],
    sizeBand: opp.sizeBand ?? null,
    experienceYearsRequired,
    category: opp.category ?? null,
    industry: opp.industry ?? null,
  };
}
