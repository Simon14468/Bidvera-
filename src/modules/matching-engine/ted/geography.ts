/**
 * NUTS / ISO country codes from TED → Bidvera geography labels.
 * Never invents locations; unknown codes are omitted (neutral).
 */

/** ISO 3166-1 alpha-3 → English country name (EU + EEA + common TED buyers). */
export const ISO3_TO_COUNTRY: Record<string, string> = {
  AUT: "Austria",
  BEL: "Belgium",
  BGR: "Bulgaria",
  HRV: "Croatia",
  CYP: "Cyprus",
  CZE: "Czechia",
  DNK: "Denmark",
  EST: "Estonia",
  FIN: "Finland",
  FRA: "France",
  DEU: "Germany",
  GRC: "Greece",
  HUN: "Hungary",
  IRL: "Ireland",
  ITA: "Italy",
  LVA: "Latvia",
  LTU: "Lithuania",
  LUX: "Luxembourg",
  MLT: "Malta",
  NLD: "Netherlands",
  POL: "Poland",
  PRT: "Portugal",
  ROU: "Romania",
  SVK: "Slovakia",
  SVN: "Slovenia",
  ESP: "Spain",
  SWE: "Sweden",
  ISL: "Iceland",
  LIE: "Liechtenstein",
  NOR: "Norway",
  CHE: "Switzerland",
  GBR: "United Kingdom",
  MKD: "North Macedonia",
  MNE: "Montenegro",
  SRB: "Serbia",
  ALB: "Albania",
  BIH: "Bosnia and Herzegovina",
  TUR: "Türkiye",
  UKR: "Ukraine",
  MDA: "Moldova",
  GEO: "Georgia",
  ARM: "Armenia",
  AZE: "Azerbaijan",
  USA: "United States",
  CAN: "Canada",
  MAR: "Morocco",
  TUN: "Tunisia",
  DZA: "Algeria",
  EGY: "Egypt",
  ISR: "Israel",
  JPN: "Japan",
  CHN: "China",
  AUS: "Australia",
  NZL: "New Zealand",
  XXX: "Not specified",
};

/** ISO 3166-1 alpha-2 (NUTS country prefix) → alpha-3. */
export const ISO2_TO_ISO3: Record<string, string> = {
  AT: "AUT",
  BE: "BEL",
  BG: "BGR",
  HR: "HRV",
  CY: "CYP",
  CZ: "CZE",
  DK: "DNK",
  EE: "EST",
  FI: "FIN",
  FR: "FRA",
  DE: "DEU",
  EL: "GRC",
  GR: "GRC",
  HU: "HUN",
  IE: "IRL",
  IT: "ITA",
  LV: "LVA",
  LT: "LTU",
  LU: "LUX",
  MT: "MLT",
  NL: "NLD",
  PL: "POL",
  PT: "PRT",
  RO: "ROU",
  SK: "SVK",
  SI: "SVN",
  ES: "ESP",
  SE: "SWE",
  IS: "ISL",
  LI: "LIE",
  NO: "NOR",
  CH: "CHE",
  UK: "GBR",
  GB: "GBR",
  MK: "MKD",
  ME: "MNE",
  RS: "SRB",
  AL: "ALB",
  BA: "BIH",
  TR: "TUR",
  UA: "UKR",
  MD: "MDA",
  GE: "GEO",
  AM: "ARM",
  AZ: "AZE",
  US: "USA",
  CA: "CAN",
  MA: "MAR",
  TN: "TUN",
  DZ: "DZA",
  EG: "EGY",
  IL: "ISR",
  JP: "JPN",
  CN: "CHN",
  AU: "AUS",
  NZ: "NZL",
};

export function resolveIso3ToCountry(code: string): string | null {
  const c = code.trim().toUpperCase();
  if (c.length === 3) return ISO3_TO_COUNTRY[c] ?? null;
  if (c.length === 2) {
    const iso3 = ISO2_TO_ISO3[c];
    return iso3 ? (ISO3_TO_COUNTRY[iso3] ?? null) : null;
  }
  return null;
}

/**
 * Map TED place-of-performance / buyer-country values to country labels.
 * NUTS codes (e.g. DE131) contribute only their country — never invent region names.
 */
export function mapTedPlacesToGeographies(values: string[]): {
  geographies: string[];
  iso3Codes: string[];
  nutsCodes: string[];
} {
  const geographies: string[] = [];
  const iso3Codes: string[] = [];
  const nutsCodes: string[] = [];
  const seenGeo = new Set<string>();
  const seenIso = new Set<string>();

  for (const raw of values) {
    const v = String(raw).trim().toUpperCase();
    if (!v) continue;

    if (/^[A-Z]{3}$/.test(v)) {
      if (!seenIso.has(v)) {
        seenIso.add(v);
        iso3Codes.push(v);
      }
      const name = resolveIso3ToCountry(v);
      if (name && !seenGeo.has(name)) {
        seenGeo.add(name);
        geographies.push(name);
      }
      continue;
    }

    // NUTS: 2–5 alphanumeric starting with country ISO2
    if (/^[A-Z]{2}[A-Z0-9]{0,3}$/.test(v)) {
      nutsCodes.push(v);
      const iso2 = v.slice(0, 2);
      const iso3 = ISO2_TO_ISO3[iso2];
      if (iso3 && !seenIso.has(iso3)) {
        seenIso.add(iso3);
        iso3Codes.push(iso3);
      }
      const name = resolveIso3ToCountry(iso2);
      if (name && !seenGeo.has(name)) {
        seenGeo.add(name);
        geographies.push(name);
      }
    }
  }

  return { geographies, iso3Codes, nutsCodes };
}

/** Normalize filter tokens (country names or ISO2/3) for case-insensitive match. */
export function geographyFilterTokens(values: string[]): Set<string> {
  const set = new Set<string>();
  for (const raw of values) {
    const t = raw.trim();
    if (!t) continue;
    set.add(t.toLowerCase());
    const asIso = resolveIso3ToCountry(t);
    if (asIso) set.add(asIso.toLowerCase());
    const upper = t.toUpperCase();
    if (ISO2_TO_ISO3[upper]) {
      const name = resolveIso3ToCountry(upper);
      if (name) set.add(name.toLowerCase());
      set.add(ISO2_TO_ISO3[upper]!.toLowerCase());
    }
    if (ISO3_TO_COUNTRY[upper]) {
      set.add(ISO3_TO_COUNTRY[upper]!.toLowerCase());
      set.add(upper.toLowerCase());
    }
  }
  return set;
}
