import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError, ErrorCode } from "@/lib/errors";
import { DecisionGuardianError } from "@/domain/decision-validation";
import { isNonRetryableAnalysisError } from "@/services/jobs";
import { evaluatePollStep, computeWaitBudget } from "@/app/(app)/tenders/upload/poll-analysis";

describe("isNonRetryableAnalysisError", () => {
  it("marks DecisionGuardianError as non-retryable", () => {
    const err = new DecisionGuardianError({
      ok: false,
      failures: [],
      blockingFailures: [
        {
          validationCode: "DEADLINE_TIMEZONE_LOST",
          severity: "CRITICAL",
          affectedCanonicalItemId: "deadline",
          explanation: "Deadline ISO present but timezone missing",
          sourceProvenance: null,
          check: "deadline_timezone",
        },
      ],
      advisoryFailures: [],
      contradictions: [],
      validatedAt: new Date().toISOString(),
      checksRun: ["DEADLINE_TIMEZONE_LOST"],
      durationMs: 1,
    });
    assert.equal(isNonRetryableAnalysisError(err), true);
  });

  it("marks Guardian message string as non-retryable", () => {
    assert.equal(
      isNonRetryableAnalysisError(
        new Error(
          "Decision Guardian blocked release: [DEADLINE_TIMEZONE_LOST] Deadline ISO present but timezone missing — wall-clock semantics unsafe.",
        ),
      ),
      true,
    );
  });

  it("marks VALIDATION AppError as non-retryable", () => {
    assert.equal(
      isNonRetryableAnalysisError(
        new AppError(ErrorCode.VALIDATION, "Could not read text from this PDF.", 400),
      ),
      true,
    );
  });

  it("allows transient UPSTREAM errors to retry", () => {
    assert.equal(
      isNonRetryableAnalysisError(
        new AppError(ErrorCode.UPSTREAM, "AI timeout", 502),
      ),
      false,
    );
  });
});

describe("upload poll reflects terminal FAILED", () => {
  it("FAILED status yields failed poll step with Guardian message", () => {
    const step = evaluatePollStep({
      elapsedMs: 120_000,
      waitBudgetMs: computeWaitBudget(3_200_000),
      pollOk: true,
      consecutivePollErrors: 0,
      data: {
        status: "FAILED",
        progress: 94,
        phase: "FINALIZING",
        message:
          "Decision Guardian blocked release: [DEADLINE_TIMEZONE_LOST] Deadline ISO present but timezone missing — wall-clock semantics unsafe.",
      },
    });
    assert.equal(step.kind, "failed");
    if (step.kind === "failed") {
      assert.match(step.message, /DEADLINE_TIMEZONE_LOST/);
    }
  });

  it("detail page source maps FAILED without decision to failed kind", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/application/tender-result-page.ts"),
      "utf8",
    );
    assert.match(src, /kind: "failed"/);
    assert.match(src, /analysisStatus === "FAILED"/);
    assert.match(src, /Must not be framed as "analysis in progress"/);
  });

  it("soft wait does not invent FAILED while still ANALYZING", () => {
    const step = evaluatePollStep({
      elapsedMs: 95_000,
      waitBudgetMs: computeWaitBudget(3_200_000),
      pollOk: true,
      consecutivePollErrors: 0,
      data: {
        status: "ANALYZING",
        progress: 82,
        phase: "BUILDING_INTELLIGENCE",
        message: "Analyse de l’adéquation…",
      },
    });
    assert.equal(step.kind, "continue");
    if (step.kind === "continue") {
      assert.equal(step.progress, 82);
    }
  });
});
