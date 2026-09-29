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

export {
  COMPANY_INDUSTRY_IDS,
  INDUSTRY_OPTIONS,
  isCompanyIndustryId,
  resolveCompanyIndustryId,
  type CompanyIndustryId,
} from "@/config/company-industries";

export {
  COMPANY_COUNTRY_CODES,
  COUNTRY_OPTIONS,
  isCompanyCountryCode,
  resolveCountryCode,
} from "@/config/countries";

