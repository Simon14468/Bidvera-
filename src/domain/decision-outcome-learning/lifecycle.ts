/**
 * Strict outcome lifecycle — PENDING → terminal states.
 * Terminal outcomes may be corrected to another terminal state; reverting to PENDING requires explicit reversal.
 */

export type DecisionOutcomeValue =
  | "WON"
  | "LOST"
  | "WITHDRAWN"
  | "CANCELLED"
  | "NOT_SUBMITTED"
  | "PENDING"
  | "BID_SUBMITTED"
  | "NO_BID_CONFIRMED";

export const TERMINAL_OUTCOMES = [
  "WON",
  "LOST",
  "WITHDRAWN",
  "CANCELLED",
  "NOT_SUBMITTED",
] as const satisfies readonly DecisionOutcomeValue[];

export type TerminalOutcome = (typeof TERMINAL_OUTCOMES)[number];

export const NON_TERMINAL_OUTCOMES = [
  "PENDING",
  "BID_SUBMITTED",
  "NO_BID_CONFIRMED",
] as const satisfies readonly DecisionOutcomeValue[];

export function isTerminalOutcome(
  outcome: DecisionOutcomeValue,
): outcome is TerminalOutcome {
  return (TERMINAL_OUTCOMES as readonly string[]).includes(outcome);
}

export function isNonTerminalOutcome(outcome: DecisionOutcomeValue): boolean {
  return (NON_TERMINAL_OUTCOMES as readonly string[]).includes(outcome);
}

/** Normalize legacy stored values to lifecycle buckets. */
export function lifecycleBucket(outcome: DecisionOutcomeValue): DecisionOutcomeValue {
  if (outcome === "BID_SUBMITTED") return "PENDING";
  if (outcome === "NO_BID_CONFIRMED") return "NOT_SUBMITTED";
  return outcome;
}

export function validateOutcomeTransition(input: {
  from: DecisionOutcomeValue | null;
  to: DecisionOutcomeValue;
  allowReversal?: boolean;
}): { ok: true } | { ok: false; message: string } {
  const to = lifecycleBucket(input.to);
  const from = input.from == null ? null : lifecycleBucket(input.from);

  if (from === to) {
    return { ok: true };
  }

  if (from == null) {
    return { ok: true };
  }

  if (isNonTerminalOutcome(from)) {
    return { ok: true };
  }

  if (isTerminalOutcome(from)) {
    if (to === "PENDING") {
      if (input.allowReversal) {
        return { ok: true };
      }
      return {
        ok: false,
        message:
          "Cannot revert a finalized outcome to Pending without an explicit reversal.",
      };
    }
    if (isTerminalOutcome(to)) {
      return { ok: true };
    }
    return {
      ok: false,
      message: "Finalized outcomes can only be updated to another finalized state.",
    };
  }

  return { ok: true };
}

export type OutcomeAuditAction =
  | "CREATED"
  | "UPDATED"
  | "OUTCOME_CHANGED"
  | "ATTACHMENT_ADDED"
  | "ATTACHMENT_REMOVED"
  | "REVERSAL";

export function resolveOutcomeAuditAction(input: {
  isCreate: boolean;
  previousOutcome: DecisionOutcomeValue | null;
  nextOutcome: DecisionOutcomeValue;
  attachmentChanged: boolean;
  allowReversal?: boolean;
}): OutcomeAuditAction {
  const prev = input.previousOutcome == null ? null : lifecycleBucket(input.previousOutcome);
  const next = lifecycleBucket(input.nextOutcome);

  if (input.isCreate) return "CREATED";

  if (
    input.allowReversal &&
    prev != null &&
    isTerminalOutcome(prev) &&
    next === "PENDING"
  ) {
    return "REVERSAL";
  }

  if (prev != null && prev !== next) {
    return "OUTCOME_CHANGED";
  }

  if (input.attachmentChanged) {
    return "ATTACHMENT_ADDED";
  }

  return "UPDATED";
}
