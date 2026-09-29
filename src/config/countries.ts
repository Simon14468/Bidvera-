/**
 * Canonical ISO 3166-1 country dataset for Bidvera onboarding / profile / matching.
 * Stable identifiers are alpha-2 codes. Display names come from i18n.
 *
 * Scope: UN member states + Palestine (PS) + Holy See (VA) ≈ 195 countries.
 */

export type CountryCode = string;

export type CountryRecord = {
  /** ISO 3166-1 alpha-2 */
  code: string;
  /** ISO 3166-1 alpha-3 */
  alpha3: string;
};

/** UN members + PS + VA (alphabetical by English name is applied at display time). */
export const COMPANY_COUNTRY_CODES = [
  "AF", "AL", "DZ", "AD", "AO", "AG", "AR", "AM", "AU", "AT", "AZ", "BS", "BH",
  "BD", "BB", "BY", "BE", "BZ", "BJ", "BT", "BO", "BA", "BW", "BR", "BN", "BG",
  "BF", "BI", "CV", "KH", "CM", "CA", "CF", "TD", "CL", "CN", "CO", "KM", "CG",
  "CD", "CR", "CI", "HR", "CU", "CY", "CZ", "DK", "DJ", "DM", "DO", "EC", "EG",
  "SV", "GQ", "ER", "EE", "SZ", "ET", "FJ", "FI", "FR", "GA", "GM", "GE", "DE",
  "GH", "GR", "GD", "GT", "GN", "GW", "GY", "HT", "HN", "HU", "IS", "IN", "ID",
  "IR", "IQ", "IE", "IL", "IT", "JM", "JP", "JO", "KZ", "KE", "KI", "KP", "KR",
  "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI", "LT", "LU", "MG", "MW",
  "MY", "MV", "ML", "MT", "MH", "MR", "MU", "MX", "FM", "MD", "MC", "MN", "ME",
  "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NZ", "NI", "NE", "NG", "MK", "NO",
  "OM", "PK", "PW", "PA", "PG", "PY", "PE", "PH", "PL", "PT", "QA", "RO", "RU",
  "RW", "KN", "LC", "VC", "WS", "SM", "ST", "SA", "SN", "RS", "SC", "SL", "SG",
  "SK", "SI", "SB", "SO", "ZA", "SS", "ES", "LK", "SD", "SR", "SE", "CH", "SY",
  "TJ", "TZ", "TH", "TL", "TG", "TO", "TT", "TN", "TR", "TM", "TV", "UG", "UA",
  "AE", "GB", "US", "UY", "UZ", "VU", "VE", "VN", "YE", "ZM", "ZW", "PS", "VA",
] as const;

const COUNTRY_CODE_SET = new Set<string>(COMPANY_COUNTRY_CODES);

/** Previous short onboarding option labels → ISO alpha-2. */
const LEGACY_COUNTRY_NAME_TO_CODE: Record<string, string> = {
  Morocco: "MA",
  Algeria: "DZ",
  Tunisia: "TN",
  Egypt: "EG",
  "Saudi Arabia": "SA",
  "United Arab Emirates": "AE",
  Qatar: "QA",
  Kuwait: "KW",
  Bahrain: "BH",
  Oman: "OM",
  Jordan: "JO",
  Lebanon: "LB",
  "United Kingdom": "GB",
  France: "FR",
  Germany: "DE",
  Spain: "ES",
  Portugal: "PT",
  Italy: "IT",
  Netherlands: "NL",
  Belgium: "BE",
  Switzerland: "CH",
  "United States": "US",
  "United States of America": "US",
  Canada: "CA",
  Mexico: "MX",
  Brazil: "BR",
  India: "IN",
  China: "CN",
  "People's Republic of China": "CN",
  Japan: "JP",
  Singapore: "SG",
  Australia: "AU",
  "South Africa": "ZA",
  Nigeria: "NG",
  Kenya: "KE",
};

export function isCompanyCountryCode(value: string): boolean {
  return COUNTRY_CODE_SET.has(value.toUpperCase());
}

/**
 * Normalize a stored country string to an ISO alpha-2 code when possible.
 * Unknown free-text / "Other" values return null.
 */
export function resolveCountryCode(
  stored: string | null | undefined,
): string | null {
  if (!stored) return null;
  const trimmed = stored.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (isCompanyCountryCode(upper)) return upper;
  if (LEGACY_COUNTRY_NAME_TO_CODE[trimmed]) {
    return LEGACY_COUNTRY_NAME_TO_CODE[trimmed];
  }
  const lower = trimmed.toLowerCase();
  for (const [name, code] of Object.entries(LEGACY_COUNTRY_NAME_TO_CODE)) {
    if (name.toLowerCase() === lower) return code;
  }
  return null;
}

/**
 * @deprecated Prefer COMPANY_COUNTRY_CODES + i18n labels.
 * Kept for any legacy callers expecting English name strings.
 */
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
