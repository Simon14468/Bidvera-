/**
 * Adversarial pipeline inventory propagation — Intake → UTI → finalization contract.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildCanonicalPackageInventory,
  withProceedableStates,
  countProceedableWithStates,
} from "@/domain/universal-intake/canonical-inventory";
import {
  assertFinalPackageInventoryContract,
  detectLegacyCounterConflict,
  intakeStoredMemberCount,
  proceedableIntakeFileIds,
  reconcileInventoryIdentities,
  discoveryIdFromExtractionMeta,
} from "@/domain/universal-tender-intelligence/inventory-consistency";
import { buildUniversalTenderPackage, toUtiSummary } from "@/domain/universal-tender-intelligence";

function f(id: string, state: string, extra?: { originalName?: string; archivePath?: string }) {
  return {
    fileId: id,
    state,
    originalName: extra?.originalName ?? `${id}.pdf`,
    archivePath: extra?.archivePath ?? null,
  };
}

describe("pipeline inventory propagation A–R", () => {
  it("A: 4 ACCEPTED + 2 RECOVERABLE = 6 unique through final contract", () => {
    const files = [
      f("a1", "ACCEPTED"),
      f("a2", "ACCEPTED"),
      f("a3", "ACCEPTED"),
      f("a4", "ACCEPTED"),
      f("r1", "RECOVERABLE"),
      f("r2", "RECOVERABLE"),
    ];
    const inv = buildCanonicalPackageInventory(files);
    assert.equal(inv.totalFiles, 6);
    assert.equal(inv.acceptedFileCount, 4);
    assert.equal(inv.recoverableFileCount, 2);
    assert.equal(inv.proceedableFileCount, 6);

    const uti = buildUniversalTenderPackage({
      packageLabel: "pack",
      parts: files.map((x) => ({
        fileId: x.fileId,
        fileName: x.originalName!,
        text: "The bidder shall submit documents. " + "x".repeat(80),
      })),
    });
    assert.equal(toUtiSummary(uti).inventoryCount, 6);

    const gate = assertFinalPackageInventoryContract({
      intakeReport: {
        acceptedFileCount: 4,
        recoverableFileCount: 2,
        proceedableFileCount: 6,
        files,
      },
      persistedDocumentCount: 6,
      utiInventoryCount: 6,
      snapshotDiscoveredCount: 6,
      utiFileIds: files.map((x) => x.fileId),
    });
    assert.equal(gate.ok, true);
  });

  it("B: same filename different file IDs stay distinct", () => {
    const files = [
      f("id1", "ACCEPTED", { originalName: "same.pdf", archivePath: "a/same.pdf" }),
      f("id2", "ACCEPTED", { originalName: "same.pdf", archivePath: "b/same.pdf" }),
    ];
    assert.equal(buildCanonicalPackageInventory(files).totalFiles, 2);
  });

  it("C: duplicate file ID detected once", () => {
    const inv = buildCanonicalPackageInventory([
      f("dup", "ACCEPTED"),
      f("dup", "RECOVERABLE"),
    ]);
    assert.equal(inv.totalFiles, 1);
    assert.ok(inv.duplicateIdentities.includes("dup"));
  });

  it("D/E: ACCEPTED ↔ RECOVERABLE transitions keep identity count", () => {
    const before = buildCanonicalPackageInventory([f("x", "ACCEPTED"), f("y", "ACCEPTED")]);
    const after = buildCanonicalPackageInventory([f("x", "RECOVERABLE"), f("y", "ACCEPTED")]);
    const back = buildCanonicalPackageInventory([f("x", "ACCEPTED"), f("y", "ACCEPTED")]);
    assert.equal(before.totalFiles, after.totalFiles);
    assert.equal(after.totalFiles, back.totalFiles);
    assert.equal(after.recoverableFileCount, 1);
    assert.equal(back.recoverableFileCount, 0);
  });

  it("F/G/H/I/J: future/adjacent states do not invent members", () => {
    const files = [
      f("a", "ACCEPTED"),
      f("pw", "PASSWORD_PROTECTED"),
      {
        fileId: "ocr",
        state: "ACCEPTED",
        readiness: "NEEDS_OCR",
        originalName: "scan.pdf",
      },
      f("pr", "PARTIALLY_RECOVERABLE"),
      {
        fileId: "ua",
        state: "PASSWORD_PROTECTED",
        recoveryClass: "USER_ACTION_REQUIRED",
        originalName: "locked.pdf",
      },
      f("u", "UNSUPPORTED_SKIPPED"),
    ];
    const inv = buildCanonicalPackageInventory(files);
    assert.equal(inv.totalFiles, 6);
    assert.equal(inv.countByState("PASSWORD_PROTECTED"), 2);
    assert.equal(inv.countByState("UNSUPPORTED_SKIPPED"), 1);
    assert.equal(inv.proceedableFileCount, 3); // 2 ACCEPTED + PARTIALLY_RECOVERABLE
    const extended = withProceedableStates(["PASSWORD_PROTECTED"]);
    assert.equal(countProceedableWithStates(files, extended), 5);
  });

  it("K/L: archive extracted + recovered members keep one identity each", () => {
    const files = [
      f("disc_1", "RECOVERABLE", {
        originalName: "1. Offerors.pdf",
        archivePath: "1. Offerors.pdf",
      }),
      f("disc_2", "ACCEPTED", {
        originalName: "2. Eval.pdf",
        archivePath: "2. Eval.pdf",
      }),
    ];
    const inv = buildCanonicalPackageInventory(files);
    assert.equal(inv.totalFiles, 2);
    assert.equal(inv.proceedableFileCount, 2);
    const uti = buildUniversalTenderPackage({
      packageLabel: "zip",
      parts: files.map((x) => ({
        fileId: x.fileId,
        fileName: x.originalName!,
        archiveSource: "zip" as const,
        archivePath: x.archivePath,
        text: "Bidder shall provide. " + "y".repeat(80),
      })),
    });
    const gate = assertFinalPackageInventoryContract({
      intakeReport: { files, acceptedFileCount: 1, recoverableFileCount: 1 },
      persistedDocumentCount: 2,
      utiInventoryCount: uti.inventoryCount,
      snapshotDiscoveredCount: 2,
      utiFileIds: uti.documents.map((d) => d.fileId),
    });
    assert.equal(gate.ok, true);
  });

  it("M: legacy inflated counters do not create phantoms", () => {
    const files = [
      f("1", "RECOVERABLE"),
      f("2", "RECOVERABLE"),
      f("3", "ACCEPTED"),
      f("4", "ACCEPTED"),
      f("5", "ACCEPTED"),
      f("6", "ACCEPTED"),
    ];
    const legacy = {
      acceptedFileCount: 6,
      recoverableFileCount: 2,
      files,
    };
    assert.equal(intakeStoredMemberCount(legacy), 6);
    const conflict = detectLegacyCounterConflict(legacy);
    assert.equal(conflict.hasConflict, true);
    assert.equal(conflict.identityProceedableCount, 6);
    assert.equal(conflict.legacySum, 8);

    const gate = assertFinalPackageInventoryContract({
      intakeReport: legacy,
      persistedDocumentCount: 6,
      utiInventoryCount: 6,
      snapshotDiscoveredCount: 6,
      utiFileIds: files.map((x) => x.fileId),
    });
    assert.equal(gate.ok, true);
    assert.equal(gate.intakeStoredCount, 6);
  });

  it("N: order-independent inventory", () => {
    const a = [f("r", "RECOVERABLE"), f("a", "ACCEPTED")];
    const b = [f("a", "ACCEPTED"), f("r", "RECOVERABLE")];
    assert.equal(
      buildCanonicalPackageInventory(a).proceedableFileCount,
      buildCanonicalPackageInventory(b).proceedableFileCount,
    );
  });

  it("O: identical filenames with different archive provenance stay distinct by ID", () => {
    const inv = buildCanonicalPackageInventory([
      f("d1", "ACCEPTED", { originalName: "Annex.pdf", archivePath: "vol1/Annex.pdf" }),
      f("d2", "ACCEPTED", { originalName: "Annex.pdf", archivePath: "vol2/Annex.pdf" }),
    ]);
    assert.equal(inv.totalFiles, 2);
  });

  it("P/Q: missing and unexpected UTI identities fail reconcile", () => {
    const missing = reconcileInventoryIdentities({
      intakeFileIds: ["a", "b", "c"],
      utiFileIds: ["a", "b"],
    });
    assert.equal(missing.ok, false);
    assert.deepEqual(missing.missingFromUTI, ["c"]);

    const unexpected = reconcileInventoryIdentities({
      intakeFileIds: ["a", "b"],
      utiFileIds: ["a", "b", "ghost"],
    });
    assert.equal(unexpected.ok, false);
    assert.deepEqual(unexpected.unexpectedInUTI, ["ghost"]);

    const gate = assertFinalPackageInventoryContract({
      intakeReport: {
        files: [f("a", "ACCEPTED"), f("b", "ACCEPTED"), f("c", "RECOVERABLE")],
        acceptedFileCount: 2,
        recoverableFileCount: 1,
      },
      persistedDocumentCount: 2,
      utiInventoryCount: 2,
      snapshotDiscoveredCount: 2,
      utiFileIds: ["a", "b"],
    });
    // Count mismatch fails first (3 vs 2)
    assert.equal(gate.ok, false);
  });

  it("R: no manual counter accumulation in final stored count", () => {
    const ids = proceedableIntakeFileIds({
      files: [f("a", "ACCEPTED"), f("r", "RECOVERABLE"), f("u", "UNSUPPORTED_SKIPPED")],
    });
    assert.deepEqual(ids.sort(), ["a", "r"]);
    assert.equal(
      discoveryIdFromExtractionMeta({
        packageProvenance: { discoveryId: "disc_abc" },
      }),
      "disc_abc",
    );
  });
});

describe("real Tender_310896 intake report regression", () => {
  it("legacy report on disk yields 6 proceedable — never phantom 8", () => {
    const path = join(
      process.cwd(),
      ".data/uploads/cmtncpk1j0000rkv42owtcrej/cmtnkhv580blxrk38sfayjw98/intake-report.json",
    );
    if (!existsSync(path)) {
      // Fixture not present in this environment — skip without failing CI.
      return;
    }
    const report = JSON.parse(readFileSync(path, "utf8")) as {
      acceptedFileCount: number;
      recoverableFileCount: number;
      discoveredFileCount: number;
      packageLabel: string;
      files: Array<{ fileId: string; state: string; originalName: string }>;
    };
    assert.match(report.packageLabel, /310896/);
    assert.equal(report.files.length, 6);
    assert.equal(report.discoveredFileCount, 6);
    // Legacy inflated aggregates may still be on disk:
    assert.equal(report.acceptedFileCount + report.recoverableFileCount, 8);

    const stored = intakeStoredMemberCount(report);
    assert.equal(stored, 6);

    const conflict = detectLegacyCounterConflict(report);
    assert.equal(conflict.hasConflict, true);
    assert.equal(conflict.identityProceedableCount, 6);

    const inv = buildCanonicalPackageInventory(report.files);
    assert.equal(inv.acceptedFileCount, 4);
    assert.equal(inv.recoverableFileCount, 2);
    assert.equal(inv.proceedableFileCount, 6);

    const uti = buildUniversalTenderPackage({
      packageLabel: report.packageLabel,
      parts: report.files.map((x) => ({
        fileId: x.fileId,
        fileName: x.originalName,
        text: "The bidder shall comply. " + "z".repeat(80),
      })),
    });
    assert.equal(uti.inventoryCount, 6);

    const gate = assertFinalPackageInventoryContract({
      intakeReport: report,
      persistedDocumentCount: 6,
      utiInventoryCount: 6,
      snapshotDiscoveredCount: 6,
      utiFileIds: report.files.map((x) => x.fileId),
    });
    assert.equal(gate.ok, true);
    assert.equal(gate.intakeStoredCount, 6);
  });
});
