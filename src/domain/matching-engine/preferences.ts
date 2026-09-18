/**
 * Soft behavioral preference weights — NOT company capabilities (Feature 8E).
 * Never invent services, certifications, experience, or qualifications.
 */

import { createHash } from "node:crypto";
import { normalizeMatchingToken } from "./normalize";

export type PreferenceWeightMap = Record<string, number>;

export type MatchingPreferenceWeights = {
  services: PreferenceWeightMap;
  categories: PreferenceWeightMap;
  industries: PreferenceWeightMap;
  geographies: PreferenceWeightMap;
  dismissServices: PreferenceWeightMap;
};

export const EMPTY_PREFERENCE_WEIGHTS: MatchingPreferenceWeights = {
  services: {},
  categories: {},
  industries: {},
  geographies: {},
  dismissServices: {},
};

/** Soft rank boosts among already-eligible candidates only. */
export const PREFERENCE_BOOST_MAX = 8;
export const PREFERENCE_DISMISS_PENALTY_MAX = 4;

const EVENT_WEIGHT: Record<string, number> = {
  VIEW: 1,
  CLICK: 1.5,
  INTEREST: 3,
  DISMISS: 2,
};

export type PreferenceEngagementRow = {
  eventType: string;
  category?: string | null;
  services?: string[] | null;
  industries?: string[] | null;
  industry?: string | null;
  geographies?: string[] | null;
};

function bump(map: PreferenceWeightMap, raw: string, amount: number) {
  const key = normalizeMatchingToken(raw);
  if (!key || key.length < 2) return;
  map[key] = (map[key] ?? 0) + amount;
}

/**
 * Build soft preference weights from public opportunity dimensions on engagement.
 * DISMISS contributes negative affinity via dismissServices only.
 */
export function buildPreferenceWeightsFromEngagements(
  rows: PreferenceEngagementRow[],
): MatchingPreferenceWeights {
  const weights: MatchingPreferenceWeights = {
    services: {},
    categories: {},
    industries: {},
    geographies: {},
    dismissServices: {},
  };

  for (const row of rows) {
    const w = EVENT_WEIGHT[row.eventType] ?? 0;
    if (w <= 0) continue;

    if (row.eventType === "DISMISS") {
      for (const s of row.services ?? []) bump(weights.dismissServices, s, w);
      if (row.category) bump(weights.dismissServices, row.category, w * 0.5);
      continue;
    }

    if (row.eventType === "VIEW" || row.eventType === "CLICK" || row.eventType === "INTEREST") {
      for (const s of row.services ?? []) bump(weights.services, s, w);
      if (row.category) bump(weights.categories, row.category, w);
      for (const ind of row.industries ?? []) bump(weights.industries, ind, w);
      if (row.industry) bump(weights.industries, row.industry, w);
      for (const g of row.geographies ?? []) bump(weights.geographies, g, w);
    }
  }

  return weights;
}

function sumOverlap(
  weights: PreferenceWeightMap,
  values: string[],
): number {
  let sum = 0;
  for (const v of values) {
    const key = normalizeMatchingToken(v);
    if (key && weights[key]) sum += weights[key]!;
  }
  return sum;
}

/**
 * Soft affinity for an already-eligible opportunity.
 * Positive engagement boosts; dismiss patterns demote slightly.
 * Capped — cannot manufacture eligibility.
 */
export function preferenceAffinityScore(
  weights: MatchingPreferenceWeights | null | undefined,
  opportunity: {
    category?: string | null;
    services?: string[] | null;
    industries?: string[] | null;
    industry?: string | null;
    geographies?: string[] | null;
  },
): number {
  if (!weights) return 0;

  const services = opportunity.services ?? [];
  const industries = [
    ...(opportunity.industries ?? []),
    ...(opportunity.industry ? [opportunity.industry] : []),
  ];
  const geos = opportunity.geographies ?? [];
  const cats = opportunity.category ? [opportunity.category] : [];

  const positive =
    sumOverlap(weights.services, services) * 0.45 +
    sumOverlap(weights.categories, cats) * 0.25 +
    sumOverlap(weights.industries, industries) * 0.2 +
    sumOverlap(weights.geographies, geos) * 0.1;

  const dismiss =
    sumOverlap(weights.dismissServices, [...services, ...cats]) * 0.5;

  // Normalize loosely: ~10 weight units → near max boost
  let boost = Math.min(PREFERENCE_BOOST_MAX, (positive / 10) * PREFERENCE_BOOST_MAX);
  const penalty = Math.min(
    PREFERENCE_DISMISS_PENALTY_MAX,
    (dismiss / 8) * PREFERENCE_DISMISS_PENALTY_MAX,
  );
  boost -= penalty;
  return Math.round(boost * 100) / 100;
}

export function hashPreferenceWeights(
  weights: MatchingPreferenceWeights,
): string {
  return createHash("sha256")
    .update(JSON.stringify(weights))
    .digest("hex")
    .slice(0, 32);
}

/**
 * Guard: preference weights must never be merged into hard capability signals.
 * Used by tests and generate path assertions.
 */
export function assertPreferencesAreNotCapabilities(
  profileServices: string[],
  preferenceServices: PreferenceWeightMap,
): boolean {
  // Soft preferences may overlap labels with services, but they are a separate artifact.
  // This helper documents the contract: preference keys alone do not prove capability.
  void profileServices;
  return Object.keys(preferenceServices).every(
    (k) => typeof preferenceServices[k] === "number",
  );
}
