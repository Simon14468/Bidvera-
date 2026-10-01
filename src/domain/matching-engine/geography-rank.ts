/**
 * Soft geography proximity ranking (Feature 8E).
 * Geography ranks practical closeness — never an absolute same-country gate
 * unless the opportunity itself encodes a hard location requirement (8C scorer).
 */

import {
  geographyHierarchyScore,
  normalizeMatchingToken,
  tokens,
} from "./normalize";

export const GEOGRAPHY_BOOST_MAX = 5;

/** Neighbor / region hints for soft proximity (non-exhaustive, ranking only). */
const NEIGHBOR_GROUPS: string[][] = [
  ["morocco", "spain", "france", "portugal", "algeria", "tunisia"],
  ["france", "belgium", "luxembourg", "switzerland", "germany", "italy", "spain"],
  ["germany", "austria", "netherlands", "belgium", "poland", "czech"],
  ["china", "vietnam", "japan", "korea", "taiwan", "singapore"],
  ["usa", "united states", "canada", "mexico"],
  ["uk", "united kingdom", "ireland", "france", "netherlands"],
];

function normalizeGeo(value: string): string {
  return normalizeMatchingToken(value);
}

function sameTokenOverlap(a: string[], b: string[]): boolean {
  const setB = new Set(b.map(normalizeGeo));
  return a.some((x) => setB.has(normalizeGeo(x)));
}

function shareNeighborGroup(a: string[], b: string[]): boolean {
  const na = a.map(normalizeGeo);
  const nb = b.map(normalizeGeo);
  for (const group of NEIGHBOR_GROUPS) {
    const g = new Set(group.map(normalizeGeo));
    const hitA = na.some((x) => g.has(x) || tokens(x).some((t) => g.has(t)));
    const hitB = nb.some((x) => g.has(x) || tokens(x).some((t) => g.has(t)));
    if (hitA && hitB) return true;
  }
  return false;
}

/**
 * Soft boost among eligible candidates:
 * same token → hierarchy parent/child → neighbors → else 0.
 * Cross-border matching remains allowed when boost is 0.
 */
export function geographyProximityBoost(
  companyGeographies: string[],
  opportunityGeographies: string[],
): number {
  if (companyGeographies.length === 0 || opportunityGeographies.length === 0) {
    return 0;
  }

  if (sameTokenOverlap(companyGeographies, opportunityGeographies)) {
    return GEOGRAPHY_BOOST_MAX;
  }

  const hierarchy = geographyHierarchyScore(
    companyGeographies,
    opportunityGeographies,
  );
  if (hierarchy >= 70) {
    return Math.round(GEOGRAPHY_BOOST_MAX * 0.7 * 100) / 100;
  }
  if (hierarchy >= 55) {
    return Math.round(GEOGRAPHY_BOOST_MAX * 0.45 * 100) / 100;
  }

  if (shareNeighborGroup(companyGeographies, opportunityGeographies)) {
    return Math.round(GEOGRAPHY_BOOST_MAX * 0.55 * 100) / 100;
  }

  return 0;
}

/** Final rank = hard relevance score + soft boosts (capped elsewhere). */
export function computeFinalRankScore(input: {
  relevanceScore: number;
  preferenceBoost?: number;
  geographyBoost?: number;
  aiRefineBoost?: number;
}): number {
  const total =
    input.relevanceScore +
    (input.preferenceBoost ?? 0) +
    (input.geographyBoost ?? 0) +
    (input.aiRefineBoost ?? 0);
  return Math.round(total * 100) / 100;
}
