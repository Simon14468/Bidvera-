/**
 * Report requirement-count consistency helpers.
 *
 * Canonical requirement dataset = TenderRequirement rows used to build
 * intelligence.complianceMatrix (1:1). All report sections that display
 * global Ready / Missing / Verify / Total MUST derive from that set —
 * never from MissingDocument rows mixed into readiness.
 */

import type { TenderReadinessBreakdown } from "@/domain/decision/tender-readiness";
import type { ComplianceSummary } from "@/domain/tender-intelligence";

export type RequirementCountSnapshot = {
  totalRequirements: number;
  ready: number;
  missing: number;
  verify: number;
  unknown: number;
  notApplicable: number;
  mandatory: number;
};

export function snapshotFromComplianceSummary(
  summary: ComplianceSummary,
  mandatoryCount: number,
): RequirementCountSnapshot {
  return {
    totalRequirements: summary.totalRequirements,
    ready: summary.ready,
    missing: summary.missing,
    verify: summary.verify,
    unknown: summary.unknown,
    notApplicable: summary.notApplicable,
    mandatory: mandatoryCount,
  };
}

export function snapshotFromReadiness(
  readiness: TenderReadinessBreakdown,
): RequirementCountSnapshot {
  const mandatory = readiness.items.filter((i) => i.mandatory).length;
  return {
    totalRequirements: readiness.totalRequirements ?? readiness.total,
    ready: readiness.counts.ready,
    missing: readiness.counts.missing,
    verify: readiness.counts.verify,
    unknown: readiness.counts.unknown,
    notApplicable: readiness.counts.notApplicable,
    mandatory,
  };
}

export function assertRequirementCountConsistency(input: {
  summary: RequirementCountSnapshot;
  readiness: RequirementCountSnapshot;
  compliance: RequirementCountSnapshot;
  /** Optional: live canonical row count (TenderRequirement / matrix length). */
  canonicalRowCount?: number;
}): void {
  const { summary, readiness, compliance, canonicalRowCount } = input;

  if (summary.totalRequirements !== readiness.totalRequirements) {
    throw new Error(
      `Requirement total mismatch: summary=${summary.totalRequirements} readiness=${readiness.totalRequirements}`,
    );
  }
  if (summary.totalRequirements !== compliance.totalRequirements) {
    throw new Error(
      `Requirement total mismatch: summary=${summary.totalRequirements} compliance=${compliance.totalRequirements}`,
    );
  }
  if (
    canonicalRowCount != null &&
    summary.totalRequirements !== canonicalRowCount
  ) {
    throw new Error(
      `Requirement total mismatch: summary=${summary.totalRequirements} canonicalRows=${canonicalRowCount}`,
    );
  }

  for (const key of ["ready", "missing", "verify", "unknown", "notApplicable"] as const) {
    if (summary[key] !== readiness[key] || summary[key] !== compliance[key]) {
      throw new Error(
        `Requirement ${key} mismatch: summary=${summary[key]} readiness=${readiness[key]} compliance=${compliance[key]}`,
      );
    }
  }

  if (summary.mandatory !== readiness.mandatory || summary.mandatory !== compliance.mandatory) {
    throw new Error(
      `Mandatory count mismatch: summary=${summary.mandatory} readiness=${readiness.mandatory} compliance=${compliance.mandatory}`,
    );
  }
}
