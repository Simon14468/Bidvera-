/**
 * Real-world Universal Intake E2E — Scottish ZIP + Philippines ITB pack.
 * Offline (no DB). Prints IntakeReport gate summary.
 */
import fs from "node:fs";
import path from "node:path";
import { evaluateIntakeDecisionGate, runUniversalIntake } from "@/domain/universal-intake";

function upload(name: string, bytes: Buffer) {
  return { fileName: name, mimeType: "application/octet-stream", fileSize: bytes.byteLength, bytes };
}

async function runPack(label: string, uploads: ReturnType<typeof upload>[]) {
  const result = await runUniversalIntake(uploads);
  const gate = evaluateIntakeDecisionGate(result.intakeReport);
  const summary = {
    label,
    uiState: result.intakeReport.uiState,
    status: result.intakeReport.status,
    packageCompleteness: result.intakeReport.packageCompleteness,
    documentReadiness: result.intakeReport.documentReadiness,
    discovered: result.intakeReport.discoveredFileCount,
    accepted: result.intakeReport.acceptedFileCount,
    recoverable: result.intakeReport.recoverableFileCount,
    unsupported: result.intakeReport.unsupportedFileCount,
    corrupted: result.intakeReport.corruptedFileCount,
    mayProceedToStorage: result.mayProceedToStorage,
    mayProceedToScoring: result.intakeReport.mayProceedToScoring,
    gate,
    fileStates: result.intakeReport.files.map((f) => ({
      name: f.displayName || f.originalName,
      state: f.state,
      recovery: f.recoveryClass,
    })),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!result.mayProceedToStorage) {
    throw new Error(`${label}: intake blocked unexpectedly`);
  }
  if (!gate.allowScoring) {
    throw new Error(`${label}: scoring gate blocked unexpectedly`);
  }
}

async function main() {
  const scottish = path.join(
    process.cwd(),
    ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtn06jtv0rk1rkpoa5diox8h/1788529325821-Documents-JUN557200.zip",
  );
  if (fs.existsSync(scottish)) {
    await runPack("Scottish Documents-JUN557200.zip", [
      upload("Documents-JUN557200.zip", fs.readFileSync(scottish)),
    ]);
  } else {
    console.log(JSON.stringify({ label: "Scottish ZIP", skipped: true }));
  }

  const phDir = path.join(
    process.cwd(),
    ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtn8hyxm1glgrkpo95lv1z9r",
  );
  if (fs.existsSync(phDir)) {
    const files = fs
      .readdirSync(phDir)
      .filter((n) => /\.(pdf|docx|pptx|xlsx)$/i.test(n))
      .map((n) => upload(n.replace(/^\d+-/, ""), fs.readFileSync(path.join(phDir, n))));
    await runPack("Philippines ITB-2026-62471", files);
  } else {
    console.log(JSON.stringify({ label: "Philippines ITB", skipped: true }));
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
