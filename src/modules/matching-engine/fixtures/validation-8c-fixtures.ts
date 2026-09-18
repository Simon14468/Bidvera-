/**
 * Feature 8C — isolated validation fixtures only.
 * Prefixed for safe create/cleanup. Never used as product seed defaults.
 */

import type { MatchingProfileSourceInput } from "@/domain/matching-engine";

export const ME8C_SOURCE = "ME8C_VALIDATION" as const;
export const ME8C_SLUG_PREFIX = "me8c-validation-" as const;

export type Me8cCompanyKey = "A" | "B" | "C" | "D" | "E" | "F";
export type Me8cOpportunityKey =
  | "O1"
  | "O2"
  | "O3"
  | "O4"
  | "O5"
  | "O6"
  | "O7"
  | "O8";

export type Me8cCompanyFixture = {
  key: Me8cCompanyKey;
  name: string;
  slug: string;
  sourceInput: MatchingProfileSourceInput;
};

export type Me8cOpportunityFixture = {
  key: Me8cOpportunityKey;
  externalRef: string;
  title: string;
  summary: string;
  category: string;
  industry: string;
  services: string[];
  industries: string[];
  geographies: string[];
  certifications: string[];
  sizeBand: string;
  experienceHint: string;
  sponsored?: boolean;
};

function companyFixture(
  key: Me8cCompanyKey,
  name: string,
  input: {
    services: string[];
    industry: string;
    size: string;
    geography: string;
  },
): Me8cCompanyFixture {
  return {
    key,
    name,
    slug: `${ME8C_SLUG_PREFIX}${key.toLowerCase()}`,
    sourceInput: {
      company: {
        country: input.geography,
        companySize: input.size,
      },
      profile: {
        industry: input.industry,
        country: input.geography,
        companySize: input.size,
        experienceLevel: "experienced",
        services: input.services,
        certifications: [],
        experienceYears: 8,
        geographicCoverage: [input.geography],
        employeeRange: null,
      },
      sq: null,
      verifiedEvidence: [],
      dcmValidCategories: [],
      approvedQuestionnaireHints: [],
    },
  };
}

export const ME8C_COMPANIES: Me8cCompanyFixture[] = [
  companyFixture("A", "ME8C Enterprise IT", {
    services: ["Cloud", "Cybersecurity", "Infrastructure"],
    industry: "Technology",
    size: "Large",
    geography: "Morocco",
  }),
  companyFixture("B", "ME8C Construction", {
    services: ["Building", "HVAC", "Construction"],
    industry: "Construction",
    size: "Medium",
    geography: "Morocco",
  }),
  companyFixture("C", "ME8C Digital Marketing", {
    services: ["Digital Marketing", "SEO", "Social Media"],
    industry: "Marketing",
    size: "Small",
    geography: "Morocco",
  }),
  companyFixture("D", "ME8C Solar", {
    services: ["Solar Installation", "Renewable Energy"],
    industry: "Energy",
    size: "Medium",
    geography: "Morocco",
  }),
  companyFixture("E", "ME8C Web Development", {
    services: ["Web Development", "E-commerce"],
    industry: "Technology",
    size: "Small",
    geography: "France",
  }),
  companyFixture("F", "ME8C Cleaning", {
    services: ["Commercial Cleaning", "Facility Services"],
    industry: "Facilities",
    size: "Medium",
    geography: "Morocco",
  }),
];

export const ME8C_OPPORTUNITIES: Me8cOpportunityFixture[] = [
  {
    key: "O1",
    externalRef: `${ME8C_SLUG_PREFIX}o1`,
    title: "Cybersecurity Services — Morocco",
    summary: "Public-style RFP for cybersecurity advisory and managed security.",
    category: "Cybersecurity",
    industry: "Technology",
    services: ["Cybersecurity", "Infrastructure"],
    industries: ["Technology"],
    geographies: ["Morocco"],
    certifications: [],
    sizeBand: "Large",
    experienceHint: "5 years",
  },
  {
    key: "O2",
    externalRef: `${ME8C_SLUG_PREFIX}o2`,
    title: "Building & HVAC Works — Morocco",
    summary: "Construction and HVAC works package.",
    category: "Construction",
    industry: "Construction",
    services: ["Building", "HVAC", "Construction"],
    industries: ["Construction"],
    geographies: ["Morocco"],
    certifications: [],
    sizeBand: "Medium",
    experienceHint: "5 years",
  },
  {
    key: "O3",
    externalRef: `${ME8C_SLUG_PREFIX}o3`,
    title: "Digital Marketing Services — Morocco",
    summary: "Digital marketing, SEO, and social campaigns.",
    category: "Marketing",
    industry: "Marketing",
    services: ["Digital Marketing", "SEO", "Social Media"],
    industries: ["Marketing"],
    geographies: ["Morocco"],
    certifications: [],
    sizeBand: "Small",
    experienceHint: "3 years",
  },
  {
    key: "O4",
    externalRef: `${ME8C_SLUG_PREFIX}o4`,
    title: "Solar Installation Project — Morocco",
    summary: "Solar installation and renewable energy delivery.",
    category: "Energy",
    industry: "Energy",
    services: ["Solar Installation", "Renewable Energy"],
    industries: ["Energy"],
    geographies: ["Morocco"],
    certifications: [],
    sizeBand: "Medium",
    experienceHint: "5 years",
  },
  {
    key: "O5",
    externalRef: `${ME8C_SLUG_PREFIX}o5`,
    title: "Web Development & E-commerce — France",
    summary: "Web development and e-commerce delivery in France.",
    category: "Web",
    industry: "Technology",
    services: ["Web Development", "E-commerce"],
    industries: ["Technology"],
    geographies: ["France"],
    certifications: [],
    sizeBand: "Small",
    experienceHint: "3 years",
  },
  {
    key: "O6",
    externalRef: `${ME8C_SLUG_PREFIX}o6`,
    title: "Commercial Cleaning Services — Morocco",
    summary: "Commercial cleaning and facility services.",
    category: "Facilities",
    industry: "Facilities",
    services: ["Commercial Cleaning", "Facility Services"],
    industries: ["Facilities"],
    geographies: ["Morocco"],
    certifications: [],
    sizeBand: "Medium",
    experienceHint: "5 years",
  },
  {
    key: "O7",
    externalRef: `${ME8C_SLUG_PREFIX}o7`,
    title: "Agricultural Equipment Supply — Morocco",
    summary: "Supply of agricultural machinery and farm equipment.",
    category: "Agriculture",
    industry: "Agriculture",
    services: ["Agricultural Equipment", "Farm Machinery Supply"],
    industries: ["Agriculture"],
    geographies: ["Morocco"],
    certifications: [],
    sizeBand: "Medium",
    experienceHint: "5 years",
  },
  {
    key: "O8",
    externalRef: `${ME8C_SLUG_PREFIX}o8`,
    title: "Cybersecurity Services — France",
    summary: "Cybersecurity services scoped to France.",
    category: "Cybersecurity",
    industry: "Technology",
    services: ["Cybersecurity", "Infrastructure"],
    industries: ["Technology"],
    geographies: ["France"],
    certifications: [],
    sizeBand: "Large",
    experienceHint: "5 years",
  },
];

/** Qualitative expectations for the primary match matrix. */
export type Me8cExpectation =
  | "strong"
  | "partial"
  | "irrelevant"
  | "no_recommendation";

export const ME8C_EXPECTED_MATRIX: Array<{
  company: Me8cCompanyKey;
  opportunity: Me8cOpportunityKey;
  expected: Me8cExpectation;
}> = [
  { company: "A", opportunity: "O1", expected: "strong" },
  { company: "A", opportunity: "O8", expected: "partial" },
  { company: "A", opportunity: "O7", expected: "irrelevant" },
  { company: "B", opportunity: "O2", expected: "strong" },
  { company: "C", opportunity: "O3", expected: "strong" },
  { company: "D", opportunity: "O4", expected: "strong" },
  { company: "E", opportunity: "O5", expected: "strong" },
  { company: "F", opportunity: "O6", expected: "strong" },
  { company: "A", opportunity: "O7", expected: "no_recommendation" },
  { company: "B", opportunity: "O7", expected: "no_recommendation" },
  { company: "C", opportunity: "O7", expected: "no_recommendation" },
  { company: "D", opportunity: "O7", expected: "no_recommendation" },
  { company: "E", opportunity: "O7", expected: "no_recommendation" },
  { company: "F", opportunity: "O7", expected: "no_recommendation" },
];

export function classifyMatchResult(input: {
  score: number;
  meetsRelevanceThreshold: boolean;
  dimensions: Array<{ key: string; score: number | null; status: string }>;
}): "strong" | "partial" | "irrelevant" {
  if (!input.meetsRelevanceThreshold) return "irrelevant";
  const geo = input.dimensions.find((d) => d.key === "geography");
  const service = input.dimensions.find((d) => d.key === "service");
  const geoStrong =
    geo?.status === "scored" && geo.score != null && geo.score >= 50;
  const serviceStrong =
    service?.status === "scored" && service.score != null && service.score >= 50;
  if (input.score >= 70 && serviceStrong && geoStrong) return "strong";
  if (input.score >= 55 && serviceStrong && geoStrong) return "strong";
  if (serviceStrong && !geoStrong) return "partial";
  if (input.score >= 55) return "partial";
  return "partial";
}
