/**
 * Report integrity — canonical counts must match matrix / readiness / action identities
 * before Web/PDF release. Validates structured datasets only.
 */

import { failure } from "../helpers";
import type { DecisionGuardianInput, GuardianValidationFailure } from "../types";

export function checkReportIntegrity(
  input: DecisionGuardianInput,
): GuardianValidationFailure[] {
  const counts = input.counts;
  if (!counts) return [];
  const out: GuardianValidationFailure[] = [];

  const values = [
    counts.canonicalRequirementCount,
    counts.matrixCount,
    counts.readinessCount,
  ];
  if (counts.complianceSummaryTotal != null) {
    values.push(counts.complianceSummaryTotal);
  }

  const first = values[0]!;
  if (values.some((v) => v !== first)) {
    out.push(
      failure({
        validationCode: "REPORT_DATASET_MISMATCH",
        severity: "CRITICAL",
        check: "report-integrity",
        explanation: `Report datasets disagree — canonical=${counts.canonicalRequirementCount}, matrix=${counts.matrixCount}, readiness=${counts.readinessCount}, summary=${counts.complianceSummaryTotal ?? "n/a"}`,
      }),
    );
  }

  if (
    counts.actionLinkedIdentityCount != null &&
    counts.actionLinkedIdentityCount !== counts.canonicalRequirementCount &&
    counts.actionLinkedIdentityCount > counts.canonicalRequirementCount
  ) {
    out.push(
      failure({
        validationCode: "REPORT_DATASET_MISMATCH",
        severity: "CRITICAL",
        check: "report-integrity",
        explanation: `Action identity count (${counts.actionLinkedIdentityCount}) does not align with canonical set (${counts.canonicalRequirementCount}).`,
      }),
    );
  }

  return out;
}
