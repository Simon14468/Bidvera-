/**
 * Prompt 2 — Evidence, source validation & speed regressions.
 * Fast structured validation only — no OCR / LLM / pipeline rebuild.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDecisionGuardianReady,
  buildDecisionGuardianInput,
  extractHighRiskFactTokens,
  hashCanonicalRequirementSet,
  runDecisionGuardian,
} from "@/domain/decision-validation";
import type { DecisionGuardianInput } from "@/domain/decision-validation";

function base(overrides: Partial<DecisionGuardianInput> = {}): DecisionGuardianInput {
  const requirements = [
    {
      id: "T-08",
      requirement:
        "T-08 Prices shall remain firm and non-revisable throughout the contract period.",
      category: "CONTRACTUAL",
      semanticKind: "FINANCIAL_COMMERCIAL_CONDITION",
      obligationStrength: "MANDATORY",
      mandatory: true,
      sourceSection: "4. Commercial and Contractual Conditions",
      evidenceText:
        "T-08 Prices shall remain firm and non-revisable throughout the contract period.",
      fitStatus: "NEEDS_VERIFICATION",
    },
    {
      id: "g1",
      requirement:
        "A performance guarantee equal to 10% of the contract value shall be provided by the successful bidder.",
      category: "MANDATORY_ADMINISTRATIVE",
      semanticKind: "GUARANTEE_SECURITY_REQUIREMENT",
      obligationStrength: "MANDATORY",
      mandatory: true,
      sourceSection: "4. Commercial and Contractual Conditions",
      evidenceText:
        "A performance guarantee equal to 10% of the contract value shall be provided by the successful bidder.",
      fitStatus: "NEEDS_VERIFICATION",
    },
  ];
  return {
    document: {
      textLength: 8000,
      readable: true,
      validityPassed: true,
      fileName: "prompt2.pdf",
    },
    requirements,
    resolvedRequirementIds: requirements.map((r) => r.id),
    matrixRequirementIds: requirements.map((r) => r.id),
    readinessRequirementIds: requirements.map((r) => r.id),
    actions: requirements.map((r) => ({
      linkedRequirementId: r.id,
      blocking: false,
      sourceType: "MISSING_EVIDENCE",
      title: `Provide evidence: ${r.id}`,
    })),
    decision: {
      decision: "REVIEW",
      hardFailure: false,
      hardBlockerCount: 0,
    },
    deadline: {
      deadlineIso: "2026-10-06T10:30:00+01:00",
      deadlineTimezone: "Africa/Casablanca",
      expectedLocalHour: 10,
      expectedLocalMinute: 30,
      expectedDateYmd: "2026-10-06",
      sourceEvidence: "Submission deadline: 6 October 2026 at 10:30",
    },
    fit: { fitScore: 60, fitBreakdownOverall: 60 },
    counts: {
      canonicalRequirementCount: 2,
      matrixCount: 2,
      readinessCount: 2,
      complianceSummaryTotal: 2,
      actionLinkedIdentityCount: 2,
    },
    derivedDeadline: {
      canonicalIso: "2026-10-06T10:30:00+01:00",
      canonicalTimezone: "Africa/Casablanca",
      representations: [
        {
          channel: "WEB",
          iso: "2026-10-06T10:30:00+01:00",
          timezone: "Africa/Casablanca",
          display: "Oct 6, 2026, 10:30",
        },
        {
          channel: "PDF",
          iso: "2026-10-06T10:30:00+01:00",
          timezone: "Africa/Casablanca",
          display: "06 Oct 2026 10:30 Africa/Casablanca",
        },
      ],
    },
    ...overrides,
  };
}

describe("Prompt 2 — high-risk fact tokens", () => {
  it("extracts amounts, percentages, refs, times, conditionals", () => {
    const tokens = extractHighRiskFactTokens(
      "T-09 (conditional) If the bidder proposes equipment at 10:30 with MAD 12,000 bond and 10% guarantee for 24 months.",
    );
    const kinds = new Set(tokens.map((t) => t.kind));
    assert.ok(kinds.has("REQUIREMENT_REF"));
    assert.ok(kinds.has("CONDITIONAL"));
    assert.ok(kinds.has("TIME"));
    assert.ok(kinds.has("CURRENCY_AMOUNT"));
    assert.ok(kinds.has("PERCENTAGE"));
    assert.ok(kinds.has("DURATION"));
  });
});

describe("Prompt 2 — wrong timezone / derived deadline", () => {
  it("rejects wrong timezone mutation 10:30 → 01:00 on derived channels", () => {
    const result = runDecisionGuardian(
      base({
        derivedDeadline: {
          canonicalIso: "2026-10-06T10:30:00+01:00",
          canonicalTimezone: "Africa/Casablanca",
          representations: [
            {
              channel: "WEB",
              iso: "2026-10-06T00:00:00.000Z",
              timezone: "Africa/Casablanca",
              display: "Oct 6, 2026, 01:00",
            },
          ],
        },
      }),
    );
    assert.equal(result.ok, false);
    assert.ok(
      result.blockingFailures.some(
        (f) => f.validationCode === "DERIVED_FIELD_CONTRADICTS_CANONICAL",
      ),
    );
  });
});

describe("Prompt 2 — truncated / lost ID / lost conditional / wrong section", () => {
  it("flags truncated requirement", () => {
    const result = runDecisionGuardian(
      base({
        requirements: [
          {
            id: "x",
            requirement: "Must submit.",
            category: "MANDATORY_ADMINISTRATIVE",
            semanticKind: "REQUIRED_DOCUMENT",
            obligationStrength: "MANDATORY",
            mandatory: true,
            sourceSection: "Admin",
          },
        ],
        resolvedRequirementIds: ["x"],
        matrixRequirementIds: ["x"],
        readinessRequirementIds: ["x"],
        actions: [
          {
            linkedRequirementId: "x",
            blocking: false,
            sourceType: "MISSING_EVIDENCE",
            title: "x",
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
      result.blockingFailures.some((f) => f.validationCode === "REQUIREMENT_TRUNCATED"),
    );
  });

  it("flags lost requirement ID between evidence and canonical text", () => {
    const result = runDecisionGuardian(
      base({
        requirements: [
          {
            id: "T-09",
            requirement:
              "If the bidder proposes equipment manufactured outside Morocco, the bidder must provide manufacturer authorization.",
            category: "MANDATORY_ADMINISTRATIVE",
            semanticKind: "REQUIRED_DOCUMENT",
            obligationStrength: "CONDITIONAL",
            mandatory: false,
            sourceSection: "5. Conditional Requirement",
            evidenceText:
              "T-09 (conditional) If the bidder proposes equipment manufactured outside Morocco, the bidder must provide manufacturer authorization.",
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
            title: "T-09",
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
        (f) =>
          f.validationCode === "REQUIREMENT_ID_LOST" ||
          f.validationCode === "REQUIREMENT_CONDITION_LOST" ||
          f.validationCode === "HIGH_RISK_FACT_MUTATED",
      ),
    );
  });

  it("flags wrong section provenance (title-like)", () => {
    const result = runDecisionGuardian(
      base({
        requirements: [
          {
            id: "T-01",
            requirement: "T-01 The bidder must be legally registered in Morocco.",
            category: "MANDATORY_ELIGIBILITY",
            semanticKind: "ELIGIBILITY_REQUIREMENT",
            obligationStrength: "MANDATORY",
            mandatory: true,
            sourceSection: "Subject: Supply of network equipment",
            evidenceText: "T-01 The bidder must be legally registered in Morocco.",
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
            title: "T-01",
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
        (f) => f.validationCode === "REQUIREMENT_PROVENANCE_WRONG",
      ),
    );
  });
});

describe("Prompt 2 — commercial, duplicates, QA/evaluation/reviewer leaks", () => {
  it("flags missing commercial obligation cue", () => {
    const result = runDecisionGuardian(
      base({
        expectedCommercialCues: ["payment shall", "penalties"],
      }),
    );
    assert.ok(
      result.blockingFailures.some(
        (f) => f.validationCode === "MISSING_COMMERCIAL_OBLIGATION",
      ),
    );
  });

  it("flags duplicate obligation", () => {
    const row = {
      id: "a",
      requirement: "The bidder must provide a provisional bid security of MAD 12,000.",
      category: "MANDATORY_ADMINISTRATIVE",
      semanticKind: "GUARANTEE_SECURITY_REQUIREMENT",
      obligationStrength: "MANDATORY",
      mandatory: true,
      sourceSection: "Admin",
    };
    const result = runDecisionGuardian(
      base({
        requirements: [row, { ...row, id: "b", sourceSection: "Docs" }],
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

  it("flags false QA / evaluation / reviewer scenario leaks", () => {
    const cases = [
      {
        id: "qa",
        requirement:
          "This section contains instructions to an analysis system and must not be interpreted as a bidder obligation. Not a Tender Requirement.",
        semanticKind: "QA_META",
        code: "CANONICAL_QA_META",
      },
      {
        id: "eval",
        requirement: "Technical compliance: 45% · Price: 40%",
        semanticKind: "EVALUATION_CRITERION",
        code: "CANONICAL_EVALUATION_LEAK",
      },
      {
        id: "rev",
        requirement:
          "Scenario A: A reviewer checks whether tax certificates are current.",
        semanticKind: "TEST_SCENARIO",
        code: "REVIEWER_SCENARIO_LEAK",
      },
    ] as const;

    for (const c of cases) {
      const result = runDecisionGuardian(
        base({
          requirements: [
            {
              id: c.id,
              requirement: c.requirement,
              category: "INFORMATIONAL",
              semanticKind: c.semanticKind,
              obligationStrength: "INFORMATIONAL",
              mandatory: false,
              sourceSection: "Meta",
            },
          ],
          resolvedRequirementIds: [c.id],
          matrixRequirementIds: [c.id],
          readinessRequirementIds: [c.id],
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
      assert.equal(result.ok, false, c.id);
      assert.ok(
        result.blockingFailures.some(
          (f) =>
            f.validationCode === c.code ||
            f.validationCode === "CANONICAL_NON_REQUIREMENT" ||
            f.validationCode === "CANONICAL_QA_META",
        ),
        `${c.id} expected ${c.code}, got ${result.blockingFailures.map((f) => f.validationCode).join(",")}`,
      );
    }
  });
});

describe("Prompt 2 — count drift, stale result, contradictions, AI, evidence rules", () => {
  it("flags count drift", () => {
    const result = runDecisionGuardian(
      base({
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

  it("flags stale result mismatch", () => {
    const hashA = hashCanonicalRequirementSet([
      { id: "1", requirement: "a", semanticKind: "TECHNICAL_REQUIREMENT" },
    ]);
    const hashB = hashCanonicalRequirementSet([
      { id: "1", requirement: "b", semanticKind: "TECHNICAL_REQUIREMENT" },
    ]);
    const result = runDecisionGuardian(
      base({
        staleResult: {
          canonicalContentHash: hashA,
          projectedContentHash: hashB,
        },
      }),
    );
    assert.ok(
      result.blockingFailures.some((f) => f.validationCode === "STALE_RESULT_MISMATCH"),
    );
  });

  it("flags contradictory source clauses without silent resolution", () => {
    const result = runDecisionGuardian(
      base({
        contradictions: [
          {
            id: "con-1",
            affectedCanonicalItemIds: ["g1"],
            sourceA: "Section 4: performance guarantee 10%",
            sourceB: "Section 9: performance guarantee 5%",
            conflictType: "PERCENTAGE",
            severity: "HIGH",
            explanation: "Conflicting performance guarantee percentages.",
            requiredHumanVerification: true,
          },
        ],
      }),
    );
    assert.ok(
      result.blockingFailures.some((f) => f.validationCode === "SOURCE_CONTRADICTION"),
    );
    assert.ok(result.contradictions.some((c) => c.requiredHumanVerification));
  });

  it("flags unsupported AI claim affecting decision", () => {
    const result = runDecisionGuardian(
      base({
        aiClaims: [
          {
            claim: "Bidder automatically meets all ISO requirements.",
            groundedInTender: false,
            groundedInCompanyEvidence: false,
            affectsDecision: true,
          },
        ],
      }),
    );
    assert.ok(
      result.blockingFailures.some((f) => f.validationCode === "UNSUPPORTED_AI_CLAIM"),
    );
  });

  it("flags CONFIRMED_GAP when only tender text is present", () => {
    const result = runDecisionGuardian(
      base({
        requirements: [
          {
            id: "T-01",
            requirement: "T-01 The bidder must be legally registered in Morocco.",
            category: "MANDATORY_ELIGIBILITY",
            semanticKind: "ELIGIBILITY_REQUIREMENT",
            obligationStrength: "MANDATORY",
            mandatory: true,
            sourceSection: "1. Admin",
            evidenceText: "T-01 The bidder must be legally registered in Morocco.",
            fitStatus: "CONFIRMED_GAP",
            hasCompanyEvidence: false,
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
            title: "T-01",
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
        (f) => f.validationCode === "EVIDENCE_MISSING_FOR_CONFIRMED_GAP",
      ),
    );
  });

  it("flags CONFIRMED_FIT without company evidence", () => {
    const result = runDecisionGuardian(
      base({
        requirements: [
          {
            id: "T-01",
            requirement: "T-01 The bidder must be legally registered in Morocco.",
            category: "MANDATORY_ELIGIBILITY",
            semanticKind: "ELIGIBILITY_REQUIREMENT",
            obligationStrength: "MANDATORY",
            mandatory: true,
            sourceSection: "1. Admin",
            evidenceText: "T-01 The bidder must be legally registered in Morocco.",
            fitStatus: "CONFIRMED_FIT",
            hasCompanyEvidence: false,
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
            title: "T-01",
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
        (f) => f.validationCode === "EVIDENCE_MISSING_FOR_CONFIRMED_FIT",
      ),
    );
  });

  it("flags NEEDS_VERIFICATION escalated to HIGH risk", () => {
    const result = runDecisionGuardian(
      base({
        risks: [
          {
            id: "risk-1",
            requirementId: "T-08",
            severity: "HIGH",
            fitStatus: "NEEDS_VERIFICATION",
            evidenceState: "NEEDS_VERIFICATION",
            title: "Unverified pricing firmness",
          },
        ],
      }),
    );
    assert.ok(
      result.blockingFailures.some(
        (f) => f.validationCode === "VERIFICATION_ESCALATED_TO_HIGH_RISK",
      ),
    );
  });

  it("flags external overwrite of tender fact", () => {
    const result = runDecisionGuardian(
      base({
        externalClaims: [
          {
            source: "web-search",
            url: "https://example.com",
            retrievedAt: new Date().toISOString(),
            claim: "Deadline is 01:00",
            confidence: "MEDIUM",
            affectsDecisionLogic: true,
            relatedFactKey: "deadline",
            overwritesTenderValue: "2026-10-06T01:00:00+01:00",
            tenderAuthoritativeValue: "2026-10-06T10:30:00+01:00",
          },
        ],
      }),
    );
    assert.ok(
      result.blockingFailures.some(
        (f) => f.validationCode === "EXTERNAL_OVERWRITE_TENDER_FACT",
      ),
    );
  });

  it("passes consistent commercial set quickly", () => {
    const input = buildDecisionGuardianInput({
      textLength: 5000,
      readable: true,
      validityPassed: true,
      requirements: base().requirements,
      matrix: base().matrixRequirementIds!.map((id) => ({ requirementId: id })),
      readinessItems: base().readinessRequirementIds!.map((id) => ({ id })),
      actions: base().actions,
      decision: base().decision!,
      deadline: base().deadline!,
      fitScore: 60,
      fitBreakdownOverall: 60,
      complianceSummaryTotal: 2,
      derivedDeadline: base().derivedDeadline!,
      expectedCommercialCues: ["firm", "performance guarantee"],
    });
    const result = runDecisionGuardian(input);
    assert.equal(result.ok, true);
    assert.ok(result.durationMs < 3000);
    assert.doesNotThrow(() => assertDecisionGuardianReady(input));
  });
});
