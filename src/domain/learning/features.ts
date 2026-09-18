import { createHash } from "crypto";
import type { LearningFeatures } from "./types";

function bucketText(raw: string | null | undefined, fallback = "unknown"): string {
  if (!raw?.trim()) return fallback;
  // Coarse + normalized — never store free-form PII-like strings long enough to identify
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 40) || fallback;
}

function scoreBand(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return "unknown";
  if (score < 40) return "0-39";
  if (score < 60) return "40-59";
  if (score < 80) return "60-79";
  return "80-100";
}

function sizeBand(input: {
  companySize?: string | null;
  employeeRange?: string | null;
}): string {
  const raw = `${input.employeeRange ?? ""} ${input.companySize ?? ""}`.toLowerCase();
  if (!raw.trim()) return "unknown";
  if (/\b(1[-–]10|micro|solo|1-9)\b/.test(raw)) return "micro";
  if (/\b(11[-–]50|small|sme|10-49)\b/.test(raw)) return "small";
  if (/\b(51[-–]250|medium|50-249)\b/.test(raw)) return "medium";
  if (/\b(250\+|500\+|enterprise|large)\b/.test(raw)) return "large";
  return "unknown";
}

function valueBand(estimatedValue: number | null | undefined): string {
  if (estimatedValue == null || estimatedValue <= 0) return "unknown";
  if (estimatedValue < 100_000) return "under-100k";
  if (estimatedValue < 1_000_000) return "100k-1m";
  return "over-1m";
}

function mandatoryGapBand(missingMandatory: number): string {
  if (missingMandatory <= 0) return "0";
  if (missingMandatory <= 2) return "1-2";
  return "3-plus";
}

export type FeatureExtractionInput = {
  industry: string | null;
  country: string | null;
  companySize?: string | null;
  employeeRange?: string | null;
  fitScore: number | null;
  readinessScore: number | null;
  decision: "BID" | "REVIEW" | "NO_BID";
  missingMandatoryCount: number;
  estimatedValue: number | null;
};

/**
 * Build coarse structured features for learning.
 * Deliberately excludes: company name, tender title, client, documents,
 * evidence text, page numbers, exact scores, and free-form notes.
 */
export function extractLearningFeatures(
  input: FeatureExtractionInput,
): LearningFeatures {
  return {
    industryBucket: bucketText(input.industry),
    countryBucket: bucketText(input.country),
    sizeBand: sizeBand({
      companySize: input.companySize,
      employeeRange: input.employeeRange,
    }),
    fitBand: scoreBand(input.fitScore),
    readinessBand: scoreBand(input.readinessScore),
    decisionAtAnalysis: input.decision,
    mandatoryGapBand: mandatoryGapBand(input.missingMandatoryCount),
    valueBand: valueBand(input.estimatedValue),
  };
}

/** Stable opaque key for aggregation — not reversible to tender content. */
export function featureKeyFrom(features: LearningFeatures): string {
  const canonical = [
    features.industryBucket,
    features.countryBucket,
    features.sizeBand,
    features.fitBand,
    features.readinessBand,
    features.decisionAtAnalysis,
    features.mandatoryGapBand,
    features.valueBand,
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

/**
 * Privacy filter: drop anything that could identify a company or tender.
 * Input may include extra fields — only LearningFeatures keys survive.
 */
export function privacyFilterFeatures(
  raw: Record<string, unknown> | LearningFeatures,
): LearningFeatures {
  const f = raw as Partial<LearningFeatures>;
  return {
    industryBucket: bucketText(f.industryBucket ?? null),
    countryBucket: bucketText(f.countryBucket ?? null),
    sizeBand: bucketText(f.sizeBand ?? null),
    fitBand: bucketText(f.fitBand ?? null),
    readinessBand: bucketText(f.readinessBand ?? null),
    decisionAtAnalysis:
      f.decisionAtAnalysis === "BID" ||
      f.decisionAtAnalysis === "REVIEW" ||
      f.decisionAtAnalysis === "NO_BID"
        ? f.decisionAtAnalysis
        : "REVIEW",
    mandatoryGapBand: bucketText(f.mandatoryGapBand ?? null),
    valueBand: bucketText(f.valueBand ?? null),
  };
}
