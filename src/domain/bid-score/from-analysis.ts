import type { CompanyTenderFitBreakdown } from "@/domain/decision/company-fit";
import type { TenderReadinessBreakdown } from "@/domain/decision/tender-readiness";
import type { TenderIntelligenceBreakdown } from "@/domain/tender-intelligence";
import { computeBidScore } from "./compute";
import type { BidScoreBreakdown, BidScoreInput } from "./types";

/** Reject non-finite / non-positive / absurd values — never invent substitutes. */
export function sanitizeEstimatedValue(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value > 1e15) return null;
  return value;
}

export function isBidScoreBreakdown(value: unknown): value is BidScoreBreakdown {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.score === "number" &&
    Number.isFinite(v.score) &&
    typeof v.priority === "string" &&
    typeof v.priorityLabel === "string" &&
    typeof v.expectedValue === "string" &&
    Array.isArray(v.drivers)
  );
}

export function buildBidScoreFromAnalysis(input: {
  fitScore: number | null;
  fitBreakdown: CompanyTenderFitBreakdown | null;
  readiness: TenderReadinessBreakdown | null;
  intelligence: TenderIntelligenceBreakdown;
  estimatedValue: number | null;
  deadline: Date | null;
  decision: "BID" | "REVIEW" | "NO_BID" | null;
  /** Freeze deadline pressure relative to analysis time for reproducibility */
  asOf?: Date | null;
}): BidScoreBreakdown {
  const matrix = input.intelligence.complianceMatrix;
  const missingMandatory = matrix.filter(
    (r) => r.mandatory && r.status === "MISSING",
  ).length;
  const verifyMandatory = matrix.filter(
    (r) => r.mandatory && r.status === "VERIFY",
  ).length;

  const highRiskCount = input.intelligence.risks.filter(
    (r) =>
      r.severity === "HIGH" ||
      r.severityCanonical === "HIGH" ||
      r.severityCanonical === "CRITICAL",
  ).length;
  const criticalRiskCount = input.intelligence.risks.filter(
    (r) => r.severityCanonical === "CRITICAL",
  ).length;

  let daysUntilDeadline: number | null = null;
  if (input.deadline && !Number.isNaN(input.deadline.getTime())) {
    const asOf = input.asOf ?? new Date();
    daysUntilDeadline = Math.ceil(
      (input.deadline.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  const learning = input.intelligence.learningSignal;
  const scoreInput: BidScoreInput = {
    fitScore: input.fitScore ?? input.fitBreakdown?.overall ?? null,
    readinessScore: input.readiness?.score ?? null,
    compliance: {
      total: input.intelligence.complianceSummary.totalRequirements,
      ready: input.intelligence.complianceSummary.ready,
      missing: input.intelligence.complianceSummary.missing,
      verify: input.intelligence.complianceSummary.verify,
      missingMandatory,
      verifyMandatory,
    },
    highRiskCount,
    criticalRiskCount,
    estimatedValue: sanitizeEstimatedValue(input.estimatedValue),
    daysUntilDeadline,
    requirementCount: matrix.length,
    historical: learning?.detected
      ? {
          detected: true,
          influenceAllowed: learning.influenceAllowed,
          lean: learning.outcomeLean,
        }
      : null,
    decision: input.decision,
  };

  return computeBidScore(scoreInput);
}
