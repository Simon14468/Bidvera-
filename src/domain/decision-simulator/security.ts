/**
 * Simulation input hardening — uses shared AI Trust injection patterns.
 */

import { assertNoSystemOverrideInStructuredText } from "@/domain/ai-trust";
import type { SimulationOverrides } from "./types";

const MAX_EVIDENCE_NOTE_LENGTH = 240;

export function sanitizeSimulatedEvidenceNote(text: string | null | undefined): string | null {
  if (text == null || text.trim() === "") return null;
  let safe = text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_EVIDENCE_NOTE_LENGTH);
  assertNoSystemOverrideInStructuredText(
    safe,
    "Simulation rejected: evidence note contains",
  );
  if (!safe.startsWith("[SIMULATED]")) {
    safe = `[SIMULATED] ${safe}`;
  }
  return safe;
}

/** Strip unsafe fields and normalize overrides before validation. */
export function sanitizeSimulationOverrides(
  overrides: SimulationOverrides,
): SimulationOverrides {
  const next: SimulationOverrides = {};

  if (overrides.requirements?.length) {
    next.requirements = overrides.requirements.map((row) => ({
      id: row.id,
      status: row.status,
      ...(row.evidence !== undefined
        ? { evidence: sanitizeSimulatedEvidenceNote(row.evidence) }
        : {}),
    }));
  }

  if (overrides.evidence?.length) {
    next.evidence = overrides.evidence.map((row) => ({
      id: row.id,
      verificationStatus: row.verificationStatus,
    }));
  }

  if (overrides.resolveMissingDocumentIds?.length) {
    next.resolveMissingDocumentIds = [...new Set(overrides.resolveMissingDocumentIds)];
  }

  if (overrides.profile) {
    next.profile = {};
    for (const [key, value] of Object.entries(overrides.profile)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        (next.profile as Record<string, unknown>)[key] = value
          .map((v) => String(v).trim().slice(0, 120))
          .filter(Boolean)
          .slice(0, 32);
      } else if (typeof value === "number") {
        (next.profile as Record<string, unknown>)[key] = value;
      } else if (value === null) {
        (next.profile as Record<string, unknown>)[key] = null;
      }
    }
  }

  return next;
}

/** Tender extracted text must never flow into override construction from user input. */
export function assertOverridesAreStructured(overrides: SimulationOverrides): void {
  const json = JSON.stringify(overrides);
  if (json.length > 32_000) {
    throw new Error("Simulation payload too large.");
  }
  assertNoSystemOverrideInStructuredText(
    json,
    "Simulation rejected: payload contains",
  );
}
