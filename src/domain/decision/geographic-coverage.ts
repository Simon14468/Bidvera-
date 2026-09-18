/**
 * Geographic coverage applicability for Decision rules.
 * GEO_MISMATCH only when the requirement is a real bidder geographic obligation
 * and company profile evidence contradicts that scope.
 */

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9+ ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Legal / regulatory / jurisdictional uses of "national" that are NOT geographic coverage. */
const NON_GEOGRAPHIC_NATIONAL_OR_LEGAL =
  /\b(?:national\s+court|national\s+tribunal|national\s+(?:pharmaceutical|medicines?|drug|health)\s+authorit|national\s+regulator|national\s+regulatory|privileges?\s+and\s+immunit|waiver\s+of\s+(?:any\s+(?:of\s+)?)?(?:the\s+)?privileges|jurisdiction\s+of\s+any\s+national|submission\s+to\s+the\s+jurisdiction|under\s+any\s+source\s+of\s+law|legal\s+venue|applicable\s+national\s+law)\b/i;

/**
 * Explicit bidder/company geographic coverage / establishment / delivery-scope obligations.
 * Requires obligation force toward the economic operator plus a geographic scope cue.
 */
const BIDDER_GEO_OBLIGATION_FORCE =
  /\b(?:(?:bidder|tenderer|supplier|contractor|vendor|company|firm|economic\s+operator|soumissionnaire)s?\s+(?:must|shall|are\s+required\s+to|is\s+required\s+to)|(?:must|shall)\s+(?:operate|be\s+(?:established|registered|located|based)|maintain\s+(?:a\s+)?(?:presence|office|coverage)|deliver|provide\s+services?|serve|cover|have\s+(?:an?\s+)?(?:office|presence|coverage))|(?:geographic(?:al)?\s+coverage|service\s+(?:area|territory|region)|area\s+of\s+(?:operation|coverage)|place\s+of\s+(?:business|establishment)|registered\s+office)|(?:operate|established|registered|located|based|cover(?:age)?|deliver(?:y)?|provide\s+services?)\s+(?:in|within|across|throughout))\b/i;

const GEO_SCOPE_PLACE =
  /\b(?:nationwide|uk[- ]?wide|scotland(?:-wide)?|wales(?:-wide)?|northern\s+ireland|england|united\s+kingdom|\buk\b|european\s+union|\beu\b|member\s+state|country|countries|territory|territories|region|regions|geographic(?:al)?\s+(?:scope|area|coverage)|within\s+[A-Z][a-z]+|in\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i;

/** Deferred / not applicable at bidding — must not become a confirmed gap. */
export function isGeographicObligationDeferredPastBidding(text: string): boolean {
  const t = text.replace(/\s+/g, " ");
  if (
    /\bnot\s+required\s+at\s+(?:the\s+)?(?:time\s+of\s+)?bidding\b/i.test(t) ||
    /\bnot\s+required\s+at\s+bid\s+(?:stage|submission)\b/i.test(t)
  ) {
    return true;
  }
  if (
    /\bprior\s+to\s+(?:supply|delivery|contract\s+award|award)\b/i.test(t) &&
    /\b(?:will\s+be\s+required|required\s+(?:only\s+)?(?:prior|before)|not\s+required\s+at)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

/**
 * True when the statement is a bidder-side geographic coverage / location obligation.
 * Incidental "national court / national regulatory / national authority" language returns false.
 */
export function isBidderGeographicCoverageObligation(text: string): boolean {
  const raw = text?.trim() ?? "";
  if (raw.length < 20) return false;
  if (NON_GEOGRAPHIC_NATIONAL_OR_LEGAL.test(raw)) return false;
  if (!BIDDER_GEO_OBLIGATION_FORCE.test(raw)) return false;
  if (!GEO_SCOPE_PLACE.test(raw) && !/\b(?:nationwide|uk[- ]?wide|scotland|wales|northern\s+ireland)\b/i.test(raw)) {
    // Still allow explicit "geographic coverage" phrasing without a place token
    if (!/\bgeographic(?:al)?\s+coverage\b/i.test(raw)) return false;
  }
  return true;
}

export type GeographicCoverageEvaluation = {
  /** true = profile covers; false = explicit contradiction; null = cannot prove (verify). */
  covers: boolean | null;
  reason: string;
};

/**
 * Evaluate company geographic coverage against a bidder geographic obligation.
 * Never treats incidental "national*" tokens as place demands.
 */
export function evaluateGeographicCoverage(
  profile: { country: string | null; geographicCoverage: string[] },
  requirementText: string,
): GeographicCoverageEvaluation {
  if (!isBidderGeographicCoverageObligation(requirementText)) {
    return { covers: null, reason: "not_bidder_geographic_obligation" };
  }
  if (isGeographicObligationDeferredPastBidding(requirementText)) {
    return { covers: null, reason: "deferred_past_bidding" };
  }

  const locations = [
    ...(profile.country ? [profile.country] : []),
    ...profile.geographicCoverage,
  ]
    .map((g) => normalize(g))
    .filter(Boolean);

  if (locations.length === 0) {
    return { covers: null, reason: "no_company_geographic_evidence" };
  }

  const n = normalize(requirementText);
  const hit = locations.some((g) => g.length >= 2 && (n.includes(g) || g.includes(n.slice(0, 40))));
  if (hit) {
    return { covers: true, reason: "profile_location_matches_requirement" };
  }

  // Explicit named UK/home-nation scope that profile does not list
  const demanded: string[] = [];
  if (/\bnationwide\b|\buk[- ]?wide\b|\bunited\s+kingdom\b|\buk\b/.test(n)) demanded.push("uk");
  if (/\bscotland\b/.test(n)) demanded.push("scotland");
  if (/\bwales\b/.test(n)) demanded.push("wales");
  if (/\bnorthern\s+ireland\b/.test(n)) demanded.push("northern ireland");
  if (/\bengland\b/.test(n)) demanded.push("england");

  if (demanded.length === 0) {
    // Geographic obligation stated but no resolvable place token vs profile → verify
    return { covers: null, reason: "geographic_scope_unresolved" };
  }

  const profileBlob = locations.join(" ");
  const covered = demanded.every(
    (d) =>
      profileBlob.includes(d) ||
      (d === "uk" &&
        (profileBlob.includes("united kingdom") ||
          profileBlob.includes("britain") ||
          profileBlob.includes("england") ||
          profileBlob.includes("scotland") ||
          profileBlob.includes("wales"))),
  );
  if (covered) {
    return { covers: true, reason: "profile_covers_demanded_scope" };
  }
  return { covers: false, reason: "profile_contradicts_demanded_scope" };
}
