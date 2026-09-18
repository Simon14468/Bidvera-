/**
 * Regression: REQUIREMENT_CONDITION_LOST must not false-positive on PE disclaimers.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractConditionalObligationCues,
  extractHighRiskFactTokens,
  missingHighRiskTokens,
} from "@/domain/decision-validation/high-risk-facts";
import {
  assertDecisionGuardianReady,
  DecisionGuardianError,
  runDecisionGuardian,
} from "@/domain/decision-validation";
import type { DecisionGuardianInput } from "@/domain/decision-validation";

const IGL_PE_DISCLAIMER =
  "2) IGL in no way shall be responsible if the bidder fails to apply due to non-possession of Digital Signature & non-registration.";

const GENUINE_CONDITIONAL =
  "T-09 (conditional) If the bidder proposes equipment manufactured outside Morocco, the bidder must provide evidence of manufacturer authorization.";

function reqInput(requirement: string, evidenceText: string): DecisionGuardianInput {
  return {
    document: {
      textLength: 4000,
      readable: true,
      validityPassed: true,
      fileName: "Comm_Vol_CP18681.pdf",
    },
    requirements: [
      {
        id: "req-1",
        requirement,
        category: "MANDATORY_ADMINISTRATIVE",
        semanticKind: "REQUIRED_DOCUMENT",
        obligationStrength: "OPTIONAL",
        mandatory: false,
        sourceSection: "Administrative",
        page: 1,
        evidenceText,
        fitStatus: "NEEDS_VERIFICATION",
      },
    ],
    resolvedRequirementIds: ["req-1"],
    matrixRequirementIds: ["req-1"],
    readinessRequirementIds: ["req-1"],
    actions: [
      {
        linkedRequirementId: "req-1",
        blocking: false,
        sourceType: "MISSING_EVIDENCE",
        title: "Review",
        simulationOnly: false,
      },
    ],
    decision: {
      decision: "REVIEW",
      hardFailure: false,
      hardBlockerCount: 0,
      aiOverrodeCanonical: false,
    },
    deadline: {
      deadlineIso: "2026-03-27T15:00:00",
      deadlineTimezone: null,
      expectedLocalHour: 15,
      expectedLocalMinute: 0,
      expectedDateYmd: "2026-03-27",
      sourceEvidence: "Submission deadline: 27 March 2026 at 15:00",
    },
    requireDocumentValidity: true,
  };
}

describe("REQUIREMENT_CONDITION_LOST — token identity + PE disclaimer", () => {
  it("PE disclaimer with 'if the bidder fails' → no CONDITIONAL token / no false CONDITION_LOST", () => {
    assert.deepEqual(extractConditionalObligationCues(IGL_PE_DISCLAIMER), []);
    const tokens = extractHighRiskFactTokens(IGL_PE_DISCLAIMER);
    assert.ok(!tokens.some((t) => t.kind === "CONDITIONAL"));
    assert.ok(
      !tokens.some((t) => t.normalized === "conditional"),
      "must never invent literal token 'conditional'",
    );
    const missing = missingHighRiskTokens(IGL_PE_DISCLAIMER, IGL_PE_DISCLAIMER, [
      "CONDITIONAL",
    ]);
    assert.equal(missing.length, 0);

    const result = runDecisionGuardian(
      reqInput(IGL_PE_DISCLAIMER, IGL_PE_DISCLAIMER),
    );
    assert.ok(
      !result.blockingFailures.some(
        (f) => f.validationCode === "REQUIREMENT_CONDITION_LOST",
      ),
    );
  });

  it("genuine if applicable / (conditional) / if the bidder obligation → CONDITIONAL cue preserved", () => {
    const cues = extractConditionalObligationCues(GENUINE_CONDITIONAL);
    assert.ok(cues.some((c) => /\(conditional\)/i.test(c)));
    assert.ok(cues.some((c) => /if the bidder/i.test(c)));
    assert.ok(!cues.some((c) => c.toLowerCase() === "conditional"));

    const tokens = extractHighRiskFactTokens(GENUINE_CONDITIONAL);
    const conditional = tokens.filter((t) => t.kind === "CONDITIONAL");
    assert.ok(conditional.length >= 1);
    assert.ok(conditional.every((t) => t.normalized !== "conditional" || /\(conditional\)/.test(t.raw)));
    // Matched cue must survive when canonical keeps the same text
    assert.equal(
      missingHighRiskTokens(GENUINE_CONDITIONAL, GENUINE_CONDITIONAL, [
        "CONDITIONAL",
      ]).length,
      0,
    );
    // if applicable
    const applicable = "The bidder shall provide a bond if applicable.";
    assert.deepEqual(extractConditionalObligationCues(applicable), [
      "if applicable",
    ]);
  });

  it("genuine condition lost from canonical → Guardian still blocks", () => {
    const evidence = GENUINE_CONDITIONAL;
    const stripped =
      "T-09 The bidder must provide evidence of manufacturer authorization.";
    const missing = missingHighRiskTokens(evidence, stripped, ["CONDITIONAL"]);
    assert.ok(missing.length >= 1);
    assert.ok(missing.every((t) => t.kind === "CONDITIONAL"));
    assert.ok(missing.every((t) => t.normalized !== "conditional" || /\(/.test(t.raw)));

    const result = runDecisionGuardian(reqInput(stripped, evidence));
    assert.ok(
      result.blockingFailures.some(
        (f) => f.validationCode === "REQUIREMENT_CONDITION_LOST",
      ),
    );
    assert.throws(
      () => assertDecisionGuardianReady(reqInput(stripped, evidence)),
      (err: unknown) => err instanceof DecisionGuardianError,
    );
  });
});
