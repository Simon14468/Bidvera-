import assert from "node:assert/strict";
import test from "node:test";
import { AiRequestTimeoutError, AI_REQUEST_TIMEOUT_MS } from "@/config/ai-timeout";

test("AI request timeout error encodes duration", () => {
  const err = new AiRequestTimeoutError(120_000);
  assert.match(err.message, /120000/);
  assert.equal(err.timeoutMs, 120_000);
});

test("default AI timeout is at least 5 seconds", () => {
  assert.ok(AI_REQUEST_TIMEOUT_MS >= 5_000);
});
