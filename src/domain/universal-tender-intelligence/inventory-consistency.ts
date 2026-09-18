/**
 * Package inventory consistency — Intake ↔ UTI ↔ Snapshot.
 *
 * Authority: buildCanonicalPackageInventory(files) — one identity = one member.
 * Counters are derived views. Never Math.max / overlapping arithmetic to hide mismatches.
 *
 * Finalization firewall: fail closed on identity mismatch when identity spaces
 * are comparable. Legacy fallback (intake disc_* vs UTI cuid-only) is count-only
 * and never invents members.
 */

import {
  buildCanonicalPackageInventory,
  isProceedableLifecycleState,
  type CanonicalInventoryFileInput,
} from "@/domain/universal-intake/canonical-inventory";

export type InventoryConsistencyInput = {
  persistedDocumentCount: number;
  utiInventoryCount: number;
  snapshotDiscoveredCount: number;
  intakeStoredCount?: number | null;
};

export type InventoryConsistencyResult =
  | { ok: true }
  | { ok: false; message: string; code: "INVENTORY_SHRINK" };

export function assertPackageInventoryConsistency(
  input: InventoryConsistencyInput,
): InventoryConsistencyResult {
  if (input.utiInventoryCount !== input.persistedDocumentCount) {
    return {
      ok: false,
      code: "INVENTORY_SHRINK",
      message: `UTI inventory ${input.utiInventoryCount} ≠ persisted documents ${input.persistedDocumentCount}`,
    };
  }
  if (input.utiInventoryCount !== input.snapshotDiscoveredCount) {
    return {
      ok: false,
      code: "INVENTORY_SHRINK",
      message: `UTI inventory ${input.utiInventoryCount} ≠ snapshot ${input.snapshotDiscoveredCount}`,
    };
  }
  if (
    input.intakeStoredCount != null &&
    input.intakeStoredCount > 0 &&
    input.utiInventoryCount !== input.intakeStoredCount
  ) {
    return {
      ok: false,
      code: "INVENTORY_SHRINK",
      message: `UTI inventory ${input.utiInventoryCount} ≠ intake stored ${input.intakeStoredCount}`,
    };
  }
  return { ok: true };
}

export type IntakeStoredCountReport = {
  /** @deprecated Prefer files[] / proceedableFileCount — may be wrong on legacy reports. */
  acceptedFileCount?: number;
  /** @deprecated Prefer files[] / proceedableFileCount. */
  recoverableFileCount?: number;
  proceedableFileCount?: number | null;
  files?: Array<{
    state: string;
    fileId?: string;
    originalName?: string | null;
    archivePath?: string | null;
    archiveFileName?: string | null;
  }>;
};

/**
 * Identity-based stored/proceedable member count.
 * Prefer files[] → canonical inventory; never trust inflated legacy aggregates alone.
 */
export function intakeStoredMemberCount(report: IntakeStoredCountReport): number {
  if (report.files && report.files.length > 0) {
    const inputs: CanonicalInventoryFileInput[] = report.files.map((f, i) => ({
      fileId: f.fileId?.trim() || `row_${i}`,
      state: f.state,
      originalName: f.originalName ?? null,
      archivePath: f.archivePath ?? null,
    }));
    return buildCanonicalPackageInventory(inputs).proceedableFileCount;
  }
  if (
    typeof report.proceedableFileCount === "number" &&
    report.proceedableFileCount >= 0
  ) {
    return report.proceedableFileCount;
  }
  // Last resort when only legacy aggregates exist (no files[], no proceedableFileCount).
  return (report.acceptedFileCount ?? 0) + (report.recoverableFileCount ?? 0);
}

/** Proceedable intake file identities (ACCEPTED / RECOVERABLE / future proceedable states). */
export function proceedableIntakeFileIds(report: IntakeStoredCountReport): string[] {
  if (!report.files?.length) return [];
  const inv = buildCanonicalPackageInventory(
    report.files.map((f, i) => ({
      fileId: f.fileId?.trim() || `row_${i}`,
      state: f.state,
      originalName: f.originalName ?? null,
      archivePath: f.archivePath ?? null,
    })),
  );
  return inv.files
    .filter((f) => isProceedableLifecycleState(f.state))
    .map((f) => f.identity);
}

/**
 * Detect legacy inflated counters without inventing phantom files.
 * Returns diagnostic only — callers must prefer files[] identity counts.
 */
export function detectLegacyCounterConflict(report: IntakeStoredCountReport): {
  hasConflict: boolean;
  identityProceedableCount: number;
  legacySum: number | null;
  message: string | null;
} {
  if (!report.files?.length) {
    return {
      hasConflict: false,
      identityProceedableCount: report.proceedableFileCount ?? 0,
      legacySum: null,
      message: null,
    };
  }
  const identityProceedableCount = intakeStoredMemberCount(report);
  const accepted = report.acceptedFileCount;
  const recoverable = report.recoverableFileCount;
  if (accepted == null || recoverable == null) {
    return {
      hasConflict: false,
      identityProceedableCount,
      legacySum: null,
      message: null,
    };
  }
  const legacySum = accepted + recoverable;
  const conflict = legacySum !== identityProceedableCount;
  return {
    hasConflict: conflict,
    identityProceedableCount,
    legacySum,
    message: conflict
      ? `Legacy intake counters (${accepted}+${recoverable}=${legacySum}) conflict with canonical proceedable identities (${identityProceedableCount}); using identity set.`
      : null,
  };
}

export type InventoryIdentityReconcileResult = {
  ok: boolean;
  missingFromUTI: string[];
  unexpectedInUTI: string[];
  duplicateIds: string[];
  duplicateIntake: string[];
  duplicateUti: string[];
  provenanceMismatches: Array<{
    fileId: string;
    intakeArchivePath: string | null;
    utiArchivePath: string | null;
  }>;
  /** @deprecated alias of missingFromUTI */
  missingInUti: string[];
  /** @deprecated alias of unexpectedInUTI */
  unexpectedInUti: string[];
  message: string | null;
};

/**
 * Identity-set reconciliation — not filename equality.
 * Optional provenance map: fileId → archivePath for mismatch diagnostics.
 */
export function reconcileInventoryIdentities(input: {
  intakeFileIds: readonly string[];
  utiFileIds: readonly string[];
  intakeProvenance?: ReadonlyMap<string, string | null>;
  utiProvenance?: ReadonlyMap<string, string | null>;
}): InventoryIdentityReconcileResult {
  const intakeUnique = new Set<string>();
  const duplicateIntake: string[] = [];
  for (const id of input.intakeFileIds) {
    if (!id) continue;
    if (intakeUnique.has(id)) duplicateIntake.push(id);
    else intakeUnique.add(id);
  }
  const utiUnique = new Set<string>();
  const duplicateUti: string[] = [];
  for (const id of input.utiFileIds) {
    if (!id) continue;
    if (utiUnique.has(id)) duplicateUti.push(id);
    else utiUnique.add(id);
  }
  const missingFromUTI = [...intakeUnique].filter((id) => !utiUnique.has(id));
  const unexpectedInUTI = [...utiUnique].filter((id) => !intakeUnique.has(id));
  const duplicateIds = [...new Set([...duplicateIntake, ...duplicateUti])];

  const provenanceMismatches: InventoryIdentityReconcileResult["provenanceMismatches"] =
    [];
  if (input.intakeProvenance && input.utiProvenance) {
    for (const id of intakeUnique) {
      if (!utiUnique.has(id)) continue;
      const a = input.intakeProvenance.get(id) ?? null;
      const b = input.utiProvenance.get(id) ?? null;
      if (a != null && b != null && a !== b) {
        provenanceMismatches.push({
          fileId: id,
          intakeArchivePath: a,
          utiArchivePath: b,
        });
      }
    }
  }

  const ok =
    missingFromUTI.length === 0 &&
    unexpectedInUTI.length === 0 &&
    duplicateIds.length === 0 &&
    provenanceMismatches.length === 0;
  const parts: string[] = [];
  if (missingFromUTI.length) {
    parts.push(`missingFromUTI=[${missingFromUTI.join(",")}]`);
  }
  if (unexpectedInUTI.length) {
    parts.push(`unexpectedInUTI=[${unexpectedInUTI.join(",")}]`);
  }
  if (duplicateIds.length) {
    parts.push(`duplicateIds=[${duplicateIds.join(",")}]`);
  }
  if (provenanceMismatches.length) {
    parts.push(
      `provenanceMismatch=[${provenanceMismatches.map((p) => p.fileId).join(",")}]`,
    );
  }
  return {
    ok,
    missingFromUTI,
    unexpectedInUTI,
    duplicateIds,
    duplicateIntake,
    duplicateUti,
    provenanceMismatches,
    missingInUti: missingFromUTI,
    unexpectedInUti: unexpectedInUTI,
    message: ok ? null : `Inventory identity mismatch: ${parts.join("; ")}`,
  };
}

/**
 * True when intake and UTI identity namespaces can be compared by set equality.
 * Legacy-only skip: intake uses disc_* and UTI has no disc_* and zero ID overlap.
 */
export function canReconcileIdentityNamespaces(
  intakeFileIds: readonly string[],
  utiFileIds: readonly string[],
): { comparable: boolean; reason: "COMPARABLE" | "LEGACY_NAMESPACE_SKIP" } {
  const intake = intakeFileIds.filter(Boolean);
  const uti = utiFileIds.filter(Boolean);
  if (intake.length === 0 || uti.length === 0) {
    return { comparable: false, reason: "LEGACY_NAMESPACE_SKIP" };
  }
  const intakeLooksDisc = intake.some((id) => id.startsWith("disc_"));
  const utiLooksDisc = uti.some((id) => id.startsWith("disc_"));
  const overlap = intake.some((id) => uti.includes(id));

  // Documented legacy fallback: discovery IDs on intake, DB cuids only on UTI.
  if (intakeLooksDisc && !utiLooksDisc && !overlap) {
    return { comparable: false, reason: "LEGACY_NAMESPACE_SKIP" };
  }
  return { comparable: true, reason: "COMPARABLE" };
}

export type FinalInventoryContractInput = {
  intakeReport: IntakeStoredCountReport | null;
  persistedDocumentCount: number;
  utiInventoryCount: number;
  snapshotDiscoveredCount: number;
  /** UTI file identities (discoveryId preferred; never invent from filename alone). */
  utiFileIds: readonly string[];
  /** Optional UTI archivePath by fileId for provenance diagnostics. */
  utiProvenanceByFileId?: ReadonlyMap<string, string | null>;
  /**
   * When true and intake identities are available, require set equality
   * whenever identity namespaces are comparable.
   */
  requireIdentityReconcile?: boolean;
};

export type FinalInventoryContractCode =
  | "INVENTORY_SHRINK"
  | "IDENTITY_MISMATCH"
  | "DUPLICATE_IDENTITY";

export type FinalInventoryContractResult =
  | {
      ok: true;
      intakeStoredCount: number;
      legacyConflict: ReturnType<typeof detectLegacyCounterConflict> | null;
      identityReconcile: InventoryIdentityReconcileResult | null;
      identityNamespace: "COMPARABLE" | "LEGACY_NAMESPACE_SKIP" | "NOT_APPLICABLE";
    }
  | {
      ok: false;
      code: FinalInventoryContractCode;
      message: string;
      intakeStoredCount: number;
      legacyConflict: ReturnType<typeof detectLegacyCounterConflict> | null;
      identityReconcile: InventoryIdentityReconcileResult | null;
      identityNamespace: "COMPARABLE" | "LEGACY_NAMESPACE_SKIP" | "NOT_APPLICABLE";
    };

/**
 * Pre-COMPLETED gate: count consistency + identity-set reconciliation (fail closed).
 * Never converts a comparable identity mismatch into count-only success.
 */
export function assertFinalPackageInventoryContract(
  input: FinalInventoryContractInput,
): FinalInventoryContractResult {
  const legacyConflict = input.intakeReport
    ? detectLegacyCounterConflict(input.intakeReport)
    : null;

  const intakeStoredCount = input.intakeReport
    ? intakeStoredMemberCount(input.intakeReport)
    : input.persistedDocumentCount;

  // Duplicate identities in intake files[] — fail closed.
  if (input.intakeReport?.files?.length) {
    const inv = buildCanonicalPackageInventory(
      input.intakeReport.files.map((f, i) => ({
        fileId: f.fileId?.trim() || `row_${i}`,
        state: f.state,
        originalName: f.originalName ?? null,
        archivePath: f.archivePath ?? null,
      })),
    );
    if (inv.duplicateIdentities.length > 0) {
      return {
        ok: false,
        code: "DUPLICATE_IDENTITY",
        message: `Duplicate canonical identities: [${inv.duplicateIdentities.join(",")}]`,
        intakeStoredCount,
        legacyConflict,
        identityReconcile: null,
        identityNamespace: "NOT_APPLICABLE",
      };
    }
  }

  const countCheck = assertPackageInventoryConsistency({
    persistedDocumentCount: input.persistedDocumentCount,
    utiInventoryCount: input.utiInventoryCount,
    snapshotDiscoveredCount: input.snapshotDiscoveredCount,
    intakeStoredCount,
  });

  if (!countCheck.ok) {
    return {
      ok: false,
      code: "INVENTORY_SHRINK",
      message: countCheck.message,
      intakeStoredCount,
      legacyConflict,
      identityReconcile: null,
      identityNamespace: "NOT_APPLICABLE",
    };
  }

  let identityReconcile: InventoryIdentityReconcileResult | null = null;
  let identityNamespace: "COMPARABLE" | "LEGACY_NAMESPACE_SKIP" | "NOT_APPLICABLE" =
    "NOT_APPLICABLE";

  if (input.intakeReport?.files?.length && input.requireIdentityReconcile !== false) {
    const intakeIds = proceedableIntakeFileIds(input.intakeReport);
    const utiIds = input.utiFileIds.filter(Boolean);
    if (intakeIds.length > 0 && utiIds.length > 0) {
      const ns = canReconcileIdentityNamespaces(intakeIds, utiIds);
      identityNamespace = ns.reason;
      if (ns.comparable) {
        const intakeProvenance = new Map<string, string | null>();
        for (const f of input.intakeReport.files) {
          const id = f.fileId?.trim();
          if (id) intakeProvenance.set(id, f.archivePath ?? null);
        }
        identityReconcile = reconcileInventoryIdentities({
          intakeFileIds: intakeIds,
          utiFileIds: utiIds,
          intakeProvenance,
          utiProvenance: input.utiProvenanceByFileId,
        });
        // FAIL CLOSED — never convert comparable identity mismatch into count-only success.
        if (!identityReconcile.ok) {
          return {
            ok: false,
            code: "IDENTITY_MISMATCH",
            message: identityReconcile.message ?? "Inventory identity mismatch",
            intakeStoredCount,
            legacyConflict,
            identityReconcile,
            identityNamespace,
          };
        }
      }
      // LEGACY_NAMESPACE_SKIP: count check already passed; do not invent identity equality.
    }
  }

  return {
    ok: true,
    intakeStoredCount,
    legacyConflict,
    identityReconcile,
    identityNamespace,
  };
}

/** Resolve package discovery identity from tender document extractionMeta. */
export function discoveryIdFromExtractionMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const record = meta as Record<string, unknown>;
  const prov = record.packageProvenance;
  if (prov && typeof prov === "object" && !Array.isArray(prov)) {
    const id = (prov as Record<string, unknown>).discoveryId;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  if (typeof record.discoveryId === "string" && record.discoveryId.trim()) {
    return record.discoveryId.trim();
  }
  return null;
}
