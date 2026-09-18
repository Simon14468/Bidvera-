/**
 * Final adversarial integrity audit — inventory contract firewall.
 * No second inventory layer; verifies identity authority + fail-closed finalization.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCanonicalPackageInventory,
  withProceedableStates,
  countProceedableWithStates,
} from "@/domain/universal-intake/canonical-inventory";
import {
  assertFinalPackageInventoryContract,
  canReconcileIdentityNamespaces,
  detectLegacyCounterConflict,
  intakeStoredMemberCount,
  reconcileInventoryIdentities,
} from "@/domain/universal-tender-intelligence/inventory-consistency";

function row(
  id: string,
  state: string,
  extra?: {
    readiness?: string;
    recoveryClass?: string;
    originalName?: string;
    archivePath?: string;
    archiveFileName?: string;
  },
) {
  return {
    fileId: id,
    state,
    readiness: extra?.readiness ?? null,
    recoveryClass: extra?.recoveryClass ?? null,
    originalName: extra?.originalName ?? `${id}.pdf`,
    archivePath: extra?.archivePath ?? null,
    archiveFileName: extra?.archiveFileName ?? null,
  };
}

describe("adversarial inventory firewall — state matrix", () => {
  it("one package: every lifecycle/readiness state is one identity, never extra members", () => {
    const files = [
      row("id_accepted", "ACCEPTED"),
      row("id_recoverable", "RECOVERABLE"),
      row("id_partial", "PARTIALLY_RECOVERABLE"),
      row("id_password", "PASSWORD_PROTECTED", {
        recoveryClass: "USER_ACTION_REQUIRED",
      }),
      row("id_ocr", "ACCEPTED", { readiness: "NEEDS_OCR" }),
      row("id_user_action", "PASSWORD_PROTECTED", {
        recoveryClass: "USER_ACTION_REQUIRED",
        originalName: "locked.pdf",
      }),
      row("id_unsupported", "UNSUPPORTED_SKIPPED"),
      row("id_corrupt", "CORRUPTED"),
      row("id_security", "SECURITY_FAILURE"),
    ];
    // OCR_REQUIRED and USER_ACTION_REQUIRED are readiness/recovery dimensions —
    // id_ocr stays ACCEPTED; id_user_action shares PASSWORD_PROTECTED with id_password
    // but is a distinct identity.
    const inv = buildCanonicalPackageInventory(files);
    assert.equal(inv.totalFiles, 9);
    assert.equal(inv.countByState("ACCEPTED"), 2); // accepted + ocr-as-readiness
    assert.equal(inv.countByState("RECOVERABLE"), 1);
    assert.equal(inv.countByState("PARTIALLY_RECOVERABLE"), 1);
    assert.equal(inv.countByState("PASSWORD_PROTECTED"), 2);
    assert.equal(inv.countByState("UNSUPPORTED_SKIPPED"), 1);
    assert.equal(inv.countByState("CORRUPTED"), 1);
    assert.equal(inv.countByState("SECURITY_FAILURE"), 1);
    assert.equal(inv.proceedableFileCount, 4); // ACCEPTED×2 + RECOVERABLE + PARTIALLY
    assert.equal(inv.storedInventoryCount, inv.proceedableFileCount);
    assert.equal(inv.duplicateIdentities.length, 0);
  });

  it("state transitions mutate dimensions of the same identity — totalFiles never increases", () => {
    const transitions: Array<[string, string]> = [
      ["ACCEPTED", "RECOVERABLE"],
      ["RECOVERABLE", "ACCEPTED"],
      ["RECOVERABLE", "PARTIALLY_RECOVERABLE"],
      ["PASSWORD_PROTECTED", "ACCEPTED"],
      ["ACCEPTED", "ACCEPTED"], // OCR_REQUIRED→ACCEPTED (readiness cleared)
      ["PASSWORD_PROTECTED", "ACCEPTED"], // USER_ACTION→ACCEPTED
    ];
    for (const [from, to] of transitions) {
      const before = buildCanonicalPackageInventory([
        row("stable_id", from, {
          readiness: from === "ACCEPTED" ? "NEEDS_OCR" : undefined,
          recoveryClass:
            from === "PASSWORD_PROTECTED" ? "USER_ACTION_REQUIRED" : undefined,
        }),
        row("peer", "ACCEPTED"),
      ]);
      const after = buildCanonicalPackageInventory([
        row("stable_id", to),
        row("peer", "ACCEPTED"),
      ]);
      assert.equal(before.totalFiles, 2, `${from}→${to} before`);
      assert.equal(after.totalFiles, 2, `${from}→${to} after`);
      assert.equal(after.files.find((f) => f.identity === "stable_id")?.state, to);
    }
  });

  it("PASSWORD_REQUIRED / OCR_REQUIRED / USER_ACTION_REQUIRED never invent members", () => {
    const inv = buildCanonicalPackageInventory([
      row("a", "PASSWORD_PROTECTED"),
      row("b", "ACCEPTED", { readiness: "NEEDS_OCR" }),
      row("c", "PASSWORD_PROTECTED", {
        recoveryClass: "USER_ACTION_REQUIRED",
      }),
    ]);
    assert.equal(inv.totalFiles, 3);
    assert.equal(inv.proceedableFileCount, 1);
  });
});

describe("adversarial inventory firewall — finalization fail-closed", () => {
  it("comparable non-disc identity mismatch fails closed (not count-only success)", () => {
    const files = [
      row("cuid_a", "ACCEPTED"),
      row("cuid_b", "ACCEPTED"),
      row("cuid_c", "RECOVERABLE"),
    ];
    const gate = assertFinalPackageInventoryContract({
      intakeReport: { files, acceptedFileCount: 2, recoverableFileCount: 1 },
      persistedDocumentCount: 3,
      utiInventoryCount: 3,
      snapshotDiscoveredCount: 3,
      // Counts match but identity set does not — must FAIL.
      utiFileIds: ["cuid_a", "cuid_b", "cuid_ghost"],
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) {
      assert.equal(gate.code, "IDENTITY_MISMATCH");
      assert.ok(gate.identityReconcile?.unexpectedInUTI.includes("cuid_ghost"));
      assert.ok(gate.identityReconcile?.missingFromUTI.includes("cuid_c"));
    }
  });

  it("legacy disc_* intake vs cuid-only UTI skips set equality without inventing members", () => {
    const files = [
      row("disc_1", "ACCEPTED"),
      row("disc_2", "RECOVERABLE"),
    ];
    const ns = canReconcileIdentityNamespaces(
      ["disc_1", "disc_2"],
      ["clxxxxxxxx0001", "clxxxxxxxx0002"],
    );
    assert.equal(ns.comparable, false);
    assert.equal(ns.reason, "LEGACY_NAMESPACE_SKIP");

    const gate = assertFinalPackageInventoryContract({
      intakeReport: { files, acceptedFileCount: 1, recoverableFileCount: 1 },
      persistedDocumentCount: 2,
      utiInventoryCount: 2,
      snapshotDiscoveredCount: 2,
      utiFileIds: ["clxxxxxxxx0001", "clxxxxxxxx0002"],
    });
    assert.equal(gate.ok, true);
    assert.equal(gate.identityNamespace, "LEGACY_NAMESPACE_SKIP");
    assert.equal(gate.intakeStoredCount, 2);
  });

  it("duplicate intake identity fails closed at finalization", () => {
    const gate = assertFinalPackageInventoryContract({
      intakeReport: {
        files: [
          row("dup", "ACCEPTED"),
          row("dup", "RECOVERABLE"),
          row("other", "ACCEPTED"),
        ],
        acceptedFileCount: 1,
        recoverableFileCount: 1,
      },
      persistedDocumentCount: 2,
      utiInventoryCount: 2,
      snapshotDiscoveredCount: 2,
      utiFileIds: ["dup", "other"],
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.code, "DUPLICATE_IDENTITY");
  });

  it("provenance mismatch fails closed when both sides have archivePath", () => {
    const files = [
      row("disc_a", "ACCEPTED", { archivePath: "vol1/a.pdf" }),
      row("disc_b", "ACCEPTED", { archivePath: "vol1/b.pdf" }),
    ];
    const utiProvenanceByFileId = new Map<string, string | null>([
      ["disc_a", "vol2/a.pdf"], // wrong archive path
      ["disc_b", "vol1/b.pdf"],
    ]);
    const gate = assertFinalPackageInventoryContract({
      intakeReport: { files, acceptedFileCount: 2, recoverableFileCount: 0 },
      persistedDocumentCount: 2,
      utiInventoryCount: 2,
      snapshotDiscoveredCount: 2,
      utiFileIds: ["disc_a", "disc_b"],
      utiProvenanceByFileId,
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) {
      assert.equal(gate.code, "IDENTITY_MISMATCH");
      assert.equal(gate.identityReconcile?.provenanceMismatches.length, 1);
    }
  });

  it("legacy inflated 6+2=8 never becomes inventory membership", () => {
    const files = [
      row("1", "RECOVERABLE"),
      row("2", "RECOVERABLE"),
      row("3", "ACCEPTED"),
      row("4", "ACCEPTED"),
      row("5", "ACCEPTED"),
      row("6", "ACCEPTED"),
    ];
    const report = {
      acceptedFileCount: 6,
      recoverableFileCount: 2,
      files,
    };
    assert.equal(intakeStoredMemberCount(report), 6);
    assert.equal(detectLegacyCounterConflict(report).legacySum, 8);
    const gate = assertFinalPackageInventoryContract({
      intakeReport: report,
      persistedDocumentCount: 6,
      utiInventoryCount: 6,
      snapshotDiscoveredCount: 6,
      utiFileIds: files.map((f) => f.fileId),
    });
    assert.equal(gate.ok, true);
    assert.equal(gate.intakeStoredCount, 6);
  });

  it("reconcile reports missing / unexpected / duplicates explicitly", () => {
    const r = reconcileInventoryIdentities({
      intakeFileIds: ["a", "b", "b"],
      utiFileIds: ["a", "c"],
    });
    assert.equal(r.ok, false);
    assert.deepEqual(r.missingFromUTI, ["b"]);
    assert.deepEqual(r.unexpectedInUTI, ["c"]);
    assert.ok(r.duplicateIds.includes("b"));
  });

  it("extending proceedable states does not require a+b formulas", () => {
    const files = [
      row("a", "ACCEPTED"),
      row("p", "PASSWORD_PROTECTED"),
      row("u", "UNSUPPORTED_SKIPPED"),
    ];
    assert.equal(buildCanonicalPackageInventory(files).proceedableFileCount, 1);
    const ext = withProceedableStates(["PASSWORD_PROTECTED"]);
    assert.equal(countProceedableWithStates(files, ext), 2);
  });
});
