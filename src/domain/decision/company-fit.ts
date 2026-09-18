import type { RuleCompanyProfile, RuleRequirement } from "./types";
import type { ConfidenceLevel, DecisionType } from "@prisma/client";
import { capabilityMatchesText, CAPABILITY_GROUPS } from "@/domain/company-knowledge/normalize";
import { weightedRequirementsScore } from "@/domain/tender-requirements";

export type FitDimensionKey =
  | "service"
  | "industry"
  | "experience"
  | "size"
  | "geography"
  | "requirements";

export type FitDimension = {
  key: FitDimensionKey;
  label: string;
  /** 0–100, or null when Unknown / not provided */
  score: number | null;
  status: "scored" | "unknown" | "not_applicable";
  note: string;
  /** Transparency: where the signal came from */
  basis: "confirmed_from_profile" | "confirmed_from_tender" | "unknown" | "ai_assessment";
};

export type CompanyTenderFitBreakdown = {
  /** When false, fit dimensions and overall must not be shown as scored percentages. */
  scoringAvailable?: boolean;
  /** True when only company knowledge was ingested — not a tender analysis. */
  companyKnowledgeOnly?: boolean;
  overall: number | null;
  dimensions: FitDimension[];
  matches: string[];
  gaps: string[];
  unknowns: string[];
  attention: string[];
  recommendation: string;
};

export type TenderFitContext = {
  title: string;
  client: string | null;
  country: string | null;
  industry: string | null;
  estimatedValue: number | null;
  /** Combined tender/requirement text for soft matching (untrusted). */
  tenderText: string;
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+ ]/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length > 2);
}

function overlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const hits = a.filter((t) => setB.has(t)).length;
  return Math.round((hits / a.length) * 100);
}

function experienceYearsFromLevel(level: string | null): number | null {
  if (!level) return null;
  switch (level) {
    case "new":
      return 1;
    case "some":
      return 3;
    case "experienced":
      return 7;
    case "highly_experienced":
      return 12;
    default:
      return null;
  }
}

function extractRequiredYears(text: string): number | null {
  const m = text.match(/(\d+)\s*\+?\s*years?/i);
  return m ? Number(m[1]) : null;
}

function requirementsScore(requirements: RuleRequirement[]): number {
  return weightedRequirementsScore(requirements);
}

/**
 * Deterministic company–tender fit. Never invents missing company data.
 * Missing profile fields → Unknown (not automatic negative) unless tender mandates them.
 */
export function computeCompanyTenderFit(input: {
  profile: RuleCompanyProfile;
  requirements: RuleRequirement[];
  context: TenderFitContext;
}): CompanyTenderFitBreakdown {
  const { profile, requirements, context } = input;
  const tenderBlob = normalize(
    [context.title, context.client ?? "", context.country ?? "", context.industry ?? "", context.tenderText].join(
      " ",
    ),
  );
  const reqText = normalize(
    requirements.map((r) => `${r.category} ${r.description} ${r.value ?? ""}`).join(" "),
  );
  const corpus = `${tenderBlob} ${reqText}`;

  const matches: string[] = [];
  const gaps: string[] = [];
  const unknowns: string[] = [];
  const attention: string[] = [];
  const dimensions: FitDimension[] = [];

  // —— Services ——
  if (profile.services.length === 0) {
    dimensions.push({
      key: "service",
      label: "Service Match",
      score: null,
      status: "unknown",
      note: "Not provided in company profile.",
      basis: "unknown",
    });
    unknowns.push("Main services / capabilities were not provided.");
  } else {
    const serviceTokens = profile.services.flatMap((s) => tokens(s));
    const corpusTokens = tokens(corpus);
    let score = Math.max(
      overlapScore(serviceTokens, corpusTokens),
      ...profile.services.map((s) => (corpus.includes(normalize(s)) ? 92 : 0)),
    );
    // Semantic capability groups (web/mobile/api/…) — avoid 0% when synonyms match
    const semanticHits = profile.services.filter((s) => {
      const group = CAPABILITY_GROUPS.find(
        (g) => normalize(g.normalized) === normalize(s) || capabilityMatchesText(g.normalized, s),
      );
      const normalized = group?.normalized ?? s;
      return capabilityMatchesText(normalized, corpus);
    }).length;
    if (semanticHits > 0) {
      const semanticScore = Math.min(96, 55 + semanticHits * 12);
      score = Math.max(score, semanticScore);
    }
    const clamped = Math.min(100, score);
    dimensions.push({
      key: "service",
      label: "Service Match",
      score: clamped,
      status: "scored",
      note:
        clamped >= 70
          ? "Listed services appear aligned with tender language (assessment)."
          : clamped >= 40
            ? "Partial overlap between listed services and tender wording (assessment)."
            : "Limited overlap between listed services and tender wording (assessment).",
      basis: "ai_assessment",
    });
    if (clamped >= 70) matches.push("Strong match with your listed services (based on profile + tender text).");
    else if (clamped < 40) gaps.push("Tender language shows limited overlap with your listed services.");
    else attention.push("Service alignment is partial — verify capability coverage before bidding.");
  }

  // —— Industry ——
  if (!profile.industry?.trim()) {
    dimensions.push({
      key: "industry",
      label: "Industry Match",
      score: null,
      status: "unknown",
      note: "Not provided in company profile.",
      basis: "unknown",
    });
    unknowns.push("Industry / sector was not provided.");
  } else {
    const ind = normalize(profile.industry);
    const tenderIndustry = context.industry ? normalize(context.industry) : "";
    let score = 55;
    let basis: FitDimension["basis"] = "ai_assessment";
    if (tenderIndustry && (tenderIndustry.includes(ind) || ind.includes(tenderIndustry))) {
      score = 95;
      basis = "confirmed_from_tender";
      matches.push("Industry alignment is strong (tender sector vs profile).");
    } else if (corpus.includes(ind) || ind.split(" ").some((w) => w.length > 3 && corpus.includes(w))) {
      score = 85;
      matches.push("Industry alignment looks favourable based on tender wording.");
    } else {
      score = 45;
      attention.push("Industry alignment is unclear — confirm sector fit manually.");
    }
    dimensions.push({
      key: "industry",
      label: "Industry Match",
      score,
      status: "scored",
      note: `Profile industry: ${profile.industry}.`,
      basis,
    });
  }

  // —— Experience ——
  const years =
    profile.experienceYears ?? experienceYearsFromLevel(profile.experienceLevel);
  const requiredYears = extractRequiredYears(corpus);
  if (years == null && !requiredYears) {
    dimensions.push({
      key: "experience",
      label: "Experience Match",
      score: null,
      status: "unknown",
      note: "Experience not provided; tender does not state a clear years requirement.",
      basis: "unknown",
    });
    unknowns.push("Experience level was not provided.");
  } else if (years == null && requiredYears) {
    dimensions.push({
      key: "experience",
      label: "Experience Match",
      score: null,
      status: "unknown",
      note: `Tender references ~${requiredYears}+ years; profile experience not provided.`,
      basis: "unknown",
    });
    unknowns.push("Experience requirement appears in the tender but is not set on your profile.");
    attention.push("Experience requirement was not fully provided in your profile — verification needed.");
  } else if (years != null && requiredYears != null) {
    const score =
      years >= requiredYears ? 90 : years >= requiredYears * 0.7 ? 55 : 25;
    dimensions.push({
      key: "experience",
      label: "Experience Match",
      score,
      status: "scored",
      note: `Profile indicates ~${years} years (or level equivalent); tender cites ~${requiredYears}+.`,
      basis: "confirmed_from_profile",
    });
    if (score >= 80) matches.push("Experience alignment looks suitable based on available profile data.");
    else if (score < 40) gaps.push("Required experience appears significantly above the available experience level.");
    else attention.push("Experience may be borderline — verify before submission.");
  } else {
    // years set, no explicit tender years
    dimensions.push({
      key: "experience",
      label: "Experience Match",
      score: 75,
      status: "scored",
      note: "Experience is on profile; no explicit years threshold detected in tender text.",
      basis: "confirmed_from_profile",
    });
    matches.push("Experience is recorded on your profile (no hard years threshold detected).");
  }

  // —— Size ——
  if (!profile.companySize?.trim()) {
    dimensions.push({
      key: "size",
      label: "Size Fit",
      score: null,
      status: "unknown",
      note: "Company size not provided.",
      basis: "unknown",
    });
    unknowns.push("Company size was not provided.");
  } else {
    const size = normalize(profile.companySize);
    let score = 70;
    if (/\b(sme|small.?medium|micro.?enterprise)\b/.test(corpus)) {
      score = size === "solo" || size === "small" || size === "medium" ? 88 : 50;
    } else if (/\b(large.?contractor|enterprise.?only|tier\s*1)\b/.test(corpus)) {
      score = size === "enterprise" || size === "medium" ? 85 : 40;
    }
    dimensions.push({
      key: "size",
      label: "Size Fit",
      score,
      status: "scored",
      note: `Company size on profile: ${profile.companySize}.`,
      basis: "ai_assessment",
    });
    if (score >= 75) matches.push("Company size appears suitable for this opportunity (assessment).");
    else if (score < 45) gaps.push("Company size may not suit how the tender describes supplier scale.");
    else attention.push("Confirm company size suitability against tender eligibility.");
  }

  // —— Geography ——
  const profileGeo = [
    ...(profile.country ? [profile.country] : []),
    ...profile.geographicCoverage,
  ];
  if (profileGeo.length === 0) {
    dimensions.push({
      key: "geography",
      label: "Geographic Fit",
      score: null,
      status: "unknown",
      note: "Country / coverage not provided.",
      basis: "unknown",
    });
    unknowns.push("Country / business location was not provided.");
  } else {
    const tenderCountry = context.country ? normalize(context.country) : "";
    const hit = profileGeo.some((g) => {
      const ng = normalize(g);
      return (
        (tenderCountry && (tenderCountry.includes(ng) || ng.includes(tenderCountry))) ||
        corpus.includes(ng)
      );
    });
    const score = hit ? 90 : tenderCountry || /\b(country|nation|located in|within)\b/.test(corpus) ? 40 : 65;
    dimensions.push({
      key: "geography",
      label: "Geographic Fit",
      score,
      status: "scored",
      note: hit
        ? "Profile location appears compatible with tender geography."
        : "Geographic eligibility needs verification against tender wording.",
      basis: hit ? "confirmed_from_tender" : "ai_assessment",
    });
    if (hit) matches.push("Geographic signals look compatible with your profile location.");
    else if (score < 50) gaps.push("Geographic eligibility may not match your company location.");
    else attention.push("Confirm geographic eligibility if the tender restricts location.");
  }

  // —— Requirements aggregate ——
  const reqScore = requirementsScore(requirements);
  const failed = requirements.filter((r) => r.status === "FAILED");
  const uncertain = requirements.filter((r) => r.status === "UNCERTAIN" || r.status === "MISSING");
  dimensions.push({
    key: "requirements",
    label: "Requirements",
    score: reqScore,
    status: "scored",
    note: `${requirements.filter((r) => r.status === "MATCHED").length} matched · ${failed.length} failed · ${uncertain.length} uncertain/missing`,
    basis: "confirmed_from_tender",
  });
  if (failed.length) gaps.push("One or more mandatory requirements failed profile checks.");
  if (uncertain.length) attention.push("Some requirements need verification (uncertain / not fully evidenced).");

  const scored = dimensions.filter((d) => d.status === "scored" && d.score != null);
  const overall =
    scored.length === 0
      ? 50
      : Math.round(scored.reduce((a, d) => a + (d.score as number), 0) / scored.length);

  let recommendation =
    "Bidvera recommends a careful human review before committing bid effort.";
  if (failed.some((r) => r.mandatory) || overall < 35) {
    recommendation =
      "Based on the information provided, Bidvera recommends treating this as a likely NO-BID or deep review — critical gaps appear present.";
  } else if (overall >= 75 && uncertain.length === 0 && failed.length === 0) {
    recommendation = "Proceed to a detailed review before submission.";
  } else if (overall >= 55) {
    recommendation = "Proceed to a detailed review before submission.";
  }

  return {
    overall: Math.max(0, Math.min(100, overall)),
    dimensions,
    matches,
    gaps,
    unknowns,
    attention,
    recommendation,
  };
}

export function suggestDecisionFromFit(input: {
  fit: CompanyTenderFitBreakdown;
  hardNoBid: boolean;
  forcedReview: boolean;
}): { decision: DecisionType; confidence: ConfidenceLevel } {
  if (input.hardNoBid) return { decision: "NO_BID", confidence: "HIGH" };
  if (input.forcedReview) return { decision: "REVIEW", confidence: "MEDIUM" };

  const { overall, gaps, unknowns, attention } = input.fit;
  if (overall == null) return { decision: "REVIEW", confidence: "LOW" };
  if (overall < 40 && gaps.length > 0) {
    return { decision: "REVIEW", confidence: "LOW" };
  }
  if (overall >= 72 && gaps.length === 0 && attention.length <= 1) {
    return {
      decision: unknowns.length > 2 ? "REVIEW" : "BID",
      confidence: unknowns.length > 0 ? "MEDIUM" : "HIGH",
    };
  }
  if (overall >= 55) return { decision: "REVIEW", confidence: "MEDIUM" };
  return { decision: "REVIEW", confidence: "LOW" };
}

export function formatFitReasoning(input: {
  decision: DecisionType;
  fit: CompanyTenderFitBreakdown;
  profileSparse: boolean;
}): string {
  const { decision, fit, profileSparse } = input;
  const lines: string[] = [];
  lines.push(
    `Bidvera recommends ${decision === "BID" ? "GO" : decision === "REVIEW" ? "CONDITIONAL GO" : "NO-BID"} — ${
      fit.scoringAvailable === false || fit.overall == null
        ? "Company–Tender Fit: UNAVAILABLE (tender requirement extraction did not complete)."
        : `${fit.overall}% company–tender fit (based on the information provided).`
    }`,
  );
  if (profileSparse) {
    lines.push(
      "Note: Your company profile is incomplete, so several dimensions are Unknown rather than negative.",
    );
  }
  if (fit.matches.length) {
    lines.push("Why (matches):");
    for (const m of fit.matches.slice(0, 4)) lines.push(`• ${m}`);
  }
  if (fit.gaps.length) {
    lines.push("Why (gaps):");
    for (const g of fit.gaps.slice(0, 4)) lines.push(`• ${g}`);
  }
  if (fit.attention.length) {
    lines.push("Attention / requires verification:");
    for (const a of fit.attention.slice(0, 4)) lines.push(`• ${a}`);
  }
  if (fit.unknowns.length) {
    lines.push("Unknown / not provided:");
    for (const u of fit.unknowns.slice(0, 4)) lines.push(`• ${u}`);
  }
  lines.push(`Recommendation: ${fit.recommendation}`);
  return lines.join("\n");
}

export function isProfileSparse(profile: RuleCompanyProfile): boolean {
  return (
    !profile.industry &&
    profile.services.length === 0 &&
    !profile.companySize &&
    !profile.country &&
    !profile.experienceLevel &&
    profile.experienceYears == null
  );
}
