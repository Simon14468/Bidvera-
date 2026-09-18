/**
 * Decision integrity — NO_BID needs hard blockers; BID not with unresolved mandatory;
 * verification ≠ confirmed failure; AI must not override canonical.
 */

import { failure } from "../helpers";
import type { DecisionGuardianInput, GuardianValidationFailure } from "../types";

export function checkDecisionIntegrity(
  input: DecisionGuardianInput,
): GuardianValidationFailure[] {
  const d = input.decision;
  if (!d) return [];
  const out: GuardianValidationFailure[] = [];
  const decision = String(d.decision).toUpperCase().replace(/-/g, "_");

  if (
    (decision === "NO_BID" || decision === "NOBID") &&
    d.hardBlockerCount <= 0 &&
    !d.hardFailure
  ) {
    out.push(
      failure({
        validationCode: "DECISION_NO_BID_WITHOUT_BLOCKER",
        severity: "CRITICAL",
        check: "decision-integrity",
        explanation: "NO_BID released without a valid canonical hard blocker.",
      }),
    );
  }

  if (decision === "BID" || decision === "GO") {
    const unresolvedMandatory = input.requirements.filter(
      (r) =>
        r.mandatory &&
        (r.fitStatus === "NEEDS_VERIFICATION" ||
          r.fitStatus === "MISSING" ||
          r.fitStatus === "FAILED" ||
          r.fitStatus === "CONFIRMED_GAP"),
    );
    const confirmedGap = unresolvedMandatory.filter(
      (r) =>
        r.fitStatus === "CONFIRMED_GAP" ||
        r.fitStatus === "FAILED" ||
        r.fitStatus === "MISSING",
    );
    if (confirmedGap.length > 0) {
      out.push(
        failure({
          validationCode: "DECISION_BID_WITH_UNRESOLVED_MANDATORY",
          severity: "CRITICAL",
          check: "decision-integrity",
          explanation: `BID/GO while mandatory confirmed gaps remain (${confirmedGap.length}).`,
          affectedCanonicalItemId: confirmedGap[0]?.id ?? null,
        }),
      );
    } else if (
      unresolvedMandatory.some((r) => r.fitStatus === "NEEDS_VERIFICATION")
    ) {
      out.push(
        failure({
          validationCode: "DECISION_BID_WITH_UNRESOLVED_MANDATORY",
          severity: "HIGH",
          check: "decision-integrity",
          explanation:
            "BID/GO while mandatory verification remains unresolved — verification is not confirmed compliance.",
          affectedCanonicalItemId:
            unresolvedMandatory.find((r) => r.fitStatus === "NEEDS_VERIFICATION")?.id ??
            null,
        }),
      );
    }
  }

  if (d.aiOverrodeCanonical) {
    out.push(
      failure({
        validationCode: "DECISION_AI_OVERRIDE",
        severity: "CRITICAL",
        check: "decision-integrity",
        explanation: "AI advisory output overrode canonical evidence/rules.",
      }),
    );
  }

  if (
    d.aiSuggestedDecision &&
    d.hardFailure &&
    String(d.aiSuggestedDecision).toUpperCase().includes("BID") &&
    !String(d.aiSuggestedDecision).toUpperCase().includes("NO")
  ) {
    if (decision !== "NO_BID" && decision !== "NOBID") {
      out.push(
        failure({
          validationCode: "DECISION_AI_OVERRIDE",
          severity: "CRITICAL",
          check: "decision-integrity",
          explanation:
            "Hard failure present but final decision is not NO_BID — possible AI override of canonical blockers.",
        }),
      );
    }
  }

  if (input.fit) {
    const { fitScore, fitBreakdownOverall, reasoning } = input.fit;
    if (
      fitScore != null &&
      fitBreakdownOverall != null &&
      fitScore !== fitBreakdownOverall
    ) {
      out.push(
        failure({
          validationCode: "FIT_INCONSISTENCY",
          severity: "CRITICAL",
          check: "decision-integrity",
          explanation: `Fit inconsistency — fitScore=${fitScore} vs fitBreakdown.overall=${fitBreakdownOverall}`,
        }),
      );
    }
    if (reasoning && fitScore != null) {
      const m = reasoning.match(/(\d+)%\s+company[–\-]?tender fit/i);
      if (m && Number(m[1]) !== fitScore) {
        out.push(
          failure({
            validationCode: "FIT_INCONSISTENCY",
            severity: "HIGH",
            check: "decision-integrity",
            explanation: `Fit inconsistency — reasoning cites ${m[1]}% but fitScore=${fitScore}`,
          }),
        );
      }
    }
  }

  return out;
}
