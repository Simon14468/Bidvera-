/**
 * Fail-safe consistency between stored canonical decision and explanation.
 */

import { toTenderDecisionLabel } from "@/domain/decision/labels";
import type { DecisionType } from "@prisma/client";
import type { ExplainableDecision } from "./types";

export class DecisionExplanationMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecisionExplanationMismatchError";
  }
}

export function assertDecisionExplanationConsistency(input: {
  storedDecision: DecisionType | null | undefined;
  explanation: ExplainableDecision;
}): void {
  if (!input.storedDecision) {
    throw new DecisionExplanationMismatchError(
      "Cannot verify explanation — no canonical decision stored.",
    );
  }

  if (input.explanation.decision !== input.storedDecision) {
    throw new DecisionExplanationMismatchError(
      `Decision mismatch: stored ${input.storedDecision} vs explanation ${input.explanation.decision}.`,
    );
  }

  const expectedLabel = toTenderDecisionLabel(input.storedDecision);
  if (input.explanation.displayLabel !== expectedLabel) {
    throw new DecisionExplanationMismatchError(
      `Decision label mismatch: expected ${expectedLabel}, got ${input.explanation.displayLabel}.`,
    );
  }

  const headline = input.explanation.executiveSummary.whyHeadline.toLowerCase();

  if (
    input.explanation.displayLabel === "GO" &&
    headline.includes("no critical blockers") === false &&
    input.explanation.hardFailure
  ) {
    throw new DecisionExplanationMismatchError(
      "GO explanation cannot accompany hardFailure.",
    );
  }

  if (
    input.explanation.displayLabel === "NO-BID" &&
    /no blockers|all blockers resolved|clean go/i.test(headline)
  ) {
    throw new DecisionExplanationMismatchError(
      "NO-BID explanation contradicts blocker headline.",
    );
  }

  if (
    input.explanation.displayLabel === "CONDITIONAL GO" &&
    /all blockers resolved|recommends go with no/i.test(headline)
  ) {
    throw new DecisionExplanationMismatchError(
      "CONDITIONAL GO explanation claims all blockers resolved.",
    );
  }
}
