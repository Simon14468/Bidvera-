import { createHash } from "crypto";
import type { MatchingProfileSnapshot, MatchingTrustSummary } from "./types";

export function normalizeMatchingToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  return normalizeMatchingToken(s)
    .split(" ")
    .filter((t) => t.length > 2);
}

export function hashMatchingSnapshot(snapshot: MatchingProfileSnapshot): string {
  const payload = JSON.stringify(snapshot);
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export function countTrustSummary(snapshot: MatchingProfileSnapshot): MatchingTrustSummary {
  const summary: MatchingTrustSummary = { strong: 0, normal: 0, soft: 0 };
  const bump = (trust: keyof MatchingTrustSummary) => {
    summary[trust] += 1;
  };
  for (const s of snapshot.services) bump(s.trust);
  for (const s of snapshot.industries) bump(s.trust);
  for (const s of snapshot.geographies) bump(s.trust);
  for (const s of snapshot.certifications) bump(s.trust);
  for (const s of snapshot.dcmCategories) bump(s.trust);
  if (snapshot.size) bump(snapshot.size.trust);
  if (snapshot.experienceYears) bump(snapshot.experienceYears.trust);
  return summary;
}

export function computeMatchingCompleteness(snapshot: MatchingProfileSnapshot): number {
  const checks = [
    snapshot.services.some((s) => s.trust !== "soft"),
    snapshot.industries.some((s) => s.trust !== "soft") ||
      snapshot.services.some((s) => s.trust === "strong"),
    snapshot.geographies.length > 0,
    snapshot.certifications.some((s) => s.trust !== "soft") ||
      snapshot.dcmCategories.some((s) => s.trust === "strong"),
    snapshot.size != null,
    snapshot.experienceYears != null,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

/**
 * Eligible for Matching Engine pool: enough non-soft structured signals.
 * Missing data never invents eligibility.
 */
export function isMatchingProfileEligible(snapshot: MatchingProfileSnapshot): boolean {
  const hardServices = snapshot.services.filter((s) => s.trust !== "soft");
  const hardCerts = snapshot.certifications.filter((s) => s.trust !== "soft");
  const hardDcm = snapshot.dcmCategories.filter((s) => s.trust === "strong");
  const hasCapability = hardServices.length > 0 || hardCerts.length > 0 || hardDcm.length > 0;
  const hasGeo = snapshot.geographies.length > 0;
  return hasCapability && hasGeo;
}

export function overlapScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b.map(normalizeMatchingToken));
  const hits = a.map(normalizeMatchingToken).filter((t) => setB.has(t) || [...setB].some((x) => x.includes(t) || t.includes(x))).length;
  return Math.round((hits / a.length) * 100);
}

export function listOverlapScore(companyValues: string[], opportunityValues: string[]): number {
  if (companyValues.length === 0 || opportunityValues.length === 0) return 0;
  let best = 0;
  for (const c of companyValues) {
    const cn = normalizeMatchingToken(c);
    for (const o of opportunityValues) {
      const on = normalizeMatchingToken(o);
      if (!cn || !on) continue;
      if (cn === on) best = Math.max(best, 100);
      else if (cn.includes(on) || on.includes(cn)) best = Math.max(best, 85);
      else {
        const ot = tokens(o);
        const ct = tokens(c);
        best = Math.max(best, overlapScore(ct, ot));
      }
    }
  }
  return Math.min(100, best);
}
