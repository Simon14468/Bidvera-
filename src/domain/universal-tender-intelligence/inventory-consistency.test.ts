/**
 * Inventory must never shrink after Intake because of documentKind classification.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyDocument } from "@/domain/company-knowledge/classify";
import {
  assertFinalPackageInventoryContract,
  assertPackageInventoryConsistency,
  buildUniversalTenderPackage,
  intakeStoredMemberCount,
  reconcileInventoryIdentities,
  toUtiSummary,
} from "@/domain/universal-tender-intelligence";
import { certifyAnalysis } from "@/domain/tender-certification";

function part(
  fileId: string,
  fileName: string,
  text: string,
  documentKind = "TENDER",
  status: "EXTRACTED" | "FILE_EXTRACTION_FAILED" | "UNREADABLE" = "EXTRACTED",
) {
  return {
    fileId,
    fileName,
    originalFileName: fileName,
    documentKind,
    text,
    extractionStatus: status,
    archiveSource: "unknown" as const,
    error: status === "FILE_EXTRACTION_FAILED" ? "unreadable" : null,
  };
}

describe("UTI inventory never shrinks after intake", () => {
  it("keeps Sample Contract / company-looking member in UTI when pack has tender siblings", () => {
    const siblings = [
      "Section_I_Instructions.pdf",
      "Section_II_Schedule.pdf",
      "Section_III_Returnable.docx",
      "Section_IV_Contract_Forms.pdf",
      "Section_IV-2_Sample_Contract.pdf",
      "Pre-bid_minutes.pdf",
      "Pre-bid_slides.pdf",
    ];
    const ctx = { packageMemberCount: 7, siblingFileNames: siblings };

    // Profile-like language that previously won as COMPANY_PROFILE without package context
    const sampleContractText = `
      Sample Contract for goods and related services.
      Company experience and certifications & compliance may be referenced by the bidder.
      Special conditions of contract. The supplier shall deliver goods.
      Section IV-2.
    `;
    const classified = classifyDocument({
      text: sampleContractText,
      fileName: "Section_IV-2_Sample_Contract.pdf",
      packageContext: ctx,
    });
    assert.equal(classified.kind, "TENDER", `signals=${classified.signals.join(",")}`);

    const kinds = [
      "TENDER",
      "TENDER",
      "TENDER",
      "TENDER",
      classified.kind,
      "TENDER",
      "TENDER",
    ];
    // Even if one were still COMPANY_PROFILE, UTI must inventory all 7
    const forcedKinds = [...kinds.slice(0, 4), "COMPANY_PROFILE", ...kinds.slice(5)];
    const pkg = buildUniversalTenderPackage({
      packageLabel: "ITB pack",
      parts: siblings.map((name, i) =>
        part(`f${i}`, name, `Tenderers shall provide ${name}. ` + "x".repeat(80), forcedKinds[i]),
      ),
    });
    assert.equal(pkg.inventoryCount, 7);
    assert.equal(toUtiSummary(pkg).inventoryCount, 7);
  });

  it("inventories UNKNOWN, supporting annex, returnable, volumes, corrigendum, clarification", () => {
    const names = [
      "unknown-note.bin.pdf",
      "Annex_A_Drawings.pdf",
      "Returnable_Bidding_Forms.docx",
      "Technical_Volume.pdf",
      "Commercial_Volume.xlsx",
      "Corrigendum_1.pdf",
      "Clarification_QA.pdf",
    ];
    const pkg = buildUniversalTenderPackage({
      packageLabel: "mixed",
      parts: names.map((name, i) =>
        part(
          `id${i}`,
          name,
          `Document ${name}. Tenderers shall comply. ` + "y".repeat(100),
          i === 0 ? "UNKNOWN" : i === 1 ? "SUPPORTING_EVIDENCE" : "TENDER",
        ),
      ),
    });
    assert.equal(pkg.inventoryCount, 7);
  });

  it("keeps unreadable inventoried member with failure status — count unchanged", () => {
    const pkg = buildUniversalTenderPackage({
      packageLabel: "partial",
      parts: [
        part("a", "ITT.pdf", "Invitation to tender. Tenderers shall provide. " + "z".repeat(80)),
        part("b", "scan.pdf", "", "TENDER", "UNREADABLE"),
        part("c", "broken.pdf", "", "UNKNOWN", "FILE_EXTRACTION_FAILED"),
      ],
    });
    assert.equal(pkg.inventoryCount, 3);
    assert.equal(pkg.failedCount + pkg.extractedOkCount + pkg.unsupportedCount >= 2, true);
  });

  it("mixed PDF/DOCX/XLSX/PPTX package inventory equals part count", () => {
    const names = ["a.pdf", "b.docx", "c.xlsx", "d.pptx"];
    const pkg = buildUniversalTenderPackage({
      packageLabel: "office",
      parts: names.map((n, i) =>
        part(`x${i}`, n, `Schedule of requirements for ${n}. Must provide. ` + "w".repeat(60)),
      ),
    });
    assert.equal(pkg.inventoryCount, 4);
  });

  it("assertPackageInventoryConsistency: intake ↔ UTI ↔ snapshot", () => {
    assert.equal(
      assertPackageInventoryConsistency({
        persistedDocumentCount: 7,
        utiInventoryCount: 7,
        snapshotDiscoveredCount: 7,
        intakeStoredCount: 7,
      }).ok,
      true,
    );
    const bad = assertPackageInventoryConsistency({
      persistedDocumentCount: 7,
      utiInventoryCount: 6,
      snapshotDiscoveredCount: 7,
      intakeStoredCount: 7,
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.match(bad.message, /UTI inventory 6/);
  });

  it("intakeStoredMemberCount is identity-based from files[] (disjoint states)", () => {
    assert.equal(
      intakeStoredMemberCount({
        acceptedFileCount: 5,
        recoverableFileCount: 2,
        files: [
          { state: "ACCEPTED", fileId: "a1" },
          { state: "ACCEPTED", fileId: "a2" },
          { state: "RECOVERABLE", fileId: "r1" },
          { state: "UNSUPPORTED_SKIPPED", fileId: "u1" },
        ],
      }),
      3,
    );
  });

  it("intakeStoredMemberCount does not double-count when legacy accepted already includes recoverable", () => {
    assert.equal(
      intakeStoredMemberCount({
        acceptedFileCount: 6,
        recoverableFileCount: 2,
        files: [
          { state: "RECOVERABLE", fileId: "r1" },
          { state: "RECOVERABLE", fileId: "r2" },
          { state: "ACCEPTED", fileId: "a1" },
          { state: "ACCEPTED", fileId: "a2" },
          { state: "ACCEPTED", fileId: "a3" },
          { state: "ACCEPTED", fileId: "a4" },
        ],
      }),
      6,
    );
  });

  it("intakeStoredMemberCount prefers proceedableFileCount when files absent", () => {
    assert.equal(
      intakeStoredMemberCount({
        acceptedFileCount: 6,
        recoverableFileCount: 2,
        proceedableFileCount: 6,
      }),
      6,
    );
  });

  it("assertPackageInventoryConsistency: 6/6/6/6 ok; overlapping-counter phantom fails", () => {
    assert.equal(
      assertPackageInventoryConsistency({
        persistedDocumentCount: 6,
        utiInventoryCount: 6,
        snapshotDiscoveredCount: 6,
        intakeStoredCount: 6,
      }).ok,
      true,
    );
    const bad = assertPackageInventoryConsistency({
      persistedDocumentCount: 6,
      utiInventoryCount: 6,
      snapshotDiscoveredCount: 6,
      intakeStoredCount: 8,
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.match(bad.message, /intake stored 8/);
  });

  it("certification SNAPSHOT_MISMATCH still fires when UTI shrinks vs intake", () => {
    const result = (() => {
      try {
        certifyAnalysis({
          tenderId: "t1",
          packageLabel: "pack",
          snapshot: {
            version: "v1",
            frozenAt: new Date().toISOString(),
            tenderId: "t1",
            package: {
              discoveredFileCount: 7,
              label: "pack",
              files: Array.from({ length: 7 }, (_, i) => ({
                fileName: `f${i}.pdf`,
                processingStatus: "COMPLETED",
                role: "OTHER",
                error: null,
              })),
            },
            metadata: {
              title: null,
              client: null,
              deadlineIso: null,
              deadlineTimezone: null,
              factsNote: null,
              metadataStatus: null,
            },
            requirementIds: [],
            counts: {
              totalRequirements: 0,
              verifiedRequirements: 0,
              needsVerification: 0,
              confirmedGaps: 0,
              notApplicable: 0,
            },
          },
          integrity: {
            version: "analysis-integrity/v1",
            partitionValid: true,
            counts: {
              totalRequirements: 0,
              verified: 0,
              needsVerification: 0,
              confirmedGaps: 0,
              notApplicable: 0,
            },
            checksPassed: ["package_inventory"],
          },
          guardianOk: true,
          canonicalRequirements: [],
          fitRows: [],
          risks: [],
          actions: [],
          matrixRequirementIds: [],
          decisionRequirementIds: [],
          decisionLabel: "REVIEW",
          utiSummary: { inventoryCount: 6, extractedOkCount: 6, failedCount: 0 },
          intakeStoredCount: 7,
        });
        return null;
      } catch (e) {
        return e as Error;
      }
    })();
    assert.ok(result);
    assert.match(String(result?.message ?? ""), /SNAPSHOT_MISMATCH|UTI inventory 6|intake stored/);
  });

  it("true solo company profile remains COMPANY_PROFILE without package context", () => {
    const result = classifyDocument({
      text: `
        Atlas Digital Solutions SARL — Company Profile
        Main Services
        Known Limitations
        Tender Preferences
        Certifications & Compliance
      `,
      fileName: "Atlas_Company_Profile.pdf",
    });
    assert.equal(result.kind, "COMPANY_PROFILE");
  });

  it("assertFinalPackageInventoryContract + reconcileInventoryIdentities", () => {
    const files = [
      { state: "ACCEPTED", fileId: "disc_a" },
      { state: "ACCEPTED", fileId: "disc_b" },
      { state: "RECOVERABLE", fileId: "disc_r" },
    ];
    const ok = assertFinalPackageInventoryContract({
      intakeReport: {
        acceptedFileCount: 6,
        recoverableFileCount: 2,
        files,
      },
      persistedDocumentCount: 3,
      utiInventoryCount: 3,
      snapshotDiscoveredCount: 3,
      utiFileIds: ["disc_a", "disc_b", "disc_r"],
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.intakeStoredCount, 3);
    assert.equal(ok.legacyConflict?.hasConflict, true);
    assert.equal(ok.identityNamespace, "COMPARABLE");

    const badId = assertFinalPackageInventoryContract({
      intakeReport: { files, acceptedFileCount: 2, recoverableFileCount: 1 },
      persistedDocumentCount: 3,
      utiInventoryCount: 3,
      snapshotDiscoveredCount: 3,
      utiFileIds: ["disc_a", "disc_b", "ghost"],
    });
    assert.equal(badId.ok, false);
    if (!badId.ok) assert.equal(badId.code, "IDENTITY_MISMATCH");

    const silentWouldHavePassed = assertFinalPackageInventoryContract({
      intakeReport: {
        files: [
          { state: "ACCEPTED", fileId: "x1" },
          { state: "ACCEPTED", fileId: "x2" },
        ],
        acceptedFileCount: 2,
        recoverableFileCount: 0,
      },
      persistedDocumentCount: 2,
      utiInventoryCount: 2,
      snapshotDiscoveredCount: 2,
      utiFileIds: ["x1", "y_wrong"],
    });
    assert.equal(silentWouldHavePassed.ok, false);
    if (!silentWouldHavePassed.ok) {
      assert.equal(silentWouldHavePassed.code, "IDENTITY_MISMATCH");
    }

    const recon = reconcileInventoryIdentities({
      intakeFileIds: ["a", "b"],
      utiFileIds: ["a", "a", "c"],
    });
    assert.equal(recon.ok, false);
    assert.deepEqual(recon.missingFromUTI, ["b"]);
    assert.deepEqual(recon.unexpectedInUTI, ["c"]);
    assert.ok(recon.duplicateIds.includes("a"));
    assert.equal(recon.provenanceMismatches.length, 0);
  });
});
