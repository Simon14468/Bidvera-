import assert from "node:assert/strict";
import test from "node:test";
import {
  ANALYSIS_PHASE,
  PHASE_PROGRESS,
  progressForPhase,
} from "./analysis-phases";

test("new pipeline phases have monotonic progress", () => {
  const ordered = [
    ANALYSIS_PHASE.UNDERSTANDING,
    ANALYSIS_PHASE.MATCHING,
    ANALYSIS_PHASE.EVALUATING,
    ANALYSIS_PHASE.BUILDING_INTELLIGENCE,
    ANALYSIS_PHASE.FINALIZING,
    ANALYSIS_PHASE.COMPLETE,
  ];
  let prev = 0;
  for (const phase of ordered) {
    const p = PHASE_PROGRESS[phase] ?? 0;
    assert.ok(p >= prev, `${phase} should not regress progress`);
    prev = p;
  }
});

test("legacy phases map to same progress as canonical phases", () => {
  assert.equal(
    progressForPhase(ANALYSIS_PHASE.ANALYZING_REQUIREMENTS, "EXTRACTING"),
    progressForPhase(ANALYSIS_PHASE.UNDERSTANDING, "EXTRACTING"),
  );
  assert.equal(
    progressForPhase(ANALYSIS_PHASE.MATCHING_COMPANY, "ANALYZING"),
    progressForPhase(ANALYSIS_PHASE.MATCHING, "ANALYZING"),
  );
});

test("completed status returns 100 even without phase", () => {
  assert.equal(progressForPhase(null, "COMPLETED"), 100);
});
