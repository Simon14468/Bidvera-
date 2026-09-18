/**
 * Decision Validation Guardian — unit + integration tests.
 * Structured-data only; no OCR / LLM / full pipeline re-run.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDecisionGuardianReady,
  buildDecisionGuardianInput,
  DecisionGuardianError,
  runDecisionGuardian,
} from "@/domain/decision-validation";
import type { DecisionGuardianInput } from "@/domain/decision-validation";

function baseInput(
  overrides: Partial<DecisionGuardianInput> = {},
): DecisionGuardianInput {
  const requirements = [
    {
      id: "T-01",
      requirement:
        "T-01 The bidder must be legally registered and authorized to operate in Morocco.",
      category: "MANDATORY_ELIGIBILITY",
      semanticKind: "ELIGIBILITY_REQUIREMENT",
      obligationStrength: "MANDATORY",
      mandatory: true,
      sourceSection: "1. Mandatory Administrative Requirements",
      page: 1,
      evidenceText:
        "T-01 The bidder must be legally registered and authorized to operate in Morocco.",
      companyEvidenceText: "Company registration certificate — Morocco — verified.",
      hasCompanyEvidence: true,
      fitStatus: "CONFIRMED_FIT",
    },
    {
      id: "T-09",
      requirement:
        "T-09 (conditional) If the bidder proposes equipment manufactured outside Morocco, the bidder must provide evidence of manufacturer authorization.",
      category: "MANDATORY_ADMINISTRATIVE",
      semanticKind: "REQUIRED_DOCUMENT",
      obligationStrength: "CONDITIONAL",
      mandatory: false,
      sourceSection: "5. Conditional Requirement",
      page: 3,
      evidenceText:
        "T-09 (conditional) If the bidder proposes equipment manufactured outside Morocco, the bidder must provide evidence of manufacturer authorization.",
      fitStatus: "NEEDS_VERIFICATION",
    },
  ];
  return {
    document: {
      textLength: 5000,
      readable: true,
      validityPassed: true,
      fileName: "test.pdf",
    },
    requirements,
    resolvedRequirementIds: requirements.map((r) => r.id),
    matrixRequirementIds: requirements.map((r) => r.id),
    readinessRequirementIds: requirements.map((r) => r.id),
    actions: requirements.map((r) => ({
      linkedRequirementId: r.id,
      blocking: false,
      sourceType: "MISSING_EVIDENCE",
      title: `Provide evidence: ${r.requirement.slice(0, 40)}`,
      simulationOnly: false,
    })),
    decision: {
      decision: "REVIEW",
      hardFailure: false,
      hardBlockerCount: 0,
      aiOverrodeCanonical: false,
    },
    deadline: {
      deadlineIso: "2026-10-15T10:30:00+01:00",
      deadlineTimezone: "Africa/Casablanca",
      expectedLocalHour: 10,
      expectedLocalMinute: 30,
      expectedDateYmd: "2026-10-15",
      sourceEvidence: "Submission deadline: 15 October 2026 at 10:30",
    },
    fit: {
      fitScore: 72,
      fitBreakdownOverall: 72,
      reasoning: "72% company–tender fit with residual verification items.",
    },
    counts: {
      canonicalRequirementCount: 2,
      matrixCount: 2,
      readinessCount: 2,
      complianceSummaryTotal: 2,
      actionLinkedIdentityCount: 2,
    },
    requireDocumentValidity: true,
    ...overrides,
  };
}

describe("Decision Guardian — happy path", () => {
  it("passes a consistent structured payload in milliseconds", () => {
    const result = runDecisionGuardian(baseInput());
    assert.equal(result.ok, true);
    assert.equal(result.blockingFailures.length, 0);
    assert.ok(result.durationMs < 5000);
    assert.ok(result.checksRun.includes("canonical-boundary"));
    assert.ok(result.checksRun.includes("deadlines"));
    assert.doesNotThrow(() => assertDecisionGuardianReady(baseInput()));
  });
});

describe("Decision Guardian — document integrity", () => {
  it("fail-closes on unreadable document", () => {
    const result = runDecisionGuardian(
      baseInput({
        document: {
          textLength: 10,
          readable: false,
          validityPassed: false,
          validityReason: "UNREADABLE",
          fileName: "blank.pdf",
        },
      }),
    );
    assert.equal(result.ok, false);
    assert.ok(
      result.blockingFailures.some((f) => f.validationCode === "DOCUMENT_UNREADABLE"),
    );
  });

  it("fail-closes when validity gate failed", () => {
    const result = runDecisionGuardian(
      baseInput({
        document: {
          textLength: 5000,
          readable: true,
          validityPassed: false,
          validityReason: "NOT_A_TENDER_DOCUMENT",
        },
      }),
    );
    assert.ok(
      result.blockingFailures.some((f) => f.validationCode === "DOCUMENT_INVALID"),
    );
  });
});

describe("Decision Guardian — canonical boundary", () => {
  it("rejects QA/meta and evaluation leaks", () => {
    const result = runDecisionGuardian(
      baseInput({
        requirements: [
          {
            id: "bad-1",
            requirement:
              "These percentages describe evaluation only. They are not bidder requirements and must not become separate compliance requirements.",
            category: "EVALUATION",
            semanticKind: "QA_META",
            obligationStrength: "INFORMATIONAL",
            mandatory: false,
            sourceSection: "6. Evaluation — Not a Tender Requirement",
          },
        ],
        resolvedRequirementIds: ["bad-1"],
        matrixRequirementIds: ["bad-1"],
        readinessRequirementIds: ["bad-1"],
        actions: [],
        counts: {
          canonicalRequirementCount: 1,
          matrixCount: 1,
          readinessCount: 1,
          complianceSummaryTotal: 1,
          actionLinkedIdentityCount: 0,
        },
      }),
    );
    assert.equal(result.ok, false);
    assert.ok(
      result.blockingFailures.some(
        (f) =>
          f.validationCode === "CANONICAL_QA_META" ||
          f.validationCode === "CANONICAL_NON_REQUIREMENT",
      ),
    );
  });

  it("rejects heading false positives", () => {
    const result = runDecisionGuardian(
      baseInput({
        requirements: [
          {
            id: "h1",
            requirement: "2. Mandatory Administrative and Eligibility Requirements",
            category: "INFORMATIONAL",
            semanticKind: "INFORMATIONAL_FACT",
            obligationStrength: "INFORMATIONAL",
            mandatory: false,
            sourceSection: null,
          },
        ],
        resolvedRequirementIds: ["h1"],
        matrixRequirementIds: ["h1"],
        readinessRequirementIds: ["h1"],
        actions: [],
        counts: {
          canonicalRequirementCount: 1,
          matrixCount: 1,
          readinessCount: 1,
          complianceSummaryTotal: 1,
          actionLinkedIdentityCount: 0,
        },
      }),
    );
    assert.equal(result.ok, false);
  });
});

describe("Decision Guardian — conditionality & completeness", () => {
  it("rejects conditional promoted to mandatory", () => {
    const result = runDecisionGuardian(
      baseInput({
        requirements: [
          {
            id: "T-09",
            requirement:
              "T-09 (conditional) If the bidder proposes equipment manufactured outside Morocco, the bidder must provide evidence of manufacturer authorization.",
            category: "MANDATORY_ADMINISTRATIVE",
            semanticKind: "REQUIRED_DOCUMENT",
            obligationStrength: "CONDITIONAL",
            mandatory: true,
            sourceSection: "5. Conditional Requirement",
          },
        ],
        resolvedRequirementIds: ["T-09"],
        matrixRequirementIds: ["T-09"],
        readinessRequirementIds: ["T-09"],
        actions: [
          {
            linkedRequirementId: "T-09",
            blocking: false,
            sourceType: "MISSING_EVIDENCE",
            title: "Provide evidence T-09",
          },
        ],
        counts: {
          canonicalRequirementCount: 1,
          matrixCount: 1,
          readinessCount: 1,
          complianceSummaryTotal: 1,
          actionLinkedIdentityCount: 1,
        },
      }),
    );
    assert.ok(
      result.blockingFailures.some(
        (f) => f.validationCode === "CONDITIONAL_PROMOTED_TO_MANDATORY",
      ),
    );
  });

  it("rejects lost conditional context", () => {
    const result = runDecisionGuardian(
      baseInput({
        requirements: [
          {
            id: "T-09",
            requirement: "T-09 The bidder must provide manufacturer authorization.",
            category: "MANDATORY_ADMINISTRATIVE",
            semanticKind: "REQUIRED_DOCUMENT",
            obligationStrength: "CONDITIONAL",
            mandatory: false,
            sourceSection: "5. Conditional Requirement",
          },
        ],
        resolvedRequirementIds: ["T-09"],
        matrixRequirementIds: ["T-09"],
        readinessRequirementIds: ["T-09"],
        actions: [
          {
            linkedRequirementId: "T-09",
            blocking: false,
            sourceType: "MISSING_EVIDENCE",
            title: "Provide evidence T-09",
          },
        ],
        counts: {
          canonicalRequirementCount: 1,
          matrixCount: 1,
          readinessCount: 1,
          complianceSummaryTotal: 1,
          actionLinkedIdentityCount: 1,
        },
      }),
    );
    assert.ok(
      result.blockingFailures.some(
        (f) => f.validationCode === "REQUIREMENT_CONDITION_LOST",
      ),
    );
  });
});

describe("Decision Guardian — deadlines", () => {
  it("rejects 10:30 → 01:00 mutation", () => {
    // Midnight UTC stored as ISO then shown in Casablanca as 01:00
    const result = runDecisionGuardian(
      baseInput({
        deadline: {
          deadlineIso: "2026-10-15T00:00:00.000Z",
          deadlineTimezone: "Africa/Casablanca",
          expectedLocalHour: 10,
          expectedLocalMinute: 30,
          expectedDateYmd: "2026-10-15",
          sourceEvidence: "Submission deadline: 15 October 2026 at 10:30",
        },
      }),
    );
    assert.equal(result.ok, false);
    assert.ok(
      result.blockingFailures.some((f) => f.validationCode === "DEADLINE_TIME_MUTATED"),
    );
  });
});

describe("Decision Guardian — semantic identity & counts", () => {
  it("rejects duplicate semantic obligations", () => {
    const dup = {
      id: "a",
      requirement: "The bidder must provide a provisional bid security of MAD 12,000.",
      category: "MANDATORY_ADMINISTRATIVE",
      semanticKind: "GUARANTEE_SECURITY_REQUIREMENT",
      obligationStrength: "MANDATORY",
      mandatory: true,
      sourceSection: "Admin",
    };
    const result = runDecisionGuardian(
      baseInput({
        requirements: [dup, { ...dup, id: "b", sourceSection: "Docs" }],
        resolvedRequirementIds: ["a", "b"],
        matrixRequirementIds: ["a", "b"],
        readinessRequirementIds: ["a", "b"],
        actions: [
          {
            linkedRequirementId: "a",
            blocking: false,
            sourceType: "MISSING_EVIDENCE",
            title: "a",
          },
          {
            linkedRequirementId: "b",
            blocking: false,
            sourceType: "MISSING_EVIDENCE",
            title: "b",
          },
        ],
        counts: {
          canonicalRequirementCount: 2,
          matrixCount: 2,
          readinessCount: 2,
          complianceSummaryTotal: 2,
          actionLinkedIdentityCount: 2,
        },
      }),
    );
    assert.ok(
      result.blockingFailures.some(
        (f) => f.validationCode === "DUPLICATE_SEMANTIC_IDENTITY",
      ),
    );
  });

  it("rejects count drift across modules", () => {
    const result = runDecisionGuardian(
      baseInput({
        counts: {
          canonicalRequirementCount: 2,
          matrixCount: 18,
          readinessCount: 12,
          complianceSummaryTotal: 12,
          actionLinkedIdentityCount: 2,
        },
      }),
    );
    assert.ok(
      result.blockingFailures.some(
        (f) =>
          f.validationCode === "COUNT_DRIFT" ||
          f.validationCode === "REPORT_DATASET_MISMATCH",
      ),
    );
  });
});

describe("Decision Guardian — decision & actions", () => {
  it("rejects NO_BID without hard blockers", () => {
    const result = runDecisionGuardian(
      baseInput({
        decision: {
          decision: "NO_BID",
          hardFailure: false,
          hardBlockerCount: 0,
        },
      }),
    );
    assert.ok(
      result.blockingFailures.some(
        (f) => f.validationCode === "DECISION_NO_BID_WITHOUT_BLOCKER",
      ),
    );
  });

  it("rejects BID with confirmed mandatory gap", () => {
    const result = runDecisionGuardian(
      baseInput({
        requirements: [
          {
            id: "T-01",
            requirement: "T-01 The bidder must be legally registered in Morocco.",
            category: "MANDATORY_ELIGIBILITY",
            semanticKind: "ELIGIBILITY_REQUIREMENT",
            obligationStrength: "MANDATORY",
            mandatory: true,
            sourceSection: "1. Admin",
            fitStatus: "CONFIRMED_GAP",
          },
        ],
        resolvedRequirementIds: ["T-01"],
        matrixRequirementIds: ["T-01"],
        readinessRequirementIds: ["T-01"],
        actions: [
          {
            linkedRequirementId: "T-01",
            blocking: false,
            sourceType: "MISSING_EVIDENCE",
            title: "gap",
          },
        ],
        decision: {
          decision: "BID",
          hardFailure: false,
          hardBlockerCount: 0,
        },
        counts: {
          canonicalRequirementCount: 1,
          matrixCount: 1,
          readinessCount: 1,
          complianceSummaryTotal: 1,
          actionLinkedIdentityCount: 1,
        },
      }),
    );
    assert.ok(
      result.blockingFailures.some(
        (f) => f.validationCode === "DECISION_BID_WITH_UNRESOLVED_MANDATORY",
      ),
    );
  });

  it("rejects verification-only actions marked blocking", () => {
    const result = runDecisionGuardian(
      baseInput({
        actions: [
          {
            linkedRequirementId: "T-01",
            blocking: true,
            sourceType: "UNVERIFIED_EVIDENCE",
            title: "Verification required — confirm against company records.",
          },
          {
            linkedRequirementId: "T-09",
            blocking: false,
            sourceType: "MISSING_EVIDENCE",
            title: "Provide evidence T-09",
          },
        ],
      }),
    );
    assert.ok(
      result.blockingFailures.some(
        (f) => f.validationCode === "VERIFICATION_MARKED_BLOCKING",
      ),
    );
  });

  it("rejects AI override of canonical rules", () => {
    const result = runDecisionGuardian(
      baseInput({
        decision: {
          decision: "BID",
          hardFailure: true,
          hardBlockerCount: 1,
          aiOverrodeCanonical: true,
        },
      }),
    );
    assert.ok(
      result.blockingFailures.some((f) => f.validationCode === "DECISION_AI_OVERRIDE"),
    );
  });

  it("throws DecisionGuardianError with structured payload on assert", () => {
    assert.throws(
      () =>
        assertDecisionGuardianReady(
          baseInput({
            decision: {
              decision: "NO_BID",
              hardFailure: false,
              hardBlockerCount: 0,
            },
          }),
        ),
      (err: unknown) => {
        assert.ok(err instanceof DecisionGuardianError);
        assert.equal(err.code, "DECISION_GUARDIAN_FAILED");
        assert.ok(err.result.blockingFailures.length >= 1);
        assert.ok(err.result.blockingFailures[0]!.validationCode);
        assert.ok(err.result.blockingFailures[0]!.explanation);
        return true;
      },
    );
  });
});

describe("Decision Guardian — buildDecisionGuardianInput adapter", () => {
  it("maps pipeline objects into guardian input without reinterpretation", () => {
    const input = buildDecisionGuardianInput({
      textLength: 4000,
      readable: true,
      validityPassed: true,
      fileName: "tender.pdf",
      requirements: [
        {
          id: "r1",
          description: "The bidder must submit a tax clearance certificate.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
          sourceSection: "Admin",
          fitStatus: "NEEDS_VERIFICATION",
        },
      ],
      matrix: [{ requirementId: "r1" }],
      readinessItems: [{ id: "r1" }],
      actions: [
        {
          linkedRequirementId: "r1",
          blocking: false,
          sourceType: "MISSING_EVIDENCE",
          title: "Provide tax clearance",
        },
      ],
      decision: {
        decision: "REVIEW",
        hardBlockerCount: 0,
      },
      fitScore: 55,
      fitBreakdownOverall: 55,
      complianceSummaryTotal: 1,
    });
    const result = runDecisionGuardian(input);
    assert.equal(result.ok, true);
    assert.equal(input.counts?.canonicalRequirementCount, 1);
  });
});
