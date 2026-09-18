/**
 * Bid Score + Expected Value regression suite.
 * Run: npx tsx --test src/domain/bid-score/bid-score.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  computeBidScore,
  sanitizeEstimatedValue,
  type BidScoreInput,
} from "@/domain/bid-score";

function baseInput(overrides: Partial<BidScoreInput> = {}): BidScoreInput {
  return {
    fitScore: 80,
    readinessScore: 75,
    compliance: {
      total: 10,
      ready: 8,
      missing: 1,
      verify: 1,
      missingMandatory: 0,
      verifyMandatory: 0,
    },
    highRiskCount: 0,
    criticalRiskCount: 0,
    estimatedValue: null,
    daysUntilDeadline: 30,
    requirementCount: 10,
    historical: null,
    decision: "BID",
    ...overrides,
  };
}

test("1. high-fit high-readiness yields high Bid Score", () => {
  const result = computeBidScore(baseInput());
  assert.ok(result.score >= 75, `expected high score, got ${result.score}`);
  assert.ok(
    result.priority === "HIGH" || result.priority === "VERY_HIGH",
    result.priority,
  );
  assert.match(result.interpretation, /attractive/i);
  assert.doesNotMatch(result.interpretation, /chance of winning/i);
});

test("2. low-fit tender yields lower Bid Score", () => {
  const high = computeBidScore(baseInput());
  const low = computeBidScore(
    baseInput({
      fitScore: 25,
      readinessScore: 30,
      compliance: {
        total: 10,
        ready: 2,
        missing: 6,
        verify: 2,
        missingMandatory: 3,
        verifyMandatory: 1,
      },
      decision: "NO_BID",
    }),
  );
  assert.ok(low.score < high.score);
  assert.ok(low.score < 50, `expected low score, got ${low.score}`);
});

test("3. high-risk tender is penalized", () => {
  const calm = computeBidScore(baseInput());
  const risky = computeBidScore(
    baseInput({ highRiskCount: 3, criticalRiskCount: 1 }),
  );
  assert.ok(risky.score < calm.score);
  assert.equal(risky.riskLevel, "HIGH");
  assert.ok(
    risky.drivers.some((d) => d.direction === "negative" && /risk/i.test(d.label)),
  );
});

test("4. missing contract value is not invented", () => {
  const result = computeBidScore(baseInput({ estimatedValue: null }));
  assert.equal(result.contractValue, null);
  assert.equal(result.contractValueLabel, "Contract value: Not specified");
  assert.equal(result.contractValueProvenance, "UNKNOWN");
  assert.equal(result.expectedValue, "UNKNOWN");
  assert.match(result.expectedValueNote, /not available/i);
});

test("5. missing pursuit cost stays unknown", () => {
  const result = computeBidScore(baseInput({ estimatedValue: 500_000 }));
  assert.equal(result.pursuitCost, null);
  assert.equal(result.pursuitCostLabel, "Estimated pursuit cost: Unknown");
  assert.equal(result.pursuitCostProvenance, "UNKNOWN");
  assert.equal(result.winProbabilityLabel, "Win probability: Not available");
});

test("6. missing historical data does not invent a signal", () => {
  const result = computeBidScore(baseInput({ historical: null }));
  assert.ok(
    !result.drivers.some((d) => /historical/i.test(d.label)),
  );
});

test("7. verified positive historical pattern can strengthen score", () => {
  const base = computeBidScore(baseInput({ historical: null }));
  const withHist = computeBidScore(
    baseInput({
      historical: {
        detected: true,
        influenceAllowed: true,
        lean: "more_often_successful",
      },
    }),
  );
  assert.ok(withHist.score >= base.score);
  assert.ok(
    withHist.drivers.some(
      (d) => d.direction === "positive" && /historical/i.test(d.label),
    ),
  );
});

test("8. verified negative historical pattern can weaken score", () => {
  const base = computeBidScore(baseInput({ historical: null }));
  const withHist = computeBidScore(
    baseInput({
      historical: {
        detected: true,
        influenceAllowed: true,
        lean: "more_often_unsuccessful",
      },
    }),
  );
  assert.ok(withHist.score <= base.score);
  assert.ok(
    withHist.drivers.some(
      (d) => d.direction === "negative" && /historical|cautionary/i.test(d.label),
    ),
  );
});

test("9. conflicting / mixed historical lean does not invent probability", () => {
  const result = computeBidScore(
    baseInput({
      historical: {
        detected: true,
        influenceAllowed: true,
        lean: "mixed",
      },
    }),
  );
  assert.equal(result.winProbabilityProvenance, "UNKNOWN");
  assert.doesNotMatch(result.winProbabilityLabel, /\d+%/);
});

test("10. current mandatory gaps block historical influence on score", () => {
  const withoutGap = computeBidScore(
    baseInput({
      historical: {
        detected: true,
        influenceAllowed: true,
        lean: "more_often_successful",
      },
    }),
  );
  const withGap = computeBidScore(
    baseInput({
      compliance: {
        total: 10,
        ready: 5,
        missing: 3,
        verify: 2,
        missingMandatory: 2,
        verifyMandatory: 1,
      },
      historical: {
        detected: true,
        influenceAllowed: true,
        lean: "more_often_successful",
      },
    }),
  );
  assert.ok(
    !withGap.drivers.some(
      (d) => d.direction === "positive" && /historical/i.test(d.label),
    ),
  );
  assert.ok(withGap.score < withoutGap.score);
});

test("11. Bid decision with moderate Bid Score is allowed", () => {
  const result = computeBidScore(
    baseInput({
      fitScore: 62,
      readinessScore: 58,
      decision: "BID",
      compliance: {
        total: 10,
        ready: 6,
        missing: 2,
        verify: 2,
        missingMandatory: 1,
        verifyMandatory: 1,
      },
      highRiskCount: 1,
      daysUntilDeadline: 14,
    }),
  );
  assert.ok(
    result.score >= 40 && result.score < 75,
    `expected moderate score with BID decision, got ${result.score}`,
  );
  assert.match(result.disclaimer, /not a probability of winning/i);
});

test("12. REVIEW decision with high Bid Score is allowed", () => {
  const result = computeBidScore(
    baseInput({
      fitScore: 88,
      readinessScore: 85,
      decision: "REVIEW",
      estimatedValue: 1_000_000,
    }),
  );
  assert.ok(result.score >= 75, String(result.score));
  // Decision independence: REVIEW does not force score down
  assert.ok(
    result.priority === "HIGH" || result.priority === "VERY_HIGH",
  );
});

test("13. insufficient data reduces certainty and leaves EV unknown", () => {
  const result = computeBidScore(
    baseInput({
      fitScore: null,
      readinessScore: null,
      compliance: {
        total: 0,
        ready: 0,
        missing: 0,
        verify: 0,
        missingMandatory: 0,
        verifyMandatory: 0,
      },
      requirementCount: 0,
      estimatedValue: null,
    }),
  );
  assert.equal(result.reducedCertainty, true);
  assert.equal(result.expectedValue, "UNKNOWN");
  assert.equal(result.effort, "UNKNOWN");
  assert.ok(result.certaintyNote);
});

test("14. duplicate drivers are collapsed", () => {
  const result = computeBidScore(
    baseInput({
      fitScore: 90,
      readinessScore: 90,
      highRiskCount: 0,
      criticalRiskCount: 0,
    }),
  );
  const keys = result.drivers.map((d) => `${d.direction}:${d.label}`);
  assert.equal(keys.length, new Set(keys).size);
});

test("15. malicious / invalid financial values are rejected", () => {
  assert.equal(sanitizeEstimatedValue(NaN), null);
  assert.equal(sanitizeEstimatedValue(-100), null);
  assert.equal(sanitizeEstimatedValue(0), null);
  assert.equal(sanitizeEstimatedValue(Infinity), null);
  assert.equal(sanitizeEstimatedValue(1e20), null);
  assert.equal(sanitizeEstimatedValue(250_000), 250_000);

  const bad = computeBidScore(baseInput({ estimatedValue: -999 }));
  assert.equal(bad.contractValue, null);
  assert.equal(bad.contractValueLabel, "Contract value: Not specified");

  const absurd = computeBidScore(baseInput({ estimatedValue: 1e20 }));
  assert.equal(absurd.contractValue, null);
  assert.equal(absurd.winProbabilityProvenance, "UNKNOWN");
});

test("16. same inputs produce identical Bid Score (reproducible)", () => {
  const a = computeBidScore(baseInput({ estimatedValue: 100_000 }));
  const b = computeBidScore(baseInput({ estimatedValue: 100_000 }));
  assert.deepEqual(a, b);
});

test("score never presented as win probability string", () => {
  const result = computeBidScore(baseInput({ estimatedValue: 2_000_000 }));
  const blob = JSON.stringify(result);
  assert.doesNotMatch(blob, /chance of winning/i);
  assert.doesNotMatch(blob, /\d+% chance/i);
  assert.match(blob, /Bid Score ranks opportunity priority/i);
});

test("suppressed historical signal notes current evidence priority", () => {
  const result = computeBidScore(
    baseInput({
      historical: {
        detected: true,
        influenceAllowed: false,
        lean: "more_often_successful",
      },
    }),
  );
  assert.ok(
    result.drivers.some((d) =>
      /current evidence takes priority/i.test(d.label),
    ),
  );
  assert.ok(
    !result.drivers.some(
      (d) => d.direction === "positive" && /historical/i.test(d.label),
    ),
  );
});
