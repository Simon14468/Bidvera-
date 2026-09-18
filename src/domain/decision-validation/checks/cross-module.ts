/**
 * Cross-module consistency — same canonical IDs and counts across matrix/readiness/actions.
 */

import { failure } from "../helpers";
import type { DecisionGuardianInput, GuardianValidationFailure } from "../types";

export function checkCrossModuleConsistency(
  input: DecisionGuardianInput,
): GuardianValidationFailure[] {
  const out: GuardianValidationFailure[] = [];
  const canonicalIds = new Set(
    input.resolvedRequirementIds ?? input.requirements.map((r) => r.id),
  );
  const counts = input.counts;

  if (counts) {
    const { canonicalRequirementCount, matrixCount, readinessCount, complianceSummaryTotal } =
      counts;
    if (matrixCount !== canonicalRequirementCount) {
      out.push(
        failure({
          validationCode: "COUNT_DRIFT",
          severity: "CRITICAL",
          check: "cross-module",
          explanation: `Count drift: matrix=${matrixCount} ≠ canonical=${canonicalRequirementCount}`,
        }),
      );
    }
    if (readinessCount !== canonicalRequirementCount) {
      out.push(
        failure({
          validationCode: "COUNT_DRIFT",
          severity: "CRITICAL",
          check: "cross-module",
          explanation: `Count drift: readiness=${readinessCount} ≠ canonical=${canonicalRequirementCount}`,
        }),
      );
    }
    if (
      complianceSummaryTotal != null &&
      complianceSummaryTotal !== canonicalRequirementCount
    ) {
      out.push(
        failure({
          validationCode: "COUNT_DRIFT",
          severity: "CRITICAL",
          check: "cross-module",
          explanation: `Count drift: complianceSummary=${complianceSummaryTotal} ≠ canonical=${canonicalRequirementCount}`,
        }),
      );
    }
    if (
      counts.actionLinkedIdentityCount != null &&
      counts.actionLinkedIdentityCount > canonicalRequirementCount
    ) {
      out.push(
        failure({
          validationCode: "ACTION_CANONICAL_MISMATCH",
          severity: "CRITICAL",
          check: "cross-module",
          explanation: `Action identities (${counts.actionLinkedIdentityCount}) exceed canonical count (${canonicalRequirementCount}).`,
        }),
      );
    }
  }

  if (input.matrixRequirementIds) {
    for (const id of input.matrixRequirementIds) {
      if (!canonicalIds.has(id)) {
        out.push(
          failure({
            validationCode: "CROSS_MODULE_ID_MISMATCH",
            severity: "CRITICAL",
            check: "cross-module",
            explanation: `Compliance matrix references unknown requirement id ${id}.`,
            affectedCanonicalItemId: id,
          }),
        );
      }
    }
    if (input.matrixRequirementIds.length !== canonicalIds.size) {
      out.push(
        failure({
          validationCode: "COUNT_DRIFT",
          severity: "CRITICAL",
          check: "cross-module",
          explanation: `Matrix id count (${input.matrixRequirementIds.length}) ≠ canonical id count (${canonicalIds.size}).`,
        }),
      );
    }
  }

  if (input.readinessRequirementIds) {
    for (const id of input.readinessRequirementIds) {
      if (!canonicalIds.has(id)) {
        out.push(
          failure({
            validationCode: "CROSS_MODULE_ID_MISMATCH",
            severity: "HIGH",
            check: "cross-module",
            explanation: `Readiness references unknown requirement id ${id}.`,
            affectedCanonicalItemId: id,
          }),
        );
      }
    }
  }

  if (input.actions) {
    const byReq = new Map<string, number>();
    for (const action of input.actions) {
      if (action.simulationOnly) continue;
      if (
        action.sourceType === "APPROACHING_DEADLINE" ||
        action.sourceType === "DECISION_SIMULATOR"
      ) {
        continue;
      }
      if (!action.linkedRequirementId) continue;
      if (!canonicalIds.has(action.linkedRequirementId)) {
        out.push(
          failure({
            validationCode: "ACTION_CANONICAL_MISMATCH",
            severity: "CRITICAL",
            check: "cross-module",
            explanation: `Action references unknown requirement ${action.linkedRequirementId}: "${action.title.slice(0, 80)}"`,
            affectedCanonicalItemId: action.linkedRequirementId,
          }),
        );
      }
      byReq.set(
        action.linkedRequirementId,
        (byReq.get(action.linkedRequirementId) ?? 0) + 1,
      );
      if (
        action.blocking &&
        (action.sourceType === "UNVERIFIED_EVIDENCE" ||
          action.sourceType === "READINESS_BLOCKER" ||
          /verification required|needs_verification/i.test(action.title))
      ) {
        out.push(
          failure({
            validationCode: "VERIFICATION_MARKED_BLOCKING",
            severity: "CRITICAL",
            check: "cross-module",
            explanation: `NEEDS_VERIFICATION / verification action must not be blocking: "${action.title.slice(0, 80)}"`,
            affectedCanonicalItemId: action.linkedRequirementId,
          }),
        );
      }
    }
    for (const [reqId, count] of byReq) {
      if (count > 1) {
        out.push(
          failure({
            validationCode: "ACTION_CANONICAL_MISMATCH",
            severity: "HIGH",
            check: "cross-module",
            explanation: `Multiple primary actions for canonical requirement ${reqId} (${count}).`,
            affectedCanonicalItemId: reqId,
          }),
        );
      }
    }
  }

  return out;
}
