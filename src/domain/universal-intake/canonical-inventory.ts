/**
 * Canonical package inventory — ONE physical/discovered file = ONE identity.
 *
 * Counters are DERIVED VIEWS over unique file identities.
 * Never treat overlapping state counters as independent sets.
 *
 * IDENTITY  = unique fileId records
 * STATE     = lifecycle state per identity
 * ELIGIBILITY = proceedable membership (extensible set)
 * COUNTERS  = countByState / proceedableFileCount / totalFiles
 */

import type { IntakeFileTerminalState } from "./types";

/**
 * Lifecycle states that may proceed to storage / analysis eligibility.
 * Extend this set when adding new proceedable states — never invent a+b formulas.
 */
export const PROCEEDABLE_LIFECYCLE_STATES: ReadonlySet<string> = new Set([
  "ACCEPTED",
  "RECOVERABLE",
  // Future-ready membership (not yet emitted by intake enum — safe for tests / forward compat):
  "PARTIALLY_RECOVERABLE",
]);

/** Stored inventory members = proceedable identities (accepted / recoverable / …). */
export const STORED_INVENTORY_LIFECYCLE_STATES = PROCEEDABLE_LIFECYCLE_STATES;

export type CanonicalInventoryFileInput = {
  /** Stable discovery / intake identity — required for uniqueness. */
  fileId: string;
  /** Lifecycle / terminal state (open string for future states). */
  state: string;
  /** Optional readiness dimension — does NOT create a second identity. */
  readiness?: string | null;
  /** Optional recovery class — does NOT create a second identity. */
  recoveryClass?: string | null;
  originalName?: string | null;
  displayName?: string | null;
  source?: string | null;
  archiveFileName?: string | null;
  archivePath?: string | null;
  sniffedKind?: string | null;
};

export type CanonicalInventoryFile = CanonicalInventoryFileInput & {
  identity: string;
};

export type CanonicalPackageInventory = {
  /** Unique canonical file identities (duplicates collapsed; first wins). */
  files: readonly CanonicalInventoryFile[];
  /** fileIds that appeared more than once in the input. */
  duplicateIdentities: readonly string[];
  /** Identity count — never a sum of state counters. */
  totalFiles: number;
  /** Derived: state === ACCEPTED only. */
  acceptedFileCount: number;
  /** Derived: state === RECOVERABLE only. */
  recoverableFileCount: number;
  /** Derived: unique files whose state ∈ PROCEEDABLE_LIFECYCLE_STATES. */
  proceedableFileCount: number;
  /** Alias of proceedableFileCount — stored/accepted-for-storage inventory size. */
  storedInventoryCount: number;
  /** Derived count for any state string (unknown/future states supported). */
  countByState: (state: string) => number;
  /** All distinct lifecycle states present. */
  statesPresent: readonly string[];
};

function identityKey(file: CanonicalInventoryFileInput): string {
  const id = (file.fileId ?? "").trim();
  if (id) return id;
  // Fallback when callers omit fileId — still one row per record, not double-count by state.
  return `anon:${file.originalName ?? ""}:${file.archivePath ?? ""}:${file.state}`;
}

/**
 * Build the authoritative package inventory from file records.
 * Duplicate fileIds are detected and counted once.
 */
export function buildCanonicalPackageInventory(
  inputFiles: readonly CanonicalInventoryFileInput[],
): CanonicalPackageInventory {
  const seen = new Map<string, CanonicalInventoryFile>();
  const duplicateIdentities: string[] = [];
  const dupOnce = new Set<string>();

  for (const raw of inputFiles) {
    const identity = identityKey(raw);
    if (seen.has(identity)) {
      if (!dupOnce.has(identity)) {
        duplicateIdentities.push(identity);
        dupOnce.add(identity);
      }
      continue;
    }
    seen.set(identity, {
      ...raw,
      fileId: raw.fileId || identity,
      identity,
      state: String(raw.state ?? "UNKNOWN"),
    });
  }

  const files = [...seen.values()];
  const byState = new Map<string, number>();
  for (const f of files) {
    byState.set(f.state, (byState.get(f.state) ?? 0) + 1);
  }

  const countByState = (state: string): number => byState.get(state) ?? 0;

  const acceptedFileCount = countByState("ACCEPTED");
  const recoverableFileCount = countByState("RECOVERABLE");
  const proceedableFileCount = files.filter((f) =>
    PROCEEDABLE_LIFECYCLE_STATES.has(f.state),
  ).length;

  return {
    files,
    duplicateIdentities,
    totalFiles: files.length,
    acceptedFileCount,
    recoverableFileCount,
    proceedableFileCount,
    storedInventoryCount: proceedableFileCount,
    countByState,
    statesPresent: [...byState.keys()].sort(),
  };
}

/**
 * Derive disjoint counter snapshot from an inventory.
 * Safe to call repeatedly — deterministic.
 */
export function deriveInventoryCounters(inventory: CanonicalPackageInventory): {
  totalFiles: number;
  acceptedFileCount: number;
  recoverableFileCount: number;
  proceedableFileCount: number;
  storedInventoryCount: number;
  countsByState: Record<string, number>;
} {
  const countsByState: Record<string, number> = {};
  for (const state of inventory.statesPresent) {
    countsByState[state] = inventory.countByState(state);
  }
  return {
    totalFiles: inventory.totalFiles,
    acceptedFileCount: inventory.acceptedFileCount,
    recoverableFileCount: inventory.recoverableFileCount,
    proceedableFileCount: inventory.proceedableFileCount,
    storedInventoryCount: inventory.storedInventoryCount,
    countsByState,
  };
}

/** True when a lifecycle state is analysis/storage-proceedable. */
export function isProceedableLifecycleState(state: string): boolean {
  return PROCEEDABLE_LIFECYCLE_STATES.has(state);
}

/**
 * Register an additional proceedable lifecycle state (tests / future intake enums).
 * Does not change arithmetic — membership drives counts.
 */
export function withProceedableStates(
  extraStates: readonly string[],
): ReadonlySet<string> {
  return new Set([...PROCEEDABLE_LIFECYCLE_STATES, ...extraStates]);
}

export function countProceedableWithStates(
  files: readonly CanonicalInventoryFileInput[],
  proceedableStates: ReadonlySet<string>,
): number {
  const inventory = buildCanonicalPackageInventory(files);
  return inventory.files.filter((f) => proceedableStates.has(f.state)).length;
}

/** Type guard helper for known intake terminal states. */
export function isKnownIntakeTerminalState(
  state: string,
): state is IntakeFileTerminalState {
  return (
    state === "ACCEPTED" ||
    state === "RECOVERABLE" ||
    state === "REJECTED_EMPTY" ||
    state === "REJECTED_ZERO_BYTE" ||
    state === "REJECTED_UNSUPPORTED" ||
    state === "REJECTED_SPOOFED_EXTENSION" ||
    state === "REJECTED_MIME_MISMATCH" ||
    state === "REJECTED_DANGEROUS" ||
    state === "REJECTED_DUPLICATE" ||
    state === "REJECTED_TOO_LARGE" ||
    state === "CORRUPTED" ||
    state === "PASSWORD_PROTECTED" ||
    state === "UNREADABLE" ||
    state === "SECURITY_FAILURE" ||
    state === "NESTED_ARCHIVE_BLOCKED" ||
    state === "UNSUPPORTED_SKIPPED" ||
    state === "ARCHIVE_MEMBER_SKIPPED"
  );
}
