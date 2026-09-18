/**
 * Canonical package inventory — identity authority + derived counters.
 * Proves RECOVERABLE cannot inflate both accepted and recoverable counts.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCanonicalPackageInventory,
  countProceedableWithStates,
  deriveInventoryCounters,
  withProceedableStates,
} from "./canonical-inventory";
import { intakeStoredMemberCount } from "@/domain/universal-tender-intelligence/inventory-consistency";

function file(id: string, state: string) {
  return { fileId: id, state, originalName: `${id}.pdf` };
}

describe("canonical package inventory — identity authority", () => {
  it("A/B: 4 ACCEPTED + 2 RECOVERABLE = 6 unique; disjoint counters", () => {
    const files = [
      file("a1", "ACCEPTED"),
      file("a2", "ACCEPTED"),
      file("a3", "ACCEPTED"),
      file("a4", "ACCEPTED"),
      file("r1", "RECOVERABLE"),
      file("r2", "RECOVERABLE"),
    ];
    const inv = buildCanonicalPackageInventory(files);
    assert.equal(inv.totalFiles, 6);
    assert.equal(inv.acceptedFileCount, 4);
    assert.equal(inv.recoverableFileCount, 2);
    assert.equal(inv.proceedableFileCount, 6);
    assert.equal(inv.storedInventoryCount, 6);
    assert.equal(inv.acceptedFileCount + inv.recoverableFileCount, inv.proceedableFileCount);
  });

  it("C: same RECOVERABLE file cannot contribute to both accepted and recoverable", () => {
    const inv = buildCanonicalPackageInventory([
      file("only", "RECOVERABLE"),
      file("ok", "ACCEPTED"),
    ]);
    assert.equal(inv.acceptedFileCount, 1);
    assert.equal(inv.recoverableFileCount, 1);
    assert.equal(inv.totalFiles, 2);
    // Disjoint: no identity is counted in both buckets
    assert.equal(
      inv.acceptedFileCount + inv.recoverableFileCount,
      inv.proceedableFileCount,
    );
  });

  it("D: rollup calculation is deterministic when called twice", () => {
    const files = [file("a", "ACCEPTED"), file("r", "RECOVERABLE")];
    const a = deriveInventoryCounters(buildCanonicalPackageInventory(files));
    const b = deriveInventoryCounters(buildCanonicalPackageInventory(files));
    assert.deepEqual(a, b);
  });

  it("E: order of files does not change counts", () => {
    const forward = buildCanonicalPackageInventory([
      file("r1", "RECOVERABLE"),
      file("a1", "ACCEPTED"),
      file("a2", "ACCEPTED"),
    ]);
    const reverse = buildCanonicalPackageInventory([
      file("a2", "ACCEPTED"),
      file("a1", "ACCEPTED"),
      file("r1", "RECOVERABLE"),
    ]);
    assert.equal(forward.totalFiles, reverse.totalFiles);
    assert.equal(forward.acceptedFileCount, reverse.acceptedFileCount);
    assert.equal(forward.recoverableFileCount, reverse.recoverableFileCount);
    assert.equal(forward.proceedableFileCount, reverse.proceedableFileCount);
  });

  it("F: duplicate canonical identities are detected, not counted twice", () => {
    const inv = buildCanonicalPackageInventory([
      file("dup", "ACCEPTED"),
      file("dup", "RECOVERABLE"), // same identity — second ignored
      file("other", "ACCEPTED"),
    ]);
    assert.equal(inv.totalFiles, 2);
    assert.deepEqual(inv.duplicateIdentities, ["dup"]);
    assert.equal(inv.acceptedFileCount, 2); // first wins as ACCEPTED
    assert.equal(inv.recoverableFileCount, 0);
  });

  it("G: state change ACCEPTED → RECOVERABLE changes state counters, not identity count", () => {
    const before = buildCanonicalPackageInventory([
      file("x", "ACCEPTED"),
      file("y", "ACCEPTED"),
    ]);
    const after = buildCanonicalPackageInventory([
      file("x", "RECOVERABLE"),
      file("y", "ACCEPTED"),
    ]);
    assert.equal(before.totalFiles, after.totalFiles);
    assert.equal(before.acceptedFileCount, 2);
    assert.equal(after.acceptedFileCount, 1);
    assert.equal(after.recoverableFileCount, 1);
    assert.equal(after.proceedableFileCount, 2);
  });

  it("H: PARTIALLY_RECOVERABLE does not require modifying arithmetic formulas", () => {
    const files = [
      file("a", "ACCEPTED"),
      file("p", "PARTIALLY_RECOVERABLE"),
    ];
    const inv = buildCanonicalPackageInventory(files);
    assert.equal(inv.totalFiles, 2);
    assert.equal(inv.countByState("PARTIALLY_RECOVERABLE"), 1);
    // Proceedable via set membership — not a+b of named counters
    assert.equal(inv.proceedableFileCount, 2);
    assert.equal(inv.acceptedFileCount + inv.recoverableFileCount, 1); // only ACCEPTED in those two fields
  });

  it("I: PASSWORD_REQUIRED / PASSWORD_PROTECTED does not double count", () => {
    const inv = buildCanonicalPackageInventory([
      file("a", "ACCEPTED"),
      file("pw", "PASSWORD_PROTECTED"),
    ]);
    assert.equal(inv.totalFiles, 2);
    assert.equal(inv.proceedableFileCount, 1);
    assert.equal(inv.countByState("PASSWORD_PROTECTED"), 1);
    assert.equal(inv.acceptedFileCount + inv.recoverableFileCount, 1);
  });

  it("J: OCR_REQUIRED as readiness does not create a second identity", () => {
    const inv = buildCanonicalPackageInventory([
      {
        fileId: "scan",
        state: "ACCEPTED",
        readiness: "NEEDS_OCR",
        recoveryClass: null,
      },
    ]);
    assert.equal(inv.totalFiles, 1);
    assert.equal(inv.proceedableFileCount, 1);
  });

  it("K: USER_ACTION_REQUIRED remains one file", () => {
    const inv = buildCanonicalPackageInventory([
      {
        fileId: "locked",
        state: "PASSWORD_PROTECTED",
        recoveryClass: "USER_ACTION_REQUIRED",
      },
    ]);
    assert.equal(inv.totalFiles, 1);
    assert.equal(inv.proceedableFileCount, 0);
  });

  it("L: unknown/future state does not create duplicate inventory members", () => {
    const inv = buildCanonicalPackageInventory([
      file("f1", "FUTURE_EXOTIC_STATE"),
      file("f1", "FUTURE_EXOTIC_STATE"),
    ]);
    assert.equal(inv.totalFiles, 1);
    assert.equal(inv.countByState("FUTURE_EXOTIC_STATE"), 1);
    assert.equal(inv.duplicateIdentities.length, 1);
  });

  it("M: inventory authority remains identity-based when rollups change", () => {
    const files = [
      file("a", "ACCEPTED"),
      file("r", "RECOVERABLE"),
      file("u", "UNSUPPORTED_SKIPPED"),
    ];
    const inv = buildCanonicalPackageInventory(files);
    const counters = deriveInventoryCounters(inv);
    assert.equal(counters.totalFiles, inv.files.length);
    assert.equal(counters.proceedableFileCount, 2);
    assert.equal(counters.countsByState.UNSUPPORTED_SKIPPED, 1);
  });

  it("N: intakeStoredMemberCount never encodes accepted+recoverable when accepted already includes recoverable", () => {
    // Legacy broken report shape (Tender 310896 class): acceptedFileCount=6 already includes recoverables
    const brokenLegacy = {
      acceptedFileCount: 6,
      recoverableFileCount: 2,
      files: [
        file("1", "RECOVERABLE"),
        file("2", "RECOVERABLE"),
        file("3", "ACCEPTED"),
        file("4", "ACCEPTED"),
        file("5", "ACCEPTED"),
        file("6", "ACCEPTED"),
      ],
    };
    assert.equal(intakeStoredMemberCount(brokenLegacy), 6);
    assert.notEqual(
      brokenLegacy.acceptedFileCount + brokenLegacy.recoverableFileCount,
      intakeStoredMemberCount(brokenLegacy),
    );
  });

  it("extending proceedable set does not require a+b formulas", () => {
    const files = [
      file("a", "ACCEPTED"),
      file("ocr", "OCR_REQUIRED"),
    ];
    const extended = withProceedableStates(["OCR_REQUIRED"]);
    assert.equal(countProceedableWithStates(files, extended), 2);
    // Default set still treats OCR_REQUIRED as non-proceedable until registered
    assert.equal(buildCanonicalPackageInventory(files).proceedableFileCount, 1);
  });
});
