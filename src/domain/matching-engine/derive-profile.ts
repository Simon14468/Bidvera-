import type {
  MatchingProfileSnapshot,
  MatchingSignal,
  MatchingTrustTier,
} from "./types";
import {
  computeMatchingCompleteness,
  hashMatchingSnapshot,
  isMatchingProfileEligible,
  countTrustSummary,
} from "./normalize";

export type MatchingProfileSourceInput = {
  company: {
    country: string | null;
    companySize: string | null;
  };
  profile: {
    industry: string | null;
    country: string | null;
    companySize: string | null;
    experienceLevel: string | null;
    services: string[];
    certifications: string[];
    experienceYears: number | null;
    geographicCoverage: string[];
    employeeRange: string | null;
  } | null;
  sq: {
    country: string | null;
    businessSectors: string[];
    servicesProducts: string[];
    certifications: string[];
    geographicCoverage: string[];
    employeeCount: number | null;
    yearEstablished: number | null;
  } | null;
  /** Verified SQ evidence titles/kinds only. */
  verifiedEvidence: Array<{ title: string; kind: string }>;
  /** DCM docs that are VALID / EXPIRING_SOON / NO_EXPIRY — strong category signals. */
  dcmValidCategories: Array<{ key: string; label: string }>;
  /** APPROVED / EDITED questionnaire answer snippets — soft structured hints only. */
  approvedQuestionnaireHints: string[];
  /** Soft historical outcome tags (e.g. won industry) — never strong. */
  softOutcomeHints?: string[];
};

function pushUnique(
  list: MatchingSignal[],
  value: string | null | undefined,
  trust: MatchingTrustTier,
  source: string,
) {
  const v = (value ?? "").trim();
  if (!v) return;
  const existing = list.find(
    (s) => s.value.toLowerCase() === v.toLowerCase(),
  );
  if (!existing) {
    list.push({ value: v, trust, source });
    return;
  }
  const rank: Record<MatchingTrustTier, number> = {
    soft: 1,
    normal: 2,
    strong: 3,
  };
  if (rank[trust] > rank[existing.trust]) {
    existing.trust = trust;
    existing.source = source;
  }
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

function sizeFromEmployeeCount(n: number | null): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (n <= 10) return "1-10";
  if (n <= 50) return "11-50";
  if (n <= 200) return "51-200";
  if (n <= 1000) return "201-1000";
  return "1000+";
}

/**
 * Derive a matching profile snapshot from existing Bidvera sources of truth.
 * Never fabricates signals. VERIFY / unverified → soft only.
 */
export function deriveMatchingProfileSnapshot(
  input: MatchingProfileSourceInput,
): MatchingProfileSnapshot {
  const services: MatchingSignal[] = [];
  const industries: MatchingSignal[] = [];
  const geographies: MatchingSignal[] = [];
  const certifications: MatchingSignal[] = [];
  const dcmCategories: MatchingSignal[] = [];
  const softNotes: string[] = [];

  const profile = input.profile;

  if (profile) {
    for (const s of profile.services) {
      pushUnique(services, s, "normal", "company_profile.services");
    }
    pushUnique(industries, profile.industry, "normal", "company_profile.industry");
    for (const g of profile.geographicCoverage) {
      pushUnique(geographies, g, "normal", "company_profile.geographicCoverage");
    }
    pushUnique(geographies, profile.country, "normal", "company_profile.country");
    for (const c of profile.certifications) {
      pushUnique(certifications, c, "normal", "company_profile.certifications");
    }
  }

  pushUnique(geographies, input.company.country, "normal", "company.country");

  if (input.sq) {
    for (const s of input.sq.servicesProducts) {
      pushUnique(services, s, "normal", "sq.servicesProducts");
    }
    for (const s of input.sq.businessSectors) {
      pushUnique(industries, s, "normal", "sq.businessSectors");
    }
    for (const g of input.sq.geographicCoverage) {
      pushUnique(geographies, g, "normal", "sq.geographicCoverage");
    }
    pushUnique(geographies, input.sq.country, "normal", "sq.country");
    for (const c of input.sq.certifications) {
      pushUnique(certifications, c, "normal", "sq.certifications");
    }
  }

  for (const ev of input.verifiedEvidence) {
    pushUnique(
      certifications,
      ev.title || ev.kind,
      "strong",
      "sq.evidence.verified",
    );
  }

  for (const cat of input.dcmValidCategories) {
    pushUnique(dcmCategories, cat.label || cat.key, "strong", "dcm.valid");
    pushUnique(certifications, cat.label || cat.key, "strong", "dcm.valid");
  }

  for (const hint of input.approvedQuestionnaireHints) {
    const cleaned = hint.trim().slice(0, 120);
    if (!cleaned) continue;
    // Approved/edited answers are company-confirmed text — treat as soft structured
    // capability hints, never as verified evidence.
    pushUnique(services, cleaned, "soft", "questionnaire.approved");
    softNotes.push(`Questionnaire hint: ${cleaned}`);
  }

  for (const hint of input.softOutcomeHints ?? []) {
    const cleaned = hint.trim().slice(0, 80);
    if (!cleaned) continue;
    pushUnique(industries, cleaned, "soft", "outcomes.soft");
    softNotes.push(`Historical outcome hint: ${cleaned}`);
  }

  let size: MatchingSignal | null = null;
  const sizeValue =
    profile?.companySize ??
    profile?.employeeRange ??
    input.company.companySize ??
    sizeFromEmployeeCount(input.sq?.employeeCount ?? null);
  if (sizeValue) {
    size = {
      value: sizeValue,
      trust: profile?.companySize || profile?.employeeRange ? "normal" : "normal",
      source: profile?.companySize
        ? "company_profile.companySize"
        : profile?.employeeRange
          ? "company_profile.employeeRange"
          : input.sq?.employeeCount != null
            ? "sq.employeeCount"
            : "company.companySize",
    };
  }

  let experienceYears: MatchingProfileSnapshot["experienceYears"] = null;
  if (profile?.experienceYears != null) {
    experienceYears = {
      value: profile.experienceYears,
      trust: "normal",
      source: "company_profile.experienceYears",
    };
  } else {
    const fromLevel = experienceYearsFromLevel(profile?.experienceLevel ?? null);
    if (fromLevel != null) {
      experienceYears = {
        value: fromLevel,
        trust: "normal",
        source: "company_profile.experienceLevel",
      };
    } else if (input.sq?.yearEstablished != null) {
      const years = Math.max(0, new Date().getFullYear() - input.sq.yearEstablished);
      experienceYears = {
        value: years,
        trust: "soft",
        source: "sq.yearEstablished",
      };
    }
  }

  return {
    services,
    industries,
    geographies,
    certifications,
    size,
    experienceYears,
    dcmCategories,
    softNotes,
  };
}

export function buildMatchingProfileRecord(snapshot: MatchingProfileSnapshot) {
  return {
    snapshotJson: snapshot,
    eligible: isMatchingProfileEligible(snapshot),
    completeness: computeMatchingCompleteness(snapshot),
    contentHash: hashMatchingSnapshot(snapshot),
    trustSummary: countTrustSummary(snapshot),
  };
}
