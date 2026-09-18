import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDecisionGuardianReady,
  buildDecisionGuardianInput,
  DecisionGuardianError,
  runDecisionGuardian,
} from "@/domain/decision-validation";
import type { DecisionGuardianInput } from "@/domain/decision-validation";
import {
  DEADLINE_TIMEZONE_UNKNOWN,
  isDeadlineTimezoneUnknown,
  normalizeDeadlineTimezone,
} from "@/domain/tender-requirements/deadline-timezone";
import {
  buildDeadlineIsoWithLocalTime,
  extractExplicitTimezone,
  extractTenderDeadlineFromText,
} from "@/domain/tender-requirements/tender-deadline";

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
      sourceEvidence: "Submission deadline: 15 October 2026 at 10:30 Casablanca",
    },
    requireDocumentValidity: true,
    ...overrides,
  };
}

describe("deadline timezone UNKNOWN semantics", () => {
  it("1 — explicit timezone is preserved", () => {
    assert.equal(
      extractExplicitTimezone("Submission deadline 15 Oct 2026 at 10:30 Africa/Casablanca"),
      "Africa/Casablanca",
    );
    assert.equal(
      extractExplicitTimezone("Closing date 21 September 2026 at 15:00 IST"),
      "Asia/Kolkata",
    );
    const iso = buildDeadlineIsoWithLocalTime({
      dateYmd: "2026-10-15",
      hour: 10,
      minute: 30,
      timezone: "Africa/Casablanca",
    });
    assert.equal(iso, "2026-10-15T10:30:00+01:00");
    assert.equal(normalizeDeadlineTimezone("Africa/Casablanca"), "Africa/Casablanca");
    assert.equal(isDeadlineTimezoneUnknown("Africa/Casablanca"), false);
  });

  it("2 — missing timezone → UNKNOWN, no invented timezone", () => {
    assert.equal(extractExplicitTimezone("Opening 21 September 2026 at 15:00"), null);
    const parsed = extractTenderDeadlineFromText(
      "Submission deadline: 27 March 2026 at 15:00\n",
      "Morocco",
    );
    assert.ok(parsed.deadlineIso);
    assert.equal(parsed.deadlineTimezone, null);
    assert.match(parsed.reason ?? "", /UNKNOWN/i);
    assert.equal(parsed.deadlineIso, "2026-03-27T15:00:00");
    assert.ok(!parsed.deadlineIso.includes("+"), "must not invent UTC offset");
    assert.equal(isDeadlineTimezoneUnknown(null), true);
    assert.equal(isDeadlineTimezoneUnknown(DEADLINE_TIMEZONE_UNKNOWN), true);
    assert.equal(normalizeDeadlineTimezone(DEADLINE_TIMEZONE_UNKNOWN), null);
    assert.equal(normalizeDeadlineTimezone(null), null);
    // Country must not invent a zone at extractExplicitTimezone boundary
    assert.equal(extractExplicitTimezone("Deadline in Morocco 27 March 2026 at 15:00"), null);
  });

  it("3 — missing timezone + REVIEW → Guardian advisory only (no block / no loop)", () => {
    const input = baseInput({
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
    });
    const result = runDecisionGuardian(input);
    assert.ok(
      !result.blockingFailures.some((f) => f.validationCode === "DEADLINE_TIMEZONE_LOST"),
      "UNKNOWN timezone must not block REVIEW release",
    );
    assert.ok(
      result.advisoryFailures.some((f) => f.validationCode === "DEADLINE_TIMEZONE_LOST"),
      "UNKNOWN timezone remains visible as advisory",
    );
  });

  it("3b — missing timezone + BID remains blocked (GO unsafe)", () => {
    const input = baseInput({
      decision: {
        decision: "BID",
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
    });
    const result = runDecisionGuardian(input);
    assert.equal(result.ok, false);
    assert.ok(
      result.blockingFailures.some((f) => f.validationCode === "DEADLINE_TIMEZONE_LOST"),
    );
    assert.throws(
      () => assertDecisionGuardianReady(input),
      (err: unknown) => err instanceof DecisionGuardianError,
    );
  });

  it("4 — real deadline date/time remains unchanged when timezone UNKNOWN", () => {
    const parsed = extractTenderDeadlineFromText(
      "Closing date: 15 October 2026 at 10:30 local time\n",
      null,
    );
    assert.equal(parsed.deadlineIso, "2026-10-15T10:30:00");
    assert.equal(parsed.localHour, 10);
    assert.equal(parsed.localMinute, 30);
    assert.equal(parsed.deadlineTimezone, null);
  });

  it("5 — existing Guardian protections intact with explicit timezone", () => {
    const input = buildDecisionGuardianInput({
      textLength: 5000,
      readable: true,
      validityPassed: true,
      fileName: "ok.pdf",
      requirements: baseInput().requirements,
      matrix: baseInput().requirements.map((r) => ({ requirementId: r.id })),
      readinessItems: baseInput().requirements.map((r) => ({ id: r.id })),
      actions: baseInput().actions,
      decision: {
        decision: "REVIEW",
        hardFailure: false,
        hardBlockerCount: 0,
      },
      deadline: {
        deadlineIso: "2026-10-15T10:30:00+01:00",
        deadlineTimezone: "Africa/Casablanca",
        expectedLocalHour: 10,
        expectedLocalMinute: 30,
        expectedDateYmd: "2026-10-15",
        sourceEvidence: "Submission deadline: 15 October 2026 at 10:30 Casablanca",
      },
      fitScore: 70,
      fitBreakdownOverall: 70,
      reasoning: "Review",
      complianceSummaryTotal: 1,
    });
    const result = runDecisionGuardian(input);
    assert.ok(
      !result.blockingFailures.some((f) => f.validationCode === "DEADLINE_TIMEZONE_LOST"),
    );
    assert.ok(
      !result.advisoryFailures.some((f) => f.validationCode === "DEADLINE_TIMEZONE_LOST"),
    );
  });
});
