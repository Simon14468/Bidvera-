/**
 * Deadline wall-clock integrity — 23:59 must never become 00:59.
 * Covers Europe/Copenhagen, CET/CEST DST, UTC/offsets, DB round-trip, Guardian.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDecisionGuardianReady,
  buildDecisionGuardianInput,
  runDecisionGuardian,
} from "@/domain/decision-validation";
import { assertCanonicalDeadlineIntegrity } from "@/domain/tender-requirements/final-consistency";
import {
  buildDeadlineIsoWithLocalTime,
  deadlineIsoToPersistableDate,
  extractExplicitTimezone,
  extractTenderDeadlineFromText,
  formatDeadlineWallClock,
  instantToCanonicalDeadlineIso,
  offsetForNamedTimeZone,
  readCanonicalDeadlineIso,
} from "@/domain/tender-requirements/tender-deadline";

function roundTrip(
  dateYmd: string,
  hour: number,
  minute: number,
  timezone: string,
): {
  iso: string;
  persisted: Date;
  back: string;
  wall: { hour: number; minute: number; dateYmd: string };
} {
  const iso = buildDeadlineIsoWithLocalTime({ dateYmd, hour, minute, timezone });
  const persisted = deadlineIsoToPersistableDate(iso, timezone);
  assert.ok(persisted, `persistable instant required for ${iso} / ${timezone}`);
  const back = instantToCanonicalDeadlineIso(persisted, timezone);
  assert.ok(back, `canonical rebuild required for ${iso}`);
  const wall = formatDeadlineWallClock(back, timezone);
  return { iso, persisted, back, wall };
}

describe("deadline wall-clock — 23:59 never becomes 00:59", () => {
  it("1 — 23:59 local round-trip through Date persist/rebuild", () => {
    for (const tz of ["Europe/Copenhagen", "UTC", "Asia/Kolkata", "Africa/Casablanca"]) {
      const { wall, back, iso } = roundTrip("2026-01-15", 23, 59, tz);
      assert.equal(wall.hour, 23, `${tz} ${iso} → ${back}`);
      assert.equal(wall.minute, 59);
      assertCanonicalDeadlineIntegrity({
        deadlineIso: back,
        deadlineTimezone: tz,
        expectedLocalHour: 23,
        expectedLocalMinute: 59,
        expectedDateYmd: "2026-01-15",
      });
    }
  });

  it("2 — Europe/Copenhagen winter and summer keep 23:59", () => {
    const winter = roundTrip("2026-01-15", 23, 59, "Europe/Copenhagen");
    assert.equal(winter.iso, "2026-01-15T23:59:00+01:00");
    assert.equal(winter.wall.hour, 23);
    assert.equal(winter.wall.minute, 59);

    const summer = roundTrip("2026-07-15", 23, 59, "Europe/Copenhagen");
    assert.equal(summer.iso, "2026-07-15T23:59:00+02:00");
    assert.equal(summer.wall.hour, 23);
    assert.equal(summer.wall.minute, 59);
  });

  it("3 — UTC and positive/negative offsets round-trip", () => {
    const utc = roundTrip("2026-06-01", 23, 59, "UTC");
    assert.equal(utc.iso, "2026-06-01T23:59:00+00:00");
    assert.equal(utc.wall.hour, 23);

    const plus = roundTrip("2026-06-01", 23, 59, "Asia/Kolkata");
    assert.equal(plus.iso, "2026-06-01T23:59:00+05:30");
    assert.equal(plus.wall.hour, 23);

    const minusZone = "America/New_York";
    const iso = buildDeadlineIsoWithLocalTime({
      dateYmd: "2026-01-15",
      hour: 23,
      minute: 59,
      timezone: minusZone,
    });
    assert.match(iso, /T23:59:00-/);
    const wall = formatDeadlineWallClock(iso, minusZone);
    assert.equal(wall.hour, 23);
    assert.equal(wall.minute, 59);
    const { wall: backWall } = roundTrip("2026-01-15", 23, 59, minusZone);
    assert.equal(backWall.hour, 23);
  });

  it("4 — DST transition dates keep stated 23:59", () => {
    // EU DST 2026: spring forward 29 Mar, fall back 25 Oct
    for (const dateYmd of ["2026-03-28", "2026-03-29", "2026-10-24", "2026-10-25"]) {
      const { wall, iso } = roundTrip(dateYmd, 23, 59, "Europe/Copenhagen");
      assert.equal(wall.hour, 23, `${dateYmd} ${iso}`);
      assert.equal(wall.minute, 59);
      assert.equal(wall.dateYmd, dateYmd);
    }
  });

  it("5 — date-only deadlines stay date-only (no invented 00:59)", () => {
    const parsed = extractTenderDeadlineFromText(
      "Submission deadline: 15 October 2026\n",
      null,
    );
    assert.equal(parsed.deadlineIso, "2026-10-15");
    assert.equal(parsed.localHour, null);
    assert.equal(parsed.deadlineTimezone, null);
  });

  it("6 — explicit timezone in source is preserved with DST-correct offset", () => {
    assert.equal(
      extractExplicitTimezone("Deadline 15 July 2026 at 23:59 Europe/Copenhagen"),
      "Europe/Copenhagen",
    );
    const parsed = extractTenderDeadlineFromText(
      "Submission deadline: 15 July 2026 at 23:59 Europe/Copenhagen\n",
      null,
    );
    assert.equal(parsed.deadlineIso, "2026-07-15T23:59:00+02:00");
    assert.equal(parsed.deadlineTimezone, "Europe/Copenhagen");
    assert.equal(parsed.localHour, 23);
    assert.equal(parsed.localMinute, 59);
  });

  it("7 — no explicit timezone → naive wall-clock, no invented offset", () => {
    const parsed = extractTenderDeadlineFromText(
      "Submission deadline: 15 July 2026 at 23:59\n",
      "Denmark",
    );
    assert.equal(parsed.deadlineIso, "2026-07-15T23:59:00");
    assert.equal(parsed.deadlineTimezone, null);
    assert.ok(!parsed.deadlineIso.includes("+") && !parsed.deadlineIso.endsWith("Z"));
    assert.match(parsed.reason ?? "", /UNKNOWN/i);
  });

  it("8 — extraction → canonical → snapshot readback → Guardian equivalence", () => {
    const parsed = extractTenderDeadlineFromText(
      "Submission deadline: 15 January 2026 at 23:59 Europe/Copenhagen\n",
      null,
    );
    const persisted = deadlineIsoToPersistableDate(
      parsed.deadlineIso!,
      parsed.deadlineTimezone,
    )!;
    const fromSnapshot = readCanonicalDeadlineIso({
      snapshotIso: parsed.deadlineIso,
      persistedInstant: persisted,
      timezone: parsed.deadlineTimezone,
    });
    assert.equal(fromSnapshot, parsed.deadlineIso);

    const fromInstantOnly = readCanonicalDeadlineIso({
      snapshotIso: null,
      persistedInstant: persisted,
      timezone: parsed.deadlineTimezone,
    });
    assert.equal(
      formatDeadlineWallClock(fromInstantOnly!, parsed.deadlineTimezone!).hour,
      23,
    );

    const requirements = [
      {
        id: "T-01",
        requirement:
          "T-01 The bidder must submit the proposal before the stated deadline.",
        category: "MANDATORY_ADMINISTRATIVE",
        semanticKind: "REQUIRED_DOCUMENT",
        obligationStrength: "MANDATORY",
        mandatory: true,
        sourceSection: "Submission",
        page: 1,
        evidenceText:
          "T-01 The bidder must submit the proposal before the stated deadline.",
        companyEvidenceText: "Submission checklist verified.",
        hasCompanyEvidence: true,
        fitStatus: "CONFIRMED_FIT",
      },
    ];
    const input = buildDecisionGuardianInput({
      textLength: 5000,
      readable: true,
      validityPassed: true,
      fileName: "itb.pdf",
      requirements,
      matrix: requirements.map((r) => ({ requirementId: r.id })),
      readinessItems: requirements.map((r) => ({ id: r.id })),
      actions: requirements.map((r) => ({
        linkedRequirementId: r.id,
        blocking: false,
        sourceType: "MISSING_EVIDENCE",
        title: "Provide evidence: submit proposal",
        simulationOnly: false,
      })),
      decision: {
        decision: "REVIEW",
        hardFailure: false,
        hardBlockerCount: 0,
      },
      deadline: {
        deadlineIso: fromSnapshot,
        deadlineTimezone: parsed.deadlineTimezone,
        expectedLocalHour: 23,
        expectedLocalMinute: 59,
        expectedDateYmd: "2026-01-15",
        sourceEvidence: parsed.evidence,
      },
      fitScore: 70,
      fitBreakdownOverall: 70,
      reasoning: "Review",
      complianceSummaryTotal: 1,
    });
    const result = runDecisionGuardian(input);
    assert.equal(result.ok, true);
    assert.ok(
      !result.blockingFailures.some((f) => f.validationCode === "DEADLINE_TIME_MUTATED"),
    );
    assert.doesNotThrow(() => assertDecisionGuardianReady(input));
  });

  it("9 — re-running the same analysis is idempotent", () => {
    const text =
      "Submission deadline: 15 July 2026 at 23:59 Europe/Copenhagen\n";
    const a = extractTenderDeadlineFromText(text, null);
    const b = extractTenderDeadlineFromText(text, null);
    assert.deepEqual(a, b);
    const first = roundTrip("2026-07-15", 23, 59, "Europe/Copenhagen");
    const second = roundTrip("2026-07-15", 23, 59, "Europe/Copenhagen");
    assert.equal(first.iso, second.iso);
    assert.equal(first.back, second.back);
    assert.equal(first.persisted.toISOString(), second.persisted.toISOString());
  });

  it("10 — real 23:59 must never become 00:59 (Copenhagen / CET summer)", () => {
    const copenhagen = extractTenderDeadlineFromText(
      "Submission deadline: 15 July 2026 at 23:59 Europe/Copenhagen\n",
      null,
    );
    assert.equal(copenhagen.localHour, 23);
    assert.equal(copenhagen.localMinute, 59);
    const wall = formatDeadlineWallClock(
      copenhagen.deadlineIso!,
      copenhagen.deadlineTimezone!,
    );
    assert.notEqual(wall.hour, 0);
    assert.equal(wall.hour, 23);

    // CET abbreviation in summer must use DST (+02), not fixed +01
    assert.equal(offsetForNamedTimeZone("2026-07-15", 23, 59, "CET"), "+02:00");
    const cet = extractTenderDeadlineFromText(
      "Deadline for Proposal Submission\nDate: 15 July 2026\nTime: 23:59 hours CET\n",
      null,
    );
    assert.equal(cet.deadlineTimezone, "CET");
    assert.equal(cet.deadlineIso, "2026-07-15T23:59:00+02:00");
    const cetWall = formatDeadlineWallClock(cet.deadlineIso!, "CET");
    assert.equal(cetWall.hour, 23);

    // Legacy wrong encoding: 23:59+01:00 under Europe/Copenhagen in summer → exposed as 00:59
    const mutated = formatDeadlineWallClock(
      "2026-07-15T23:59:00+01:00",
      "Europe/Copenhagen",
    );
    assert.equal(mutated.hour, 0);
    assert.equal(mutated.minute, 59);

    // Z-encoded local 23:59 under Copenhagen winter → exposed as 00:59
    const zMutated = formatDeadlineWallClock(
      "2026-01-15T23:59:00.000Z",
      "Europe/Copenhagen",
    );
    assert.equal(zMutated.hour, 0);
    assert.equal(zMutated.minute, 59);

    assert.throws(
      () =>
        assertCanonicalDeadlineIntegrity({
          deadlineIso: "2026-01-15T23:59:00.000Z",
          deadlineTimezone: "Europe/Copenhagen",
          expectedLocalHour: 23,
          expectedLocalMinute: 59,
        }),
      /expected 23:59, got 0:59/,
    );
  });

  it("country is never timezone evidence", () => {
    assert.equal(extractExplicitTimezone("Deadline in Denmark 15 July 2026 at 23:59"), null);
    assert.equal(extractExplicitTimezone("Deadline in Copenhagen 15 July 2026 at 23:59"), null);
  });
});
