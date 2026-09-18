/**
 * Derived-field safety — Web/PDF/calendar/action deadline representations must match canonical.
 */

import { formatDeadlineWallClock } from "@/domain/tender-requirements/tender-deadline";
import { failure } from "../helpers";
import type { DecisionGuardianInput, GuardianValidationFailure } from "../types";

function wallKey(iso: string, timezone: string | null): string | null {
  if (!timezone) return iso.slice(0, 16);
  try {
    const w = formatDeadlineWallClock(iso, timezone);
    return `${w.dateYmd}T${String(w.hour).padStart(2, "0")}:${String(w.minute).padStart(2, "0")}|${timezone}`;
  } catch {
    return iso.slice(0, 16);
  }
}

export function checkDerivedFields(
  input: DecisionGuardianInput,
): GuardianValidationFailure[] {
  const derived = input.derivedDeadline;
  if (!derived?.canonicalIso) return [];
  const out: GuardianValidationFailure[] = [];
  const canonicalKey = wallKey(derived.canonicalIso, derived.canonicalTimezone);

  for (const rep of derived.representations) {
    if (rep.iso) {
      const repTz = rep.timezone ?? derived.canonicalTimezone;
      const repKey = wallKey(rep.iso, repTz);
      if (canonicalKey && repKey && canonicalKey !== repKey) {
        out.push(
          failure({
            validationCode: "DERIVED_FIELD_CONTRADICTS_CANONICAL",
            severity: "CRITICAL",
            check: "derived-fields",
            explanation: `${rep.channel} deadline representation (${repKey}) contradicts canonical (${canonicalKey}).`,
            sourceProvenance: derived.canonicalTimezone,
          }),
        );
      }
    }

    if (rep.display && derived.canonicalTimezone && derived.canonicalIso) {
      try {
        const wall = formatDeadlineWallClock(
          derived.canonicalIso,
          derived.canonicalTimezone,
        );
        const hhmm = `${String(wall.hour).padStart(2, "0")}:${String(wall.minute).padStart(2, "0")}`;
        // If display contains a time, it must match canonical wall-clock
        const m = rep.display.match(/\b(\d{1,2}):(\d{2})\b/);
        if (m) {
          const shown = `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
          if (shown !== hhmm) {
            out.push(
              failure({
                validationCode: "DERIVED_FIELD_CONTRADICTS_CANONICAL",
                severity: "CRITICAL",
                check: "derived-fields",
                explanation: `${rep.channel} display time ${shown} contradicts canonical ${hhmm} (${derived.canonicalTimezone}).`,
                sourceProvenance: rep.display,
              }),
            );
          }
        }
      } catch {
        /* ignore format errors */
      }
    }
  }

  return out;
}
