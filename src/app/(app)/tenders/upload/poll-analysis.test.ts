import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePollStep,
  MAX_POLL_ERRORS,
  computeWaitBudget,
} from "@/app/(app)/tenders/upload/poll-analysis";

test("completed poll transitions to success", () => {
  const step = evaluatePollStep({
    elapsedMs: 5_000,
    waitBudgetMs: 300_000,
    pollOk: true,
    consecutivePollErrors: 0,
    data: { status: "COMPLETED", progress: 100 },
  });
  assert.equal(step.kind, "success");
});

test("failed poll transitions to failed with message", () => {
  const step = evaluatePollStep({
    elapsedMs: 5_000,
    waitBudgetMs: 300_000,
    pollOk: true,
    consecutivePollErrors: 0,
    data: { status: "FAILED", progress: 100, message: "Upstream error" },
  });
  assert.equal(step.kind, "failed");
  if (step.kind === "failed") {
    assert.equal(step.message, "Upstream error");
  }
});

test("poll errors retry until exhausted", () => {
  const step = evaluatePollStep({
    elapsedMs: 5_000,
    waitBudgetMs: 300_000,
    pollOk: false,
    pollErrorMessage: "Network error",
    consecutivePollErrors: MAX_POLL_ERRORS - 1,
    data: undefined,
  });
  assert.equal(step.kind, "poll_error");
  if (step.kind === "poll_error") {
    assert.equal(step.exhausted, true);
  }
});

test("elapsed beyond wait budget yields still_processing while incomplete", () => {
  const step = evaluatePollStep({
    elapsedMs: computeWaitBudget(0) + 1_000,
    waitBudgetMs: computeWaitBudget(0),
    pollOk: true,
    consecutivePollErrors: 0,
    data: { status: "ANALYZING", progress: 72 },
  });
  assert.equal(step.kind, "still_processing");
});

test("analyzing status maps to analyzing phase", () => {
  const step = evaluatePollStep({
    elapsedMs: 10_000,
    waitBudgetMs: 300_000,
    pollOk: true,
    consecutivePollErrors: 0,
    data: { status: "ANALYZING", progress: 65 },
  });
  assert.equal(step.kind, "continue");
  if (step.kind === "continue") {
    assert.equal(step.phase, "analyzing");
    assert.equal(step.progress, 65);
  }
});
