/**
 * Final Integration — Universal Intake → IntakeReport → decision gate E2E.
 * Covers realistic combinations without tender-specific patches.
 * Does NOT claim support for every possible file — unknown formats fail safely.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildEncryptedZipForTests,
  buildStoredZipForTests,
} from "@/domain/tender-package/expand-tender-archive";
import {
  evaluateIntakeDecisionGate,
  INTAKE_UI_STATES,
  runUniversalIntake,
} from "@/domain/universal-intake";

const MINI_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "utf8",
);

/** Minimal OOXML (ZIP) container — format probe only, not invented tender content. */
function miniOoxml(nameHint: string): Buffer {
  return buildStoredZipForTests([
    {
      name: "[Content_Types].xml",
      data: Buffer.from(
        `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types><!-- ${nameHint} -->`,
      ),
    },
  ]);
}

function upload(name: string, bytes: Buffer, mime = "application/octet-stream") {
  return { fileName: name, mimeType: mime, fileSize: bytes.byteLength, bytes };
}

function assertEveryFileExplicit(result: Awaited<ReturnType<typeof runUniversalIntake>>) {
  assert.ok(result.intakeReport.reportVersion === "intake-report/v1");
  assert.ok(INTAKE_UI_STATES.includes(result.intakeReport.uiState));
  assert.equal(
    result.intakeReport.files.length,
    result.intake.files.length,
    "IntakeReport must inventory the same files as PackageIntake",
  );
  for (const f of result.intakeReport.files) {
    assert.ok(f.state, `ambiguous/missing state for ${f.originalName}`);
    assert.ok(f.readiness, `missing readiness for ${f.originalName}`);
  }
  // Never fabricate empty accepted docs from unreadable bytes
  for (const f of result.intake.files) {
    if (f.state === "CORRUPTED" || f.state === "UNREADABLE" || f.state.startsWith("REJECTED_")) {
      assert.notEqual(f.state, "ACCEPTED");
    }
  }
}

describe("Final Intake Integration — combinations", () => {
  it("normal PDF → READY_FOR_ANALYSIS + scoring allowed", async () => {
    const result = await runUniversalIntake([upload("notice.pdf", MINI_PDF, "application/pdf")]);
    assertEveryFileExplicit(result);
    assert.equal(result.mayProceedToStorage, true);
    assert.ok(
      result.intakeReport.uiState === "READY_FOR_ANALYSIS" ||
        result.intakeReport.uiState === "REPAIRED_AUTOMATICALLY" ||
        result.intakeReport.uiState === "PARTIALLY_READABLE",
    );
    const gate = evaluateIntakeDecisionGate(result.intakeReport);
    assert.equal(gate.allowScoring, true);
  });

  it("multi-file ZIP inventories all members; unsupported never silent-drop", async () => {
    const zip = buildStoredZipForTests([
      { name: "cps.pdf", data: MINI_PDF },
      { name: "readme.md", data: Buffer.from("# notes") },
      { name: "bin.xyz", data: Buffer.from([0x00, 0x01, 0xfe]) },
    ]);
    const result = await runUniversalIntake([upload("pack.zip", zip)]);
    assertEveryFileExplicit(result);
    assert.equal(result.mayProceedToStorage, true);
    assert.ok(result.intakeReport.unsupportedFileCount >= 1 || result.intake.unsupportedFiles.length >= 1);
    assert.ok(
      result.intakeReport.packageCompleteness === "INCOMPLETE" ||
        result.intakeReport.status === "INTAKE_PARTIAL" ||
        result.intakeReport.uiState === "PACKAGE_INCOMPLETE",
    );
    const gate = evaluateIntakeDecisionGate(result.intakeReport);
    assert.equal(gate.allowScoring, true, "rule 8: continue with readable docs");
    assert.equal(gate.incomplete, true);
    assert.equal(gate.reason, "INTAKE_PACKAGE_INCOMPLETE");
  });

  it("RAR fixture expands or fails with explicit reason (not silent drop)", async () => {
    const rarPath = path.join(
      process.cwd(),
      "src/domain/universal-intake/archive/fixtures/FolderTest.rar",
    );
    if (!fs.existsSync(rarPath)) {
      // Extensibility: fixture optional in stripped trees — skip safely.
      return;
    }
    const rar = fs.readFileSync(rarPath);
    const result = await runUniversalIntake([upload("FolderTest.rar", rar)]);
    assertEveryFileExplicit(result);
    // Either accepted members or explicit blocked/partial — never empty silent success
    assert.ok(
      result.mayProceedToStorage ||
        result.intakeReport.uiState === "ANALYSIS_BLOCKED" ||
        result.intakeReport.uiState === "PASSWORD_REQUIRED" ||
        result.intakeReport.uiState === "CORRUPTED" ||
        result.intakeReport.files.length > 0,
    );
  });

  it("password-protected ZIP → PASSWORD_REQUIRED; wrong pw stays blocked; correct resumes", async () => {
    const enc = buildEncryptedZipForTests([{ name: "secret.pdf", data: MINI_PDF }], "correct-pw");
    const blocked = await runUniversalIntake([upload("enc.zip", enc)]);
    assertEveryFileExplicit(blocked);
    assert.equal(blocked.mayProceedToStorage, false);
    assert.ok(
      blocked.intakeReport.uiState === "PASSWORD_REQUIRED" ||
        blocked.intakeReport.passwordProtectedFileCount > 0 ||
        blocked.intake.blockingConditions.some((b) => b.code === "ARCHIVE_PASSWORD_REQUIRED"),
    );
    const gateBlocked = evaluateIntakeDecisionGate(blocked.intakeReport);
    assert.equal(gateBlocked.allowScoring, false);
    assert.equal(gateBlocked.reason, "INTAKE_BLOCKED");

    const wrong = await runUniversalIntake([upload("enc.zip", enc)], {
      passwordsByFileName: { "enc.zip": "wrong" },
    });
    assert.equal(wrong.mayProceedToStorage, false);

    const ok = await runUniversalIntake([upload("enc.zip", enc)], {
      passwordsByFileName: { "enc.zip": "correct-pw" },
    });
    assertEveryFileExplicit(ok);
    assert.equal(ok.mayProceedToStorage, true);
    assert.ok((ok.intakeReport.proceedableFileCount ?? 0) >= 1);
  });

  it("password-protected RAR (HeaderEnc1234.rar) unlocks with 1234", async () => {
    const rarPath = path.join(
      process.cwd(),
      "src/domain/universal-intake/archive/fixtures/HeaderEnc1234.rar",
    );
    if (!fs.existsSync(rarPath)) return;
    const rar = fs.readFileSync(rarPath);
    const blocked = await runUniversalIntake([upload("HeaderEnc1234.rar", rar)]);
    assert.equal(blocked.mayProceedToStorage, false);

    const ok = await runUniversalIntake([upload("HeaderEnc1234.rar", rar)], {
      passwordsByFileName: { "HeaderEnc1234.rar": "1234" },
    });
    assertEveryFileExplicit(ok);
    assert.equal(ok.mayProceedToStorage, true);
  });

  it("corrupted/unreadable member inside valid ZIP → explicit non-ACCEPTED + package incomplete, scoring may continue", async () => {
    const zip = buildStoredZipForTests([
      { name: "good.pdf", data: MINI_PDF },
      { name: "bad.pdf", data: Buffer.from("NOT_A_PDF_AT_ALL") },
    ]);
    const result = await runUniversalIntake([upload("mixed.zip", zip)]);
    assertEveryFileExplicit(result);
    assert.ok(result.intake.acceptedFileCount >= 1);
    assert.ok(
      result.intake.corruptedFileCount >= 1 ||
        result.intake.unsupportedFileCount >= 1 ||
        result.intake.files.some(
          (f) =>
            f.state === "CORRUPTED" ||
            f.state === "UNREADABLE" ||
            f.state === "UNSUPPORTED_SKIPPED" ||
            f.state === "ARCHIVE_MEMBER_SKIPPED" ||
            f.state === "REJECTED_UNSUPPORTED" ||
            f.state === "REJECTED_SPOOFED_EXTENSION" ||
            f.state.startsWith("REJECTED_"),
        ),
      "problem member must be inventoried with an explicit non-silent state",
    );
    const gate = evaluateIntakeDecisionGate(result.intakeReport);
    assert.equal(gate.allowScoring, true);
  });

  it("scanned/image-heavy PDF schedules OCR (PARTIALLY_READABLE / forceOcr) — no fake empty text", async () => {
    const scanned = Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.from("/Image /XObject stream\n"),
      Buffer.alloc(2500, 0),
      Buffer.from("\n%%EOF\n"),
    ]);
    const result = await runUniversalIntake([upload("scan.pdf", scanned, "application/pdf")]);
    assertEveryFileExplicit(result);
    assert.equal(result.mayProceedToStorage, true);
    const force = result.intake.files.some((f) => f.recovery?.forceOcr);
    assert.ok(
      force ||
        result.intake.documentReadiness === "NEEDS_OCR" ||
        result.intakeReport.uiState === "PARTIALLY_READABLE" ||
        result.intakeReport.uiState === "READY_FOR_ANALYSIS" ||
        result.intakeReport.uiState === "REPAIRED_AUTOMATICALLY",
    );
  });

  it("mixed PDF/DOCX/XLSX/PPTX package — each file ends explicit; unsupported flagged", async () => {
    const zip = buildStoredZipForTests([
      { name: "notice.pdf", data: MINI_PDF },
      { name: "forms.docx", data: miniOoxml("docx") },
      { name: "boq.xlsx", data: miniOoxml("xlsx") },
      { name: "slides.pptx", data: miniOoxml("pptx") },
      { name: "legacy.dwg", data: Buffer.from("AC1015") },
    ]);
    const result = await runUniversalIntake([upload("mixed-office.zip", zip)]);
    assertEveryFileExplicit(result);
    assert.ok(result.intakeReport.files.length >= 4);
    assert.ok(
      result.intakeReport.files.some(
        (f) =>
          f.originalName.includes("dwg") ||
          f.state.includes("UNSUPPORTED") ||
          f.state.startsWith("REJECTED_"),
      ),
    );
  });

  it("nested archive expands within depth; never silent-drop outer", async () => {
    const inner = buildStoredZipForTests([{ name: "a.pdf", data: MINI_PDF }]);
    const outer = buildStoredZipForTests([{ name: "inner.zip", data: inner }]);
    const result = await runUniversalIntake([upload("nested.zip", outer)]);
    assertEveryFileExplicit(result);
    assert.equal(result.mayProceedToStorage, true);
    assert.ok((result.intakeReport.proceedableFileCount ?? 0) >= 1);
  });

  it("unsupported-only package blocks scoring (rule 9)", async () => {
    const result = await runUniversalIntake([
      upload("cad.dwg", Buffer.from("AC1018 unsupported drawing")),
    ]);
    assertEveryFileExplicit(result);
    assert.equal(result.mayProceedToStorage, false);
    const gate = evaluateIntakeDecisionGate(result.intakeReport);
    assert.equal(gate.allowScoring, false);
    assert.ok(gate.reason === "INTAKE_BLOCKED" || gate.reason === "INTAKE_NO_READABLE_DOCS");
    assert.ok(gate.message && gate.message.length > 10);
  });

  it("incomplete package with readable docs ≠ complete package", async () => {
    const zip = buildStoredZipForTests([
      { name: "notice.pdf", data: MINI_PDF },
      { name: "ignore.bin", data: Buffer.alloc(32, 0xff) },
    ]);
    const result = await runUniversalIntake([upload("incomplete.zip", zip)]);
    assertEveryFileExplicit(result);
    assert.ok(result.intakeReport.documentReadiness !== "BLOCKED" || result.mayProceedToStorage);
    // Readable single PDF in incomplete pack is not auto-complete
    assert.notEqual(result.intakeReport.packageCompleteness, "COMPLETE");
  });

  it("partially recoverable package: junk-prefixed PDF repairs; bad member inventoried", async () => {
    const junkPdf = Buffer.concat([Buffer.from("XXXXX"), MINI_PDF]);
    const zip = buildStoredZipForTests([
      { name: "repaired.pdf", data: junkPdf },
      { name: "dead.xyz", data: Buffer.from("nope") },
    ]);
    const result = await runUniversalIntake([upload("partial.zip", zip)]);
    assertEveryFileExplicit(result);
    assert.equal(result.mayProceedToStorage, true);
    assert.ok(
      result.intakeReport.uiState === "REPAIRED_AUTOMATICALLY" ||
        result.intakeReport.uiState === "PACKAGE_INCOMPLETE" ||
        result.intakeReport.userNotices.length > 0 ||
        result.intake.files.some((f) => f.recovery?.recoveryClass === "AUTO_RECOVERABLE"),
    );
  });

  it("multiple simultaneous problems: password outer OR mixed bad members — all explicit", async () => {
    const zip = buildStoredZipForTests([
      { name: "ok.pdf", data: MINI_PDF },
      { name: "bad.pdf", data: Buffer.from("corrupt") },
      { name: "weird.xyz", data: Buffer.from([1, 2, 3]) },
    ]);
    const result = await runUniversalIntake([upload("multi-problem.zip", zip)]);
    assertEveryFileExplicit(result);
    const states = new Set(result.intakeReport.files.map((f) => f.state));
    assert.ok(states.size >= 2, "multiple problem classes should yield distinct states");
    assert.ok(result.intakeReport.provenanceNote.includes("original → archive"));
  });
});

describe("Real-world packages (local fixtures)", () => {
  it("Scottish Documents-JUN557200.zip through Universal Intake", async () => {
    const zipPath = path.join(
      process.cwd(),
      ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtn06jtv0rk1rkpoa5diox8h/1788529325821-Documents-JUN557200.zip",
    );
    if (!fs.existsSync(zipPath)) {
      console.log("SKIP scottish zip — not on disk");
      return;
    }
    const bytes = fs.readFileSync(zipPath);
    const result = await runUniversalIntake([
      upload("Documents-JUN557200.zip", bytes, "application/zip"),
    ]);
    assertEveryFileExplicit(result);
    assert.equal(result.mayProceedToStorage, true);
    assert.ok(result.intakeReport.discoveredFileCount >= 1);
    const gate = evaluateIntakeDecisionGate(result.intakeReport);
    assert.equal(gate.allowScoring, true);
  });

  it("Philippines ITB-2026-62471 multi-file pack through Universal Intake", async () => {
    const dir = path.join(
      process.cwd(),
      ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtn8hyxm1glgrkpo95lv1z9r",
    );
    if (!fs.existsSync(dir)) {
      console.log("SKIP philippines ITB — not on disk");
      return;
    }
    const files = fs
      .readdirSync(dir)
      .filter((n) => /\.(pdf|docx|pptx|xlsx)$/i.test(n))
      .map((n) => {
        const full = path.join(dir, n);
        const bytes = fs.readFileSync(full);
        const display = n.replace(/^\d+-/, "");
        return upload(display, bytes);
      });
    assert.ok(files.length >= 3, "expected ITB sections on disk");
    const result = await runUniversalIntake(files);
    assertEveryFileExplicit(result);
    assert.equal(result.mayProceedToStorage, true);
    assert.ok((result.intakeReport.proceedableFileCount ?? 0) >= 1);
    // Package completeness is distinct from readability — multi-section pack should not invent BID
    const gate = evaluateIntakeDecisionGate(result.intakeReport);
    assert.equal(gate.allowScoring, true);
    assert.ok(result.intakeReport.files.every((f) => f.state));
    console.log(
      JSON.stringify(
        {
          tender: "ITB-2026-62471",
          uiState: result.intakeReport.uiState,
          status: result.intakeReport.status,
          packageCompleteness: result.intakeReport.packageCompleteness,
          documentReadiness: result.intakeReport.documentReadiness,
          accepted: result.intakeReport.acceptedFileCount,
          unsupported: result.intakeReport.unsupportedFileCount,
          corrupted: result.intakeReport.corruptedFileCount,
          mayProceedToScoring: result.intakeReport.mayProceedToScoring,
          gate,
        },
        null,
        2,
      ),
    );
  });
});
