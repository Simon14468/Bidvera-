/**
 * High-level company Industry / Sector taxonomy for onboarding and matching.
 * Stored values are stable slugs; UI labels come from i18n.
 */

export const COMPANY_INDUSTRY_IDS = [
  "information_technology",
  "software_saas",
  "telecommunications",
  "cybersecurity",
  "construction_engineering",
  "architecture_design",
  "manufacturing",
  "automotive",
  "logistics_transportation",
  "energy_utilities",
  "oil_gas_mining",
  "environmental_services",
  "healthcare",
  "pharmaceuticals_biotechnology",
  "agriculture_agribusiness",
  "food_beverage",
  "retail_ecommerce",
  "real_estate_property",
  "hospitality_tourism",
  "finance_banking",
  "insurance",
  "consulting_professional_services",
  "legal_services",
  "marketing_advertising",
  "media_entertainment",
  "education_training",
  "security_facilities_management",
  "government_public_sector",
  "nonprofit_ngos",
  "wholesale_distribution",
  "consumer_goods",
  "utilities_infrastructure",
  "scientific_research_services",
] as const;

export type CompanyIndustryId = (typeof COMPANY_INDUSTRY_IDS)[number];

const INDUSTRY_ID_SET = new Set<string>(COMPANY_INDUSTRY_IDS);

/** Previous onboarding option labels → current stable slugs. */
const LEGACY_INDUSTRY_LABEL_TO_ID: Record<string, CompanyIndustryId> = {
  "Information Technology": "information_technology",
  "Software & SaaS": "software_saas",
  "Construction & Engineering": "construction_engineering",
  "Consulting & Professional Services": "consulting_professional_services",
  "Security & Facilities": "security_facilities_management",
  Healthcare: "healthcare",
  Education: "education_training",
  "Energy & Utilities": "energy_utilities",
  Manufacturing: "manufacturing",
  "Logistics & Transportation": "logistics_transportation",
  "Marketing & Creative": "marketing_advertising",
  "Finance & Insurance": "finance_banking",
  "Government & Public Sector": "government_public_sector",
  Agriculture: "agriculture_agribusiness",
  Telecommunications: "telecommunications",
};

export function isCompanyIndustryId(value: string): value is CompanyIndustryId {
  return INDUSTRY_ID_SET.has(value);
}

/**
 * Normalize a stored industry string to a taxonomy id when possible.
 * Unknown custom / "Other" free-text values are returned as null.
 */
export function resolveCompanyIndustryId(
  stored: string | null | undefined,
): CompanyIndustryId | null {
  if (!stored) return null;
  const trimmed = stored.trim();
  if (!trimmed) return null;
  if (isCompanyIndustryId(trimmed)) return trimmed;
  const fromLegacy = LEGACY_INDUSTRY_LABEL_TO_ID[trimmed];
  if (fromLegacy) return fromLegacy;
  // Case-insensitive legacy match
  const lower = trimmed.toLowerCase();
  for (const [label, id] of Object.entries(LEGACY_INDUSTRY_LABEL_TO_ID)) {
    if (label.toLowerCase() === lower) return id;
  }
  return null;
}

/**
 * @deprecated Prefer COMPANY_INDUSTRY_IDS + i18n labels.
 * Kept as English display names for any legacy callers expecting string options.
 */
export const INDUSTRY_OPTIONS = [
  "Information Technology",
  "Software & SaaS",
  "Telecommunications",
  "Cybersecurity",
  "Construction & Engineering",
  "Architecture & Design",
  "Manufacturing",
  "Automotive",
  "Logistics & Transportation",
  "Energy & Utilities",
  "Oil, Gas & Mining",
  "Environmental Services",
  "Healthcare",
  "Pharmaceuticals & Biotechnology",
  "Agriculture & Agribusiness",
  "Food & Beverage",
  "Retail & E-commerce",
  "Real Estate & Property",
  "Hospitality & Tourism",
  "Finance & Banking",
  "Insurance",
  "Consulting & Professional Services",
  "Legal Services",
  "Marketing & Advertising",
  "Media & Entertainment",
  "Education & Training",
  "Security & Facilities Management",
  "Government & Public Sector",
  "Nonprofit & NGOs",
  "Wholesale & Distribution",
  "Consumer Goods",
  "Utilities & Infrastructure",
  "Scientific & Research Services",
] as const;
