/**
 * CPV → coarse Bidvera service/category labels.
 * Uses only explicit CPV codes from TED — never invents certifications.
 * Division labels follow the official CPV (Common Procurement Vocabulary) structure.
 */

/** Two-digit CPV division → human label (explicit taxonomy, not free-text inference). */
export const CPV_DIVISION_LABELS: Record<string, string> = {
  "03": "Agricultural products",
  "09": "Petroleum and fuels",
  "14": "Mining and minerals",
  "15": "Food and beverages",
  "16": "Agricultural machinery",
  "18": "Clothing and accessories",
  "19": "Leather and textiles",
  "22": "Printed matter",
  "24": "Chemical products",
  "30": "Office and computing machinery",
  "31": "Electrical machinery",
  "32": "Communication equipment",
  "33": "Medical equipment",
  "34": "Transport equipment",
  "35": "Security and defence equipment",
  "37": "Musical instruments and sports goods",
  "38": "Laboratory and precision equipment",
  "39": "Furniture and furnishings",
  "41": "Collected and purified water",
  "42": "Industrial machinery",
  "43": "Mining and construction machinery",
  "44": "Construction materials",
  "45": "Construction work",
  "48": "Software and systems",
  "50": "Repair and maintenance",
  "51": "Installation services",
  "55": "Hotel and restaurant services",
  "60": "Transport services",
  "63": "Supporting transport services",
  "64": "Postal and telecom services",
  "65": "Public utilities",
  "66": "Financial services",
  "70": "Real estate services",
  "71": "Architectural and engineering services",
  "72": "IT services",
  "73": "Research and development",
  "75": "Public administration",
  "76": "Oil and gas services",
  "77": "Agricultural services",
  "79": "Business services",
  "80": "Education and training",
  "85": "Health and social work",
  "90": "Sewage and environmental services",
  "92": "Recreational and cultural services",
  "98": "Other community services",
};

/** Coarse industry from CPV division when reliably mapped; otherwise null. */
export const CPV_DIVISION_INDUSTRY: Record<string, string> = {
  "03": "Agriculture",
  "09": "Energy",
  "15": "Food",
  "30": "Technology",
  "32": "Technology",
  "33": "Healthcare",
  "34": "Transport",
  "35": "Security",
  "42": "Industrial",
  "43": "Construction",
  "44": "Construction",
  "45": "Construction",
  "48": "Technology",
  "50": "Services",
  "55": "Hospitality",
  "60": "Transport",
  "64": "Telecommunications",
  "65": "Utilities",
  "66": "Finance",
  "70": "Real Estate",
  "71": "Professional Services",
  "72": "Technology",
  "73": "Research",
  "75": "Public Sector",
  "79": "Business Services",
  "80": "Education",
  "85": "Healthcare",
  "90": "Environment",
  "92": "Culture",
};

export function normalizeCpvCode(raw: string): string | null {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 2) return null;
  return digits.padEnd(8, "0").slice(0, 8);
}

export function cpvDivision(code: string): string {
  return code.slice(0, 2);
}

export function mapCpvCodesToServices(codes: string[]): {
  services: string[];
  category: string | null;
  industry: string | null;
  rawCpvs: string[];
} {
  const rawCpvs: string[] = [];
  const services: string[] = [];
  const seen = new Set<string>();

  for (const raw of codes) {
    const code = normalizeCpvCode(raw);
    if (!code) continue;
    if (!seen.has(code)) {
      seen.add(code);
      rawCpvs.push(code);
    }
    const div = cpvDivision(code);
    const label = CPV_DIVISION_LABELS[div] ?? `CPV division ${div}`;
    if (!services.includes(label)) services.push(label);
  }

  const primaryDiv = rawCpvs[0] ? cpvDivision(rawCpvs[0]) : null;
  const category = primaryDiv
    ? (CPV_DIVISION_LABELS[primaryDiv] ?? `CPV division ${primaryDiv}`)
    : null;
  const industry = primaryDiv ? (CPV_DIVISION_INDUSTRY[primaryDiv] ?? null) : null;

  return { services, category, industry, rawCpvs };
}
