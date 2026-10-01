import { capabilityMatchesText, CAPABILITY_GROUPS } from "@/domain/company-knowledge/normalize";
import {
  certificationCoverage,
  geographyHierarchyScore,
  listOverlapScore,
  normalizeMatchingToken,
  normalizeSizeBand,
  parseExperienceYearsHint,
  sizeBandDistance,
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

function profileCountries(profile: MatchingProfileSnapshot): {
  value: string;
  trust: MatchingTrustTier;
}[] {
  if (profile.countries && profile.countries.length > 0) {
    return profile.countries;
  }
  // Backward-compat: older snapshots stored country inside geographies.
  return profile.geographies;
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
  const matched = (hard.length > 0 ? hard : soft).filter((s) => {
    const sn = normalizeMatchingToken(s);
    return oppServices.some((o) => {
      const on = normalizeMatchingToken(o);
      return sn === on || sn.includes(on) || on.includes(sn);
    });
  });
  return {
    key: "service",
    label: "Service",
    score: capped,
    status: "scored",
    trustUsed: trust,
    note:
      capped >= 50
        ? matched.length > 0
          ? `Service overlap: ${matched.slice(0, 2).join(", ")} (${trust}).`
          : `Service overlap with opportunity (${trust} signals).`
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
  overlapFn?: (company: string[], opportunity: string[]) => number;
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
  const companyVals = hard.length > 0 ? hard : valuesByTrust(input.company, true);
  const raw = (input.overlapFn ?? listOverlapScore)(companyVals, input.opportunity);
  const capped = applyTrustCap(raw, trust);
  return {
    key: input.key,
    label: input.label,
    score: capped,
    status: "scored",
    trustUsed: trust,
    note:
      capped >= 50
        ? `${input.label} alignment (${trust}): ${companyVals.slice(0, 2).join(", ")}.`
        : `Weak ${input.label.toLowerCase()} alignment.`,
  };
}

function scoreCountryDimension(
  profile: MatchingProfileSnapshot,
  opportunity: OpportunityMatchingSignals,
): MatchedDimensionResult {
  const oppCountries =
    opportunity.countries.length > 0
      ? opportunity.countries
      : opportunity.requiredCountry
        ? [opportunity.requiredCountry]
        : [];

  if (oppCountries.length === 0 && !opportunity.countryRequired) {
    return {
      key: "country",
      label: "Country",
      score: null,
      status: "not_applicable",
      trustUsed: "none",
      note: "Opportunity has no country signals.",
    };
  }

  const company = profileCountries(profile);
  if (company.length === 0) {
    return {
      key: "country",
      label: "Country",
      score: null,
      status: "unknown",
      trustUsed: "none",
      note: "Company country not provided — not treated as a match.",
    };
  }

  const targets =
    oppCountries.length > 0
      ? oppCountries
      : opportunity.requiredCountry
        ? [opportunity.requiredCountry]
        : [];

  return scoreListDimension({
    key: "country",
    label: "Country",
    company,
    opportunity: targets,
    emptyOppNote: "Opportunity has no country signals.",
    missingCompanyNote: "Company country not provided — not treated as a match.",
  });
}

/**
 * Geography coverage scoring — excludes country tokens already counted in country
 * dimension to prevent double-counting the same signal.
 */
function scoreGeographyDimension(
  profile: MatchingProfileSnapshot,
  opportunity: OpportunityMatchingSignals,
  countryDim: MatchedDimensionResult,
): MatchedDimensionResult {
  const countryTokens = new Set(
    [
      ...opportunity.countries,
      ...(opportunity.requiredCountry ? [opportunity.requiredCountry] : []),
      ...(profile.countries ?? []).map((c) => c.value),
    ].map(normalizeMatchingToken),
  );

  // When country already scored a strong match on the same token, strip those
  // tokens from geography opportunity side so they are not counted twice.
  const countryAlreadyMatched =
    countryDim.status === "scored" &&
    countryDim.score != null &&
    countryDim.score >= 50;

  const oppGeo = opportunity.geographies.filter((g) => {
    const n = normalizeMatchingToken(g);
    if (!n) return false;
    if (countryAlreadyMatched && countryTokens.has(n)) return false;
    return true;
  });

  // Company coverage: prefer non-country geographies; fall back to all geos
  // when no separate coverage exists (legacy snapshots).
  const coverageSignals =
    profile.countries && profile.countries.length > 0
      ? profile.geographies.filter(
          (g) => !countryTokens.has(normalizeMatchingToken(g.value)),
        )
      : profile.geographies;

  const companyForGeo =
    coverageSignals.length > 0 ? coverageSignals : profile.geographies;

  if (oppGeo.length === 0) {
    // If all opp geos were country tokens already scored, geography is N/A
    // (avoid double count). If opp had no geos at all, also N/A.
    return {
      key: "geography",
      label: "Geography",
      score: null,
      status: "not_applicable",
      trustUsed: "none",
      note:
        opportunity.geographies.length === 0
          ? "Opportunity has no geography signals."
          : "Geography covered by country dimension — not double-counted.",
    };
  }

  return scoreListDimension({
    key: "geography",
    label: "Geography",
    company: companyForGeo,
    opportunity: oppGeo,
    emptyOppNote: "Opportunity has no geography signals.",
    missingCompanyNote: "Company geography not provided — not treated as a match.",
    overlapFn: geographyHierarchyScore,
  });
}

function scoreQualifications(
  profile: MatchingProfileSnapshot,
  opportunity: OpportunityMatchingSignals,
): MatchedDimensionResult {
  const required =
    opportunity.mandatoryCertifications.length > 0
      ? opportunity.mandatoryCertifications
      : opportunity.certifications;

  if (required.length === 0) {
    return {
      key: "qualifications",
      label: "Qualifications",
      score: null,
      status: "not_applicable",
      trustUsed: "none",
      note: "Opportunity has no qualification signals.",
    };
  }

  const companyCerts = [...profile.certifications, ...profile.dcmCategories];
  if (companyCerts.length === 0) {
    return {
      key: "qualifications",
      label: "Qualifications",
      score: null,
      status: "unknown",
      trustUsed: "none",
      note: "Company qualifications not provided — not treated as a match.",
    };
  }

  const trust = bestTrust(companyCerts);
  const hard = valuesByTrust(companyCerts, false);
  const companyVals = hard.length > 0 ? hard : valuesByTrust(companyCerts, true);
  const cov = certificationCoverage(companyVals, required);
  const capped = applyTrustCap(cov.score, trust);

  const coverageNote =
    cov.coverage === "all"
      ? `All required certifications held (${cov.hitCount}/${cov.requiredCount}).`
      : cov.coverage === "partial"
        ? `Partial certifications (${cov.hitCount}/${cov.requiredCount}).`
        : `Missing required certifications (0/${cov.requiredCount}).`;

  return {
    key: "qualifications",
    label: "Qualifications",
    score: capped,
    status: "scored",
    trustUsed: trust,
    note: coverageNote,
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
  if (have >= required) raw = 92;
  else if (have >= required * 0.85) raw = 72;
  else if (have >= required * 0.6) raw = 48;
  else raw = 18;
  const capped = applyTrustCap(raw, trust);
  return {
    key: "experience",
    label: "Experience",
    score: capped,
    status: "scored",
    trustUsed: trust,
    note:
      have >= required
        ? `Experience meets requirement (${have}y ≥ ${required}y).`
        : `Experience below requirement (${have}y / ${required}y required).`,
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
  const a = normalizeSizeBand(profile.size.value);
  const b = normalizeSizeBand(opportunity.sizeBand);
  let raw = 0;
  if (a && b) {
    const dist = sizeBandDistance(a, b);
    if (dist === 0) raw = 95;
    else if (dist === 1) raw = 70;
    else if (dist === 2) raw = 40;
    else raw = 12;
  } else {
    const an = normalizeMatchingToken(profile.size.value);
    const bn = normalizeMatchingToken(opportunity.sizeBand);
    if (an === bn) raw = 90;
    else if (an.includes(bn) || bn.includes(an)) raw = 70;
    else if (tokens(an).some((t) => tokens(bn).includes(t))) raw = 50;
    else raw = 15;
  }
  const capped = applyTrustCap(raw, trust);
  return {
    key: "size",
    label: "Company size",
    score: capped,
    status: "scored",
    trustUsed: trust,
    note:
      capped >= 50
        ? `Size band compatible (${a ?? profile.size.value} ≈ ${b ?? opportunity.sizeBand}).`
        : `Size band mismatch (${a ?? profile.size.value} vs ${b ?? opportunity.sizeBand}).`,
  };
}

function countryMatches(
  companyCountries: string[],
  required: string,
): boolean {
  const rn = normalizeMatchingToken(required);
  if (!rn) return false;
  return companyCountries.some((c) => {
    const cn = normalizeMatchingToken(c);
    return cn === rn || cn.includes(rn) || rn.includes(cn);
  });
}

/**
 * Deterministic, explainable matcher.
 * Missing company data → unknown (never positive). Soft/VERIFY-tier → capped.
 * Mandatory country / certification gates cannot be overridden by AI.
 */
export function scoreCompanyOpportunityMatch(input: {
  profile: MatchingProfileSnapshot;
  opportunity: OpportunityMatchingSignals | Partial<OpportunityMatchingSignals> & {
    services?: string[];
    industries?: string[];
    geographies?: string[];
  };
}): MatchScoreResult {
  const { profile } = input;
  const opportunity: OpportunityMatchingSignals = {
    services: input.opportunity.services ?? [],
    industries: input.opportunity.industries ?? [],
    countries: input.opportunity.countries ?? [],
    geographies: input.opportunity.geographies ?? [],
    certifications: input.opportunity.certifications ?? [],
    requiredCountry: input.opportunity.requiredCountry ?? null,
    countryRequired: input.opportunity.countryRequired ?? false,
    mandatoryCertifications: input.opportunity.mandatoryCertifications ?? [],
    mandatoryServices: input.opportunity.mandatoryServices ?? [],
    sizeBand: input.opportunity.sizeBand ?? null,
    experienceYearsRequired: input.opportunity.experienceYearsRequired ?? null,
    category: input.opportunity.category ?? null,
    industry: input.opportunity.industry ?? null,
  };
  const gateFailures: string[] = [];

  const industries = [
    ...opportunity.industries,
    ...(opportunity.industry ? [opportunity.industry] : []),
  ];

  const countryDim = scoreCountryDimension(profile, opportunity);
  const geographyDim = scoreGeographyDimension(profile, opportunity, countryDim);
  const serviceDim = scoreServiceDimension(profile, opportunity);

  const dimensions: MatchedDimensionResult[] = [
    serviceDim,
    scoreListDimension({
      key: "industry",
      label: "Industry",
      company: profile.industries,
      opportunity: industries,
      emptyOppNote: "Opportunity has no industry signals.",
      missingCompanyNote: "Company industry not provided — not treated as a match.",
    }),
    countryDim,
    geographyDim,
    scoreQualifications(profile, opportunity),
    scoreExperience(profile, opportunity),
    scoreSize(profile, opportunity),
  ];

  // When only one of country/geography applies, give it the combined geographic
  // weight (0.18) so ME8C and legacy fixtures stay score-stable.
  const effectiveWeights: Record<MatchingDimensionKey, number> = {
    ...MATCHING_DIMENSION_WEIGHTS,
  };
  const countryActive = countryDim.status === "scored";
  const geoActive = geographyDim.status === "scored";
  if (countryActive && !geoActive) {
    effectiveWeights.country =
      MATCHING_DIMENSION_WEIGHTS.country + MATCHING_DIMENSION_WEIGHTS.geography;
  } else if (geoActive && !countryActive) {
    effectiveWeights.geography =
      MATCHING_DIMENSION_WEIGHTS.country + MATCHING_DIMENSION_WEIGHTS.geography;
  }

  let weightSum = 0;
  let weighted = 0;
  for (const d of dimensions) {
    if (d.status !== "scored" || d.score == null) continue;
    const w = effectiveWeights[d.key];
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
  const strongTrustCount = dimensions.filter(
    (d) => d.status === "scored" && d.trustUsed === "strong",
  ).length;
  // Evidence / data-quality signal folded into confidence (never invents fit).
  const evidenceBoost = Math.min(15, strongTrustCount * 5);
  const confidence =
    applicable === 0
      ? 0
      : Math.round(
          Math.min(
            100,
            (known / applicable) * 50 +
              (scoredHard.length / Math.max(1, applicable)) * 35 +
              evidenceBoost,
          ),
        );

  const matchedDimensions = dimensions.filter(
    (d) => d.status === "scored" && d.score != null && d.score >= 50,
  );
  const gapDimensions = dimensions.filter(
    (d) =>
      d.status === "unknown" ||
      (d.status === "scored" && d.score != null && d.score < 50),
  );

  const reasons = matchedDimensions.map((d) => d.note).slice(0, 6);

  /**
   * Hard capability: geography/size/experience alone never recommend.
   * Project-centric precision: when the opportunity lists services, the service
   * dimension itself must clear the hard floor — industry-only is not enough.
   */
  const CAPABILITY_KEYS: MatchingDimensionKey[] = [
    "service",
    "industry",
    "qualifications",
  ];
  const hardCapabilityMatch = scoredHard.some((d) =>
    CAPABILITY_KEYS.includes(d.key),
  );

  const oppHasServices =
    opportunity.services.length > 0 || Boolean(opportunity.category);
  const serviceHardPass =
    serviceDim.status === "scored" &&
    serviceDim.score != null &&
    serviceDim.score >= MATCHING_MIN_HARD_DIMENSION_SCORE &&
    (serviceDim.trustUsed === "strong" || serviceDim.trustUsed === "normal");

  // —— Hard gates (AI cannot override) ——
  if (opportunity.countryRequired || opportunity.requiredCountry) {
    const required =
      opportunity.requiredCountry ??
      opportunity.countries[0] ??
      null;
    if (required) {
      const companyCountryVals = profileCountries(profile).map((c) => c.value);
      if (companyCountryVals.length === 0) {
        gateFailures.push(
          `Mandatory country required (${required}) but company country unknown.`,
        );
      } else if (!countryMatches(companyCountryVals, required)) {
        gateFailures.push(
          `Mandatory country mismatch: opportunity requires ${required}.`,
        );
      }
    }
  }

  if (opportunity.mandatoryCertifications.length > 0) {
    const companyCerts = valuesByTrust(
      [...profile.certifications, ...profile.dcmCategories],
      true,
    );
    const cov = certificationCoverage(
      companyCerts,
      opportunity.mandatoryCertifications,
    );
    if (cov.coverage === "none" || cov.hitCount === 0) {
      gateFailures.push(
        `Mandatory certification missing: need ${opportunity.mandatoryCertifications.join(", ")}.`,
      );
    }
  }

  if (opportunity.mandatoryServices.length > 0) {
    const companyServices = valuesByTrust(profile.services, true);
    const cov = certificationCoverage(
      companyServices,
      opportunity.mandatoryServices,
    );
    // Reuse token overlap helper — treats capability strings like certs for coverage.
    if (cov.coverage === "none" || cov.hitCount === 0) {
      // Also accept semantic capability group hits
      const corpus = opportunity.mandatoryServices
        .map(normalizeMatchingToken)
        .join(" ");
      const semanticOk = companyServices.some((s) => {
        const group = CAPABILITY_GROUPS.find(
          (g) =>
            normalizeMatchingToken(g.normalized) === normalizeMatchingToken(s) ||
            capabilityMatchesText(g.normalized, s),
        );
        const normalized = group?.normalized ?? s;
        return capabilityMatchesText(normalized, corpus);
      });
      if (!semanticOk) {
        gateFailures.push(
          `Mandatory capability missing: need ${opportunity.mandatoryServices.join(", ")}.`,
        );
      }
    }
  }

  // Precision: listed project services require real service fit (not industry-only).
  if (oppHasServices && !serviceHardPass) {
    gateFailures.push(
      "Project capability/service fit insufficient — semantic keyword similarity alone is not enough.",
    );
  }

  const meetsRelevanceThreshold =
    score >= MATCHING_MIN_RELEVANCE_SCORE &&
    hardCapabilityMatch &&
    gateFailures.length === 0;

  const explanationParts: string[] = [];
  if (meetsRelevanceThreshold) {
    explanationParts.push(
      reasons[0] ?? "Partial alignment across available project dimensions.",
    );
    if (gapDimensions.length > 0) {
      explanationParts.push(
        `Gaps: ${gapDimensions
          .slice(0, 3)
          .map((d) => d.label.toLowerCase())
          .join(", ")}.`,
      );
    }
  } else if (gateFailures.length > 0) {
    explanationParts.push(gateFailures[0]!);
  } else {
    explanationParts.push("Insufficient project fit for a recommendation.");
  }

  return {
    score,
    confidence,
    dimensions,
    matchedDimensions,
    gapDimensions,
    reasons:
      meetsRelevanceThreshold || reasons.length > 0
        ? reasons
        : gateFailures.slice(0, 4),
    explanation: explanationParts.join(" "),
    meetsRelevanceThreshold,
    gateFailures,
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
    return parseExperienceYearsHint(opp.experienceHint);
  })();

  const rawGeos = [...(opp.geographies ?? [])];
  if (typeof fromJson.country === "string" && fromJson.country.trim()) {
    rawGeos.push(fromJson.country.trim());
  }
  if (Array.isArray(fromJson.countries)) {
    for (const c of fromJson.countries) {
      if (typeof c === "string" && c.trim()) rawGeos.push(c.trim());
    }
  }

  const requiredCountry =
    typeof fromJson.requiredCountry === "string" && fromJson.requiredCountry.trim()
      ? fromJson.requiredCountry.trim()
      : typeof fromJson.mandatoryCountry === "string" &&
          fromJson.mandatoryCountry.trim()
        ? fromJson.mandatoryCountry.trim()
        : null;

  const countryRequired =
    fromJson.countryRequired === true ||
    fromJson.mandatoryCountry === true ||
    Boolean(requiredCountry);

  // Explicit country list from metadata, else infer single-token geos as countries
  // only when countryRequired / requiredCountry is set.
  const explicitCountries: string[] = [];
  if (typeof fromJson.country === "string" && fromJson.country.trim()) {
    explicitCountries.push(fromJson.country.trim());
  }
  if (Array.isArray(fromJson.countries)) {
    for (const c of fromJson.countries) {
      if (typeof c === "string" && c.trim()) explicitCountries.push(c.trim());
    }
  }
  if (requiredCountry) explicitCountries.push(requiredCountry);

  const countries = [...new Set(explicitCountries.map((c) => c.trim()).filter(Boolean))];

  // Geography list excludes values already classified as countries to avoid double count.
  const countrySet = new Set(countries.map(normalizeMatchingToken));
  const geographies = (opp.geographies ?? []).filter((g) => {
    const n = normalizeMatchingToken(g);
    return n && !countrySet.has(n);
  });
  // If no separate countries were declared, keep geos as geography (legacy ME8C path).
  // Country dimension will be N/A unless countryRequired.
  const finalCountries =
    countries.length > 0
      ? countries
      : countryRequired && (opp.geographies?.length ?? 0) > 0
        ? [opp.geographies![0]!]
        : [];

  const finalGeographies =
    countries.length > 0
      ? geographies.length > 0
        ? geographies
        : // Keep original geos for hierarchy when they weren't only country duplicates
          (opp.geographies ?? []).filter(
            (g) => !countrySet.has(normalizeMatchingToken(g)),
          )
      : (opp.geographies ?? []);

  const mandatoryCertifications: string[] = [];
  if (Array.isArray(fromJson.mandatoryCertifications)) {
    for (const c of fromJson.mandatoryCertifications) {
      if (typeof c === "string" && c.trim()) mandatoryCertifications.push(c.trim());
    }
  }
  if (
    fromJson.certificationsRequired === true &&
    (opp.certifications?.length ?? 0) > 0
  ) {
    for (const c of opp.certifications ?? []) {
      if (c.trim()) mandatoryCertifications.push(c.trim());
    }
  }

  const mandatoryServices: string[] = [];
  if (Array.isArray(fromJson.mandatoryServices)) {
    for (const s of fromJson.mandatoryServices) {
      if (typeof s === "string" && s.trim()) mandatoryServices.push(s.trim());
    }
  }
  if (Array.isArray(fromJson.requiredCapabilities)) {
    for (const s of fromJson.requiredCapabilities) {
      if (typeof s === "string" && s.trim()) mandatoryServices.push(s.trim());
    }
  }
  if (
    fromJson.capabilitiesRequired === true &&
    (opp.services?.length ?? 0) > 0
  ) {
    for (const s of opp.services ?? []) {
      if (s.trim()) mandatoryServices.push(s.trim());
    }
  }

  const sizeRaw =
    typeof fromJson.sizeBand === "string" ? fromJson.sizeBand : opp.sizeBand;
  const sizeBand = normalizeSizeBand(sizeRaw) ?? sizeRaw ?? null;

  return {
    services: opp.services ?? [],
    industries: opp.industries ?? [],
    countries: finalCountries,
    geographies: finalGeographies,
    certifications: opp.certifications ?? [],
    requiredCountry,
    countryRequired,
    mandatoryCertifications: [...new Set(mandatoryCertifications)],
    mandatoryServices: [...new Set(mandatoryServices)],
    sizeBand,
    experienceYearsRequired,
    category: opp.category ?? null,
    industry: opp.industry ?? null,
  };
}
