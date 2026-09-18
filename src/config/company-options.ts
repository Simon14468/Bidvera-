/** Non-sensitive business options for Company Setup / Profile. */

export const COMPANY_SIZE_OPTIONS = [
  { value: "Solo", label: "Solo" },
  { value: "Small", label: "Small" },
  { value: "Medium", label: "Medium" },
  { value: "Enterprise", label: "Enterprise" },
] as const;

export const EXPERIENCE_LEVEL_OPTIONS = [
  { value: "new", label: "New / Limited experience" },
  { value: "some", label: "Some experience" },
  { value: "experienced", label: "Experienced" },
  { value: "highly_experienced", label: "Highly experienced" },
] as const;

export const INDUSTRY_OPTIONS = [
  "Information Technology",
  "Software & SaaS",
  "Construction & Engineering",
  "Consulting & Professional Services",
  "Security & Facilities",
  "Healthcare",
  "Education",
  "Energy & Utilities",
  "Manufacturing",
  "Logistics & Transportation",
  "Marketing & Creative",
  "Finance & Insurance",
  "Government & Public Sector",
  "Agriculture",
  "Telecommunications",
  "Other",
] as const;

/** Common country names for business location (not a precise address). */
export const COUNTRY_OPTIONS = [
  "Morocco",
  "Algeria",
  "Tunisia",
  "Egypt",
  "Saudi Arabia",
  "United Arab Emirates",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Oman",
  "Jordan",
  "Lebanon",
  "United Kingdom",
  "France",
  "Germany",
  "Spain",
  "Portugal",
  "Italy",
  "Netherlands",
  "Belgium",
  "Switzerland",
  "United States",
  "Canada",
  "Mexico",
  "Brazil",
  "India",
  "China",
  "Japan",
  "Singapore",
  "Australia",
  "South Africa",
  "Nigeria",
  "Kenya",
  "Other",
] as const;
