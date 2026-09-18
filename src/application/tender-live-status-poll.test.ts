import assert from "node:assert/strict";
import test from "node:test";
import {
  canStartPollRequest,
  DETAIL_MAX_POLL_ERRORS,
  DETAIL_POLL_INTERVAL_MS,
  DETAIL_POLL_SLOW_INTERVAL_MS,
  DETAIL_SOFT_WAIT_MS,
  evaluateLiveStatusPollStep,
  isTerminalAnalysisStatus,
  nextLivePollIntervalMs,
  shouldStartLiveStatusPolling,
} from "@/application/tender-live-status-poll";

test("EXTRACTING → COMPLETED is terminal (auto-refresh path)", () => {
  const step = evaluateLiveStatusPollStep({
    elapsedMs: 5_000,
    pollOk: true,
    consecutivePollErrors: 0,
    previousStatus: "EXTRACTING",
    data: { status: "COMPLETED", progress: 100 },
  });
  assert.equal(step.kind, "terminal");
  if (step.kind === "terminal") {
    assert.equal(step.status, "COMPLETED");
  }
});

test("EXTRACTING → FAILED is terminal (show failure after refresh)", () => {
  const step = evaluateLiveStatusPollStep({
    elapsedMs: 5_000,
    pollOk: true,
    consecutivePollErrors: 0,
    previousStatus: "EXTRACTING",
    data: { status: "FAILED", progress: 100, message: "Certification failed" },
  });
  assert.equal(step.kind, "terminal");
  if (step.kind === "terminal") {
    assert.equal(step.status, "FAILED");
  }
});

test("ANALYZING → ANALYSIS_INCOMPLETE is terminal", () => {
  const step = evaluateLiveStatusPollStep({
    elapsedMs: 12_000,
    pollOk: true,
    consecutivePollErrors: 0,
    previousStatus: "ANALYZING",
    data: { status: "ANALYSIS_INCOMPLETE", progress: 100 },
  });
  assert.equal(step.kind, "terminal");
  if (step.kind === "terminal") {
    assert.equal(step.status, "ANALYSIS_INCOMPLETE");
  }
});

test("already COMPLETED page kind does not start polling", () => {
  assert.equal(shouldStartLiveStatusPolling("ready"), false);
  assert.equal(shouldStartLiveStatusPolling("failed"), false);
  assert.equal(shouldStartLiveStatusPolling("in_progress"), true);
});

test("in-progress statuses continue with live phase updates", () => {
  for (const status of [
    "UPLOADING",
    "PROCESSING",
    "EXTRACTING",
    "ANALYZING",
  ] as const) {
    const step = evaluateLiveStatusPollStep({
      elapsedMs: 3_000,
      pollOk: true,
      consecutivePollErrors: 0,
      previousStatus: "EXTRACTING",
      data: { status, progress: 40, phase: "NATIVE_EXTRACT" },
    });
    assert.equal(step.kind, "continue");
    if (step.kind === "continue") {
      assert.equal(step.status, status);
      assert.equal(step.intervalMs, DETAIL_POLL_INTERVAL_MS);
    }
  }
});

test("slow processing is not failure — continues with slower interval", () => {
  const step = evaluateLiveStatusPollStep({
    elapsedMs: DETAIL_SOFT_WAIT_MS + 5_000,
    pollOk: true,
    consecutivePollErrors: 0,
    previousStatus: "ANALYZING",
    data: { status: "ANALYZING", progress: 72, phase: "EVALUATING" },
  });
  assert.equal(step.kind, "continue");
  if (step.kind === "continue") {
    assert.equal(step.status, "ANALYZING");
    assert.equal(step.intervalMs, DETAIL_POLL_SLOW_INTERVAL_MS);
  }
  assert.equal(
    nextLivePollIntervalMs(DETAIL_SOFT_WAIT_MS + 1),
    DETAIL_POLL_SLOW_INTERVAL_MS,
  );
});

test("poll errors do not mark analysis failed; exhausted slows interval", () => {
  const step = evaluateLiveStatusPollStep({
    elapsedMs: 5_000,
    pollOk: false,
    pollErrorMessage: "Network error",
    consecutivePollErrors: DETAIL_MAX_POLL_ERRORS - 1,
    previousStatus: "EXTRACTING",
  });
  assert.equal(step.kind, "poll_error");
  if (step.kind === "poll_error") {
    assert.equal(step.exhausted, true);
    assert.equal(step.intervalMs, DETAIL_POLL_SLOW_INTERVAL_MS);
  }
});

test("duplicate in-flight / unmount / terminal block new poll starts", () => {
  assert.equal(
    canStartPollRequest({
      cancelled: false,
      inFlight: false,
      terminalReached: false,
    }),
    true,
  );
  assert.equal(
    canStartPollRequest({
      cancelled: true,
      inFlight: false,
      terminalReached: false,
    }),
    false,
  );
  assert.equal(
    canStartPollRequest({
      cancelled: false,
      inFlight: true,
      terminalReached: false,
    }),
    false,
  );
  assert.equal(
    canStartPollRequest({
      cancelled: false,
      inFlight: false,
      terminalReached: true,
    }),
    false,
  );
});

test("terminal status helper covers required terminals", () => {
  assert.equal(isTerminalAnalysisStatus("COMPLETED"), true);
  assert.equal(isTerminalAnalysisStatus("FAILED"), true);
  assert.equal(isTerminalAnalysisStatus("ANALYSIS_INCOMPLETE"), true);
  assert.equal(isTerminalAnalysisStatus("EXTRACTING"), false);
  assert.equal(isTerminalAnalysisStatus("ANALYZING"), false);
});
