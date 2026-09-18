/**
 * Package / document readiness rollup from intake file terminal states.
 */

import { isTerminalAccepted } from "./codes";
import type {
  DocumentReadinessState,
  IntakeFileRecord,
  IntakePackageStatus,
  PackageCompletenessState,
} from "./types";

export function rollupDocumentReadiness(files: IntakeFileRecord[]): DocumentReadinessState {
  const accepted = files.filter((f) => isTerminalAccepted(f.state));
  if (accepted.length === 0) {
    if (files.some((f) => f.state === "PASSWORD_PROTECTED")) return "NEEDS_PASSWORD";
    if (files.some((f) => f.blocking)) return "BLOCKED";
    return "NOT_READY";
  }
  if (accepted.some((f) => f.readiness === "NEEDS_OCR" || f.warningCodes.includes("OCR_LIKELY_REQUIRED"))) {
    return "NEEDS_OCR";
  }
  if (
    files.some((f) => f.warningCodes.length > 0) ||
    accepted.some((f) => f.state === "RECOVERABLE")
  ) {
    return "READY_WITH_WARNINGS";
  }
  return "READY";
}

export function rollupPackageCompleteness(input: {
  acceptedCount: number;
  blocked: boolean;
  hasSkippedMembers: boolean;
  hasCorruptedOrUnreadable?: boolean;
}): PackageCompletenessState {
  if (input.blocked) return "BLOCKED";
  if (input.acceptedCount === 0) return "INCOMPLETE";
  if (input.hasSkippedMembers || input.hasCorruptedOrUnreadable) return "INCOMPLETE";
  return "COMPLETE";
}

export function rollupPackageStatus(input: {
  acceptedCount: number;
  blockingCount: number;
  warningCount: number;
  /** Skipped/unsupported/corrupted members while some files still proceed. */
  partialMembers?: boolean;
}): IntakePackageStatus {
  if (input.acceptedCount === 0 || input.blockingCount > 0) return "INTAKE_BLOCKED";
  if (input.partialMembers) return "INTAKE_PARTIAL";
  if (input.warningCount > 0) return "INTAKE_READY_WITH_WARNINGS";
  return "INTAKE_READY";
}
