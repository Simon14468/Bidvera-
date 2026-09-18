/**
 * Canonical requirement counting — ONE authoritative requirement set drives all totals.
 *
 * Lifecycle enforced:
 * EXTRACT CANDIDATES → FILTER → CLASSIFY → NORMALIZE → SEMANTIC DEDUPE
 * → CANONICAL REQUIREMENTS → STATUS → COUNTS
 */

import type { TenderReadinessBreakdown } from "@/domain/decision/tender-readiness";
import type {
  ComplianceSummary,
  TenderIntelligenceBreakdown,
} from "@/domain/tender-intelligence";
import {
  assertRequirementCountConsistency,
  snapshotFromComplianceSummary,
  snapshotFromReadiness,
} from "@/domain/tender-intelligence/requirement-count-consistency";

export type CanonicalCountContext = {
  /** Authoritative count — TenderRequirement rows / buildCanonicalRequirements output length. */
  canonicalRequirementCount: number;
  readiness: TenderReadinessBreakdown;
  intelligence: TenderIntelligenceBreakdown;
};

/**
 * Runtime invariant checks — throws on any divergence from the canonical requirement set.
 */
export function assertCanonicalRequirementInvariants(
  ctx: CanonicalCountContext,
): void {
  const { canonicalRequirementCount, readiness, intelligence } = ctx;
  const matrix = intelligence.complianceMatrix;
  const summary = intelligence.complianceSummary;

  if (matrix.length !== canonicalRequirementCount) {
    throw new Error(
      `Compliance matrix length (${matrix.length}) !== canonical requirements (${canonicalRequirementCount})`,
    );
  }

  if (summary.totalRequirements !== canonicalRequirementCount) {
    throw new Error(
      `Compliance summary total (${summary.totalRequirements}) !== canonical requirements (${canonicalRequirementCount})`,
    );
  }

  const readinessTotal = readiness.totalRequirements ?? readiness.total;
  if (readinessTotal !== canonicalRequirementCount) {
    throw new Error(
      `Readiness total (${readinessTotal}) !== canonical requirements (${canonicalRequirementCount})`,
    );
  }

  if (readiness.items.length !== canonicalRequirementCount) {
    throw new Error(
      `Readiness items (${readiness.items.length}) !== canonical requirements (${canonicalRequirementCount})`,
    );
  }

  const mandatory = matrix.filter((r) => r.mandatory).length;
  if (mandatory > canonicalRequirementCount) {
    throw new Error(
      `Mandatory count (${mandatory}) exceeds total requirements (${canonicalRequirementCount})`,
    );
  }

  const statusSum =
    summary.ready +
    summary.missing +
    summary.verify +
    summary.notApplicable +
    summary.unknown;

  if (statusSum !== canonicalRequirementCount) {
    throw new Error(
      `Status tally sum (${statusSum}) !== canonical requirements (${canonicalRequirementCount})`,
    );
  }

  // Authoritative partition used by Web / PDF / API / SSR:
  // total = verified + needsVerification + confirmedGaps + notApplicable
  const verified =
    summary.verifiedRequirements ?? summary.ready;
  const needsVerification =
    summary.needsVerification ?? summary.verify + summary.unknown;
  const confirmedGaps = summary.confirmedGaps ?? summary.missing;
  const partitionSum =
    verified + needsVerification + confirmedGaps + summary.notApplicable;
  if (partitionSum !== canonicalRequirementCount) {
    throw new Error(
      `Canonical partition sum (${partitionSum}=${verified}+${needsVerification}+${confirmedGaps}+${summary.notApplicable}) !== totalRequirements (${canonicalRequirementCount})`,
    );
  }

  const requirementIds = matrix.map((r) => r.requirementId);
  const uniqueIds = new Set(requirementIds);
  if (uniqueIds.size !== requirementIds.length) {
    throw new Error("Duplicate requirementId in compliance matrix");
  }

  if (readiness.items.some((i) => i.category === "document")) {
    throw new Error(
      "MissingDocument rows must not appear in readiness.items — use missingDocuments section",
    );
  }

  assertRequirementCountConsistency({
    summary: snapshotFromComplianceSummary(summary, mandatory),
    readiness: snapshotFromReadiness(readiness),
    compliance: snapshotFromComplianceSummary(summary, mandatory),
    canonicalRowCount: canonicalRequirementCount,
  });
}

/**
 * Detect persisted analysis JSON that counted missing documents or diverged from DB requirements.
 */
export function isStoredAnalysisCountsStale(input: {
  requirementCount: number;
  missingDocCount: number;
  storedReadiness: TenderReadinessBreakdown | null;
  storedIntelligence: TenderIntelligenceBreakdown | null;
}): boolean {
  const { requirementCount, missingDocCount, storedReadiness, storedIntelligence } =
    input;

  if (!storedReadiness && !storedIntelligence?.complianceMatrix?.length) {
    return false;
  }

  const snap = storedIntelligence?.canonicalSnapshot;
  if (
    snap &&
    snap.counts.totalRequirements === requirementCount &&
    (storedIntelligence?.complianceMatrix?.length ?? 0) === requirementCount
  ) {
    return false;
  }

  if (storedReadiness) {
    const total = storedReadiness.totalRequirements ?? storedReadiness.total;

    if (
      missingDocCount > 0 &&
      total === requirementCount + missingDocCount
    ) {
      return true;
    }

    if (total !== requirementCount) return true;
    if (storedReadiness.items.length !== requirementCount) return true;
  }

  const matrixLen = storedIntelligence?.complianceMatrix?.length ?? 0;
  if (matrixLen > 0 && matrixLen !== requirementCount) return true;

  const summaryTotal = storedIntelligence?.complianceSummary?.totalRequirements;
  if (summaryTotal != null && summaryTotal !== requirementCount) return true;

  return false;
}

export function deriveHighPriorityCount(
  matrix: TenderIntelligenceBreakdown["complianceMatrix"],
): number {
  return matrix.filter((r) => r.priority === "HIGH").length;
}

export function buildCanonicalCountAudit(ctx: CanonicalCountContext): {
  canonicalRequirementCount: number;
  mandatory: number;
  highPriority: number;
  statusSum: number;
  complianceSummary: ComplianceSummary;
} {
  const mandatory = ctx.intelligence.complianceMatrix.filter((r) => r.mandatory).length;
  const highPriority = deriveHighPriorityCount(ctx.intelligence.complianceMatrix);
  const s = ctx.intelligence.complianceSummary;
  return {
    canonicalRequirementCount: ctx.canonicalRequirementCount,
    mandatory,
    highPriority,
    statusSum: s.ready + s.missing + s.verify + s.notApplicable + s.unknown,
    complianceSummary: s,
  };
}
