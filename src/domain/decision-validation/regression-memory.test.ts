/**
 * Permanent regression memory — one test per semantic failure class.
 * Does NOT match tender-specific sentences; validates failure classes.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  REGRESSION_MEMORY,
  assertRegressionMemoryCoverage,
  runDecisionGuardian,
  type DecisionGuardianInput,
  type GuardianValidationCode,
} from "@/domain/decision-validation";

function shell(
  overrides: Partial<DecisionGuardianInput> & {
    requirements: DecisionGuardianInput["requirements"];
  },
): DecisionGuardianInput {
  const reqs = overrides.requirements;
  const ids = reqs.map((r) => r.id);
  return {
    document: {
      textLength: 5000,
      readable: true,
      validityPassed: true,
      fileName: "regression.pdf",
    },
    resolvedRequirementIds: ids,
    matrixRequirementIds: ids,
    readinessRequirementIds: ids,
    actions: ids.map((id) => ({
      linkedRequirementId: id,
      blocking: false,
      sourceType: "MISSING_EVIDENCE",
      title: `Action ${id}`,
    })),
    decision: { decision: "REVIEW", hardBlockerCount: 0 },
    fit: { fitScore: 50, fitBreakdownOverall: 50 },
    counts: {
      canonicalRequirementCount: reqs.length,
      matrixCount: reqs.length,
      readinessCount: reqs.length,
      complianceSummaryTotal: reqs.length,
      actionLinkedIdentityCount: reqs.length,
    },
    ...overrides,
    requirements: reqs,
  };
}

const BUILDERS: Record<string, () => DecisionGuardianInput> = {
  "doc-unreadable": () =>
    shell({
      document: {
        textLength: 5,
        readable: false,
        validityPassed: false,
        validityReason: "UNREADABLE",
      },
      requirements: [],
      actions: [],
      counts: {
        canonicalRequirementCount: 0,
        matrixCount: 0,
        readinessCount: 0,
        complianceSummaryTotal: 0,
        actionLinkedIdentityCount: 0,
      },
    }),
  "doc-invalid-type": () =>
    shell({
      document: {
        textLength: 5000,
        readable: true,
        validityPassed: false,
        validityReason: "NOT_A_TENDER_DOCUMENT",
      },
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
        },
      ],
    }),
  "doc-insufficient-text": () =>
    shell({
      document: {
        textLength: 120,
        readable: true,
        validityPassed: true,
      },
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
        },
      ],
    }),
  "ext-truncated": () =>
    shell({
      requirements: [
        {
          id: "x",
          requirement: "Must submit.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
        },
      ],
    }),
  "ext-duplicate": () => {
    const row = {
      id: "a",
      requirement: "The bidder must provide a provisional bid security of MAD 12,000.",
      category: "MANDATORY_ADMINISTRATIVE",
      semanticKind: "GUARANTEE_SECURITY_REQUIREMENT",
      obligationStrength: "MANDATORY",
      mandatory: true,
      sourceSection: "Admin",
    };
    return shell({
      requirements: [row, { ...row, id: "b", sourceSection: "Docs" }],
    });
  },
  "ext-false-obligation": () =>
    shell({
      requirements: [
        {
          id: "qa",
          requirement:
            "Instructions to an analysis system. Not a Tender Requirement. Must not be extracted as bidder obligations.",
          category: "INFORMATIONAL",
          semanticKind: "QA_META",
          obligationStrength: "INFORMATIONAL",
          mandatory: false,
          sourceSection: "QA — Not a Tender Requirement",
        },
      ],
    }),
  "cls-evaluation": () =>
    shell({
      requirements: [
        {
          id: "ev",
          requirement: "Technical compliance: 45% · Price: 40%",
          category: "EVALUATION",
          semanticKind: "EVALUATION_CRITERION",
          obligationStrength: "INFORMATIONAL",
          mandatory: false,
        },
      ],
    }),
  "cls-deadline": () =>
    shell({
      requirements: [
        {
          id: "dl",
          requirement: "Submission / closing deadline referenced in the tender package.",
          category: "INFORMATIONAL",
          semanticKind: "DEADLINE",
          obligationStrength: "INFORMATIONAL",
          mandatory: false,
        },
      ],
    }),
  "cls-reviewer": () =>
    shell({
      requirements: [
        {
          id: "rev",
          requirement:
            "Scenario A: A reviewer checks whether tax certificates are current.",
          category: "INFORMATIONAL",
          semanticKind: "TEST_SCENARIO",
          obligationStrength: "INFORMATIONAL",
          mandatory: false,
        },
      ],
    }),
  "cls-conditional-mandatory": () =>
    shell({
      requirements: [
        {
          id: "T-09",
          requirement:
            "T-09 (conditional) If the bidder proposes equipment manufactured outside Morocco, the bidder must provide manufacturer authorization.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "CONDITIONAL",
          mandatory: true,
          sourceSection: "5. Conditional",
        },
      ],
    }),
  "data-timezone": () =>
    shell({
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
        },
      ],
      deadline: {
        deadlineIso: "2026-10-06T00:00:00.000Z",
        deadlineTimezone: "Africa/Casablanca",
        expectedLocalHour: 10,
        expectedLocalMinute: 30,
        expectedDateYmd: "2026-10-06",
      },
      derivedDeadline: {
        canonicalIso: "2026-10-06T10:30:00+01:00",
        canonicalTimezone: "Africa/Casablanca",
        representations: [
          {
            channel: "WEB",
            iso: "2026-10-06T00:00:00.000Z",
            timezone: "Africa/Casablanca",
            display: "01:00",
          },
        ],
      },
    }),
  "data-lost-id": () =>
    shell({
      requirements: [
        {
          id: "T-09",
          requirement:
            "If the bidder proposes equipment manufactured outside Morocco, the bidder must provide manufacturer authorization.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "CONDITIONAL",
          mandatory: false,
          evidenceText:
            "T-09 (conditional) If the bidder proposes equipment manufactured outside Morocco, the bidder must provide manufacturer authorization.",
          sourceSection: "5. Conditional",
        },
      ],
    }),
  "data-lost-condition": () =>
    shell({
      requirements: [
        {
          id: "T-09",
          requirement: "T-09 The bidder must provide manufacturer authorization.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "CONDITIONAL",
          mandatory: false,
          sourceSection: "5. Conditional",
        },
      ],
    }),
  "data-wrong-section": () =>
    shell({
      requirements: [
        {
          id: "T-01",
          requirement: "T-01 The bidder must be legally registered in Morocco.",
          category: "MANDATORY_ELIGIBILITY",
          semanticKind: "ELIGIBILITY_REQUIREMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
          sourceSection: "Subject: Network security infrastructure",
        },
      ],
    }),
  "data-missing-commercial": () =>
    shell({
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
        },
      ],
      expectedCommercialCues: ["performance guarantee", "payment shall"],
    }),
  "ev-unsupported-fit": () =>
    shell({
      requirements: [
        {
          id: "T-01",
          requirement: "T-01 The bidder must be legally registered in Morocco.",
          category: "MANDATORY_ELIGIBILITY",
          semanticKind: "ELIGIBILITY_REQUIREMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
          fitStatus: "CONFIRMED_FIT",
          hasCompanyEvidence: false,
          evidenceText: "T-01 The bidder must be legally registered in Morocco.",
        },
      ],
    }),
  "ev-unsupported-gap": () =>
    shell({
      requirements: [
        {
          id: "T-01",
          requirement: "T-01 The bidder must be legally registered in Morocco.",
          category: "MANDATORY_ELIGIBILITY",
          semanticKind: "ELIGIBILITY_REQUIREMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
          fitStatus: "CONFIRMED_GAP",
          hasCompanyEvidence: false,
        },
      ],
    }),
  "risk-verify-as-failure": () =>
    shell({
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
          fitStatus: "NEEDS_VERIFICATION",
        },
      ],
      risks: [
        {
          id: "risk1",
          requirementId: "r1",
          severity: "CRITICAL",
          fitStatus: "NEEDS_VERIFICATION",
          evidenceState: "NEEDS_VERIFICATION",
          title: "Unverified cert",
        },
      ],
    }),
  "dec-invalid-nobid": () =>
    shell({
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
        },
      ],
      decision: { decision: "NO_BID", hardFailure: false, hardBlockerCount: 0 },
    }),
  "dec-invalid-bid": () =>
    shell({
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
          fitStatus: "CONFIRMED_GAP",
          hasCompanyEvidence: true,
          companyEvidenceText: "Company lacks tax clearance.",
        },
      ],
      decision: { decision: "BID", hardFailure: false, hardBlockerCount: 0 },
    }),
  "dec-ai-override": () =>
    shell({
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
        },
      ],
      decision: {
        decision: "BID",
        hardFailure: true,
        hardBlockerCount: 1,
        aiOverrodeCanonical: true,
      },
    }),
  "act-verify-blocking": () =>
    shell({
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
        },
      ],
      actions: [
        {
          linkedRequirementId: "r1",
          blocking: true,
          sourceType: "UNVERIFIED_EVIDENCE",
          title: "Verification required — confirm against records.",
        },
      ],
    }),
  "act-orphan": () =>
    shell({
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
        },
      ],
      actions: [
        {
          linkedRequirementId: "missing-id",
          blocking: false,
          sourceType: "MISSING_EVIDENCE",
          title: "Orphan action",
        },
      ],
    }),
  "act-count-drift": () =>
    shell({
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
        },
      ],
      actions: [
        {
          linkedRequirementId: "r1",
          blocking: false,
          sourceType: "MISSING_EVIDENCE",
          title: "a1",
        },
        {
          linkedRequirementId: "r1",
          blocking: false,
          sourceType: "MISSING_EVIDENCE",
          title: "a2",
        },
      ],
      counts: {
        canonicalRequirementCount: 1,
        matrixCount: 1,
        readinessCount: 1,
        complianceSummaryTotal: 1,
        actionLinkedIdentityCount: 3,
      },
    }),
  "rep-count-mismatch": () =>
    shell({
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
        },
      ],
      counts: {
        canonicalRequirementCount: 1,
        matrixCount: 18,
        readinessCount: 12,
        complianceSummaryTotal: 12,
        actionLinkedIdentityCount: 1,
      },
    }),
  "rep-fit-mismatch": () =>
    shell({
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
        },
      ],
      fit: { fitScore: 72, fitBreakdownOverall: 45 },
    }),
  "rep-stale": () =>
    shell({
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
        },
      ],
      staleResult: {
        canonicalContentHash: "hash-a",
        projectedContentHash: "hash-b",
      },
    }),
  "rep-deadline-mismatch": () =>
    shell({
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
        },
      ],
      derivedDeadline: {
        canonicalIso: "2026-10-06T10:30:00+01:00",
        canonicalTimezone: "Africa/Casablanca",
        representations: [
          {
            channel: "PDF",
            iso: "2026-10-06T00:00:00.000Z",
            timezone: "Africa/Casablanca",
            display: "01:00",
          },
        ],
      },
    }),
  "src-external-overwrite": () =>
    shell({
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
        },
      ],
      externalClaims: [
        {
          source: "web",
          url: "https://example.com",
          retrievedAt: new Date().toISOString(),
          claim: "Deadline is 01:00",
          confidence: "MEDIUM",
          affectsDecisionLogic: true,
          relatedFactKey: "deadline",
          overwritesTenderValue: "01:00",
          tenderAuthoritativeValue: "10:30",
        },
      ],
    }),
  "src-unsupported-external": () =>
    shell({
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
        },
      ],
      externalClaims: [
        {
          source: "web",
          url: null,
          retrievedAt: null,
          claim: "Company is ISO certified worldwide",
          confidence: "UNKNOWN",
          affectsDecisionLogic: true,
        },
      ],
    }),
  "src-contradiction": () =>
    shell({
      requirements: [
        {
          id: "r1",
          requirement: "The bidder must submit a tax clearance certificate with the offer.",
          category: "MANDATORY_ADMINISTRATIVE",
          semanticKind: "REQUIRED_DOCUMENT",
          obligationStrength: "MANDATORY",
          mandatory: true,
        },
      ],
      contradictions: [
        {
          id: "c1",
          affectedCanonicalItemIds: ["r1"],
          sourceA: "Section 4: 10%",
          sourceB: "Section 9: 5%",
          conflictType: "PERCENTAGE",
          severity: "HIGH",
          explanation: "Conflicting guarantee percentages.",
          requiredHumanVerification: true,
        },
      ],
    }),
};

describe("regression memory catalog", () => {
  it("covers every architectural category", () => {
    assert.doesNotThrow(() => assertRegressionMemoryCoverage());
    assert.ok(REGRESSION_MEMORY.length >= 25);
  });

  for (const entry of REGRESSION_MEMORY) {
    it(`${entry.category}/${entry.failureClass} (${entry.id})`, () => {
      const builder = BUILDERS[entry.id];
      assert.ok(builder, `missing builder for ${entry.id}`);
      const result = runDecisionGuardian(builder());
      assert.equal(result.ok, false, `${entry.id} must fail-closed`);
      const codes = new Set(result.blockingFailures.map((f) => f.validationCode));
      const hit = entry.expectedCodes.some((c) => codes.has(c as GuardianValidationCode));
      assert.ok(
        hit,
        `${entry.id}: expected one of [${entry.expectedCodes.join(", ")}] got [${[...codes].join(", ")}]`,
      );
    });
  }
});
