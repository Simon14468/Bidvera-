/**
 * Deadline integrity — preserve wall-clock time and timezone vs source.
 *
 * Timezone UNKNOWN (null / "UNKNOWN") is a valid canonical state when the tender
 * does not state a zone. That is not "timezone lost" corruption.
 * - REVIEW / NO_BID may release with advisory notice (wall-clock preserved).
 * - BID (GO) remains blocked — absolute instant would be falsely certain.
 */

import { assertCanonicalDeadlineIntegrity } from "@/domain/tender-requirements/final-consistency";
import {
  isDeadlineTimezoneUnknown,
  normalizeDeadlineTimezone,
} from "@/domain/tender-requirements/deadline-timezone";
import { formatDeadlineWallClock } from "@/domain/tender-requirements/tender-deadline";
import { captureAssert, failure } from "../helpers";
import type { DecisionGuardianInput, GuardianValidationFailure } from "../types";

export function checkDeadlines(
  input: DecisionGuardianInput,
): GuardianValidationFailure[] {
  const d = input.deadline;
  if (!d) return [];
  const out: GuardianValidationFailure[] = [];

  const timezone = normalizeDeadlineTimezone(d.deadlineTimezone);
  const timezoneUnknown = isDeadlineTimezoneUnknown(d.deadlineTimezone);

  if (d.deadlineIso && timezoneUnknown) {
    const decision = input.decision?.decision ?? null;
    // Legitimate UNKNOWN from source — wall-clock kept without inventing a zone.
    // Only block GO; CONDITIONAL GO / NO-BID may complete with advisory.
    if (decision === "BID") {
      out.push(
        failure({
          validationCode: "DEADLINE_TIMEZONE_LOST",
          severity: "HIGH",
          check: "deadlines",
          explanation:
            "Deadline timezone UNKNOWN — cannot release GO while wall-clock semantics remain ambiguous. Downgrade to REVIEW or obtain an explicit timezone from the tender.",
          sourceProvenance: d.sourceEvidence ?? null,
        }),
      );
    } else {
      out.push(
        failure({
          validationCode: "DEADLINE_TIMEZONE_LOST",
          severity: "MEDIUM",
          check: "deadlines",
          explanation:
            "Deadline timezone UNKNOWN (not stated in source). Wall-clock date/time preserved without inventing a timezone.",
          sourceProvenance: d.sourceEvidence ?? null,
        }),
      );
    }
  }

  if (d.deadlineIso && timezone) {
    out.push(
      ...captureAssert(
        "deadlines",
        "DEADLINE_TIME_MUTATED",
        "CRITICAL",
        () =>
          assertCanonicalDeadlineIntegrity({
            deadlineIso: d.deadlineIso,
            deadlineTimezone: timezone,
            expectedLocalHour: d.expectedLocalHour,
            expectedLocalMinute: d.expectedLocalMinute,
            expectedDateYmd: d.expectedDateYmd,
            sourceEvidence: d.sourceEvidence,
          }),
      ),
    );

    // Explicit 10:30 → 01:00 midnight-UTC class of bug
    if (d.expectedLocalHour === 10 && d.expectedLocalMinute === 30) {
      try {
        const wall = formatDeadlineWallClock(d.deadlineIso, timezone);
        if (wall.hour === 1 && wall.minute === 0) {
          out.push(
            failure({
              validationCode: "DEADLINE_TIME_MUTATED",
              severity: "CRITICAL",
              check: "deadlines",
              explanation: "Deadline midnight-UTC bug: expected 10:30 became 01:00.",
              sourceProvenance: d.sourceEvidence ?? null,
            }),
          );
        }
      } catch {
        /* format errors already covered */
      }
    }
  }

  return out;
}
