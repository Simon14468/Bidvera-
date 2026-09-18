/**
 * Real Tender_310896 inventory regression (offline + optional full re-analysis).
 *
 * Verifies:
 * - legacy inflated counters (6+2=8) do not create phantoms
 * - canonical proceedable = 6
 * - UTI inventory = 6 when built from stored docs
 * - final inventory contract passes
 *
 * Optional: --reanalyze runs processTenderAnalysis on the live tender.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { buildCanonicalPackageInventory } from "@/domain/universal-intake/canonical-inventory";
import {
  assertFinalPackageInventoryContract,
  buildUniversalTenderPackage,
  detectLegacyCounterConflict,
  discoveryIdFromExtractionMeta,
  intakeStoredMemberCount,
  proceedableIntakeFileIds,
} from "@/domain/universal-tender-intelligence";

function applyEnv(file: string, override = false) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i);
    const v = line.slice(i + 1).replace(/^["']|["']$/g, "");
    if (override || process.env[k] === undefined) process.env[k] = v;
  }
}
applyEnv(".env");
applyEnv(".env.local", true);
if (fs.existsSync(".data/artifacts/claimable-db.json")) {
  const c = JSON.parse(fs.readFileSync(".data/artifacts/claimable-db.json", "utf8"));
  if (c.connection_string) process.env.DATABASE_URL = c.connection_string;
}

const TENDER_ID = process.argv.find((a) => a.startsWith("--tender="))?.slice(9)
  ?? "cmtnkhv580blxrk38sfayjw98";
const COMPANY_ID = "cmtncpk1j0000rkv42owtcrej";
const REANALYZE = process.argv.includes("--reanalyze");

async function main() {
  const intakePath = path.join(
    process.env.STORAGE_ROOT ?? ".data/uploads",
    COMPANY_ID,
    TENDER_ID,
    "intake-report.json",
  );
  if (!fs.existsSync(intakePath)) {
    console.log(JSON.stringify({ skipped: true, reason: "intake-report missing", intakePath }));
    process.exitCode = 1;
    return;
  }

  const report = JSON.parse(fs.readFileSync(intakePath, "utf8")) as {
    packageLabel: string;
    acceptedFileCount: number;
    recoverableFileCount: number;
    discoveredFileCount: number;
    files: Array<{
      fileId: string;
      state: string;
      originalName: string;
      archivePath?: string | null;
    }>;
  };

  const inv = buildCanonicalPackageInventory(report.files);
  const stored = intakeStoredMemberCount(report);
  const conflict = detectLegacyCounterConflict(report);
  const intakeIds = proceedableIntakeFileIds(report);

  const prisma = new PrismaClient();
  let docs: Array<{
    id: string;
    fileName: string;
    extractedText: string | null;
    extractionMeta: unknown;
  }> = [];
  try {
    docs = await prisma.tenderDocument.findMany({
      where: { tenderId: TENDER_ID },
      select: {
        id: true,
        fileName: true,
        extractedText: true,
        extractionMeta: true,
      },
    });
  } catch (e) {
    console.log(
      JSON.stringify({
        warning: "DB unavailable — offline inventory checks only",
        error: e instanceof Error ? e.message : String(e),
      }),
    );
  }

  const utiFileIds = docs.map(
    (d) => discoveryIdFromExtractionMeta(d.extractionMeta) ?? d.id,
  );
  const uti =
    docs.length > 0
      ? buildUniversalTenderPackage({
          packageLabel: report.packageLabel,
          parts: docs.map((d, i) => ({
            fileId: utiFileIds[i]!,
            fileName: d.fileName,
            text: (d.extractedText ?? "") || "The bidder shall submit. " + "x".repeat(80),
            extractionStatus:
              (d.extractedText?.trim().length ?? 0) >= 40
                ? ("EXTRACTED" as const)
                : ("UNREADABLE" as const),
          })),
        })
      : buildUniversalTenderPackage({
          packageLabel: report.packageLabel,
          parts: report.files.map((f) => ({
            fileId: f.fileId,
            fileName: f.originalName,
            text: "The bidder shall submit. " + "x".repeat(80),
          })),
        });

  const persisted = docs.length > 0 ? docs.length : report.files.length;
  const gate = assertFinalPackageInventoryContract({
    intakeReport: report,
    persistedDocumentCount: persisted,
    utiInventoryCount: uti.inventoryCount,
    snapshotDiscoveredCount: persisted,
    utiFileIds: uti.documents.map((d) => d.fileId),
  });

  const summary = {
    tenderId: TENDER_ID,
    packageLabel: report.packageLabel,
    legacyAccepted: report.acceptedFileCount,
    legacyRecoverable: report.recoverableFileCount,
    legacySum: report.acceptedFileCount + report.recoverableFileCount,
    discoveredFileCount: report.discoveredFileCount,
    canonical: {
      totalFiles: inv.totalFiles,
      acceptedFileCount: inv.acceptedFileCount,
      recoverableFileCount: inv.recoverableFileCount,
      proceedableFileCount: inv.proceedableFileCount,
    },
    intakeStoredMemberCount: stored,
    legacyConflict: conflict,
    intakeProceedableIds: intakeIds,
    persistedDocumentCount: persisted,
    utiInventoryCount: uti.inventoryCount,
    utiFileIds: uti.documents.map((d) => d.fileId),
    finalContractOk: gate.ok,
    finalContractMessage: gate.ok ? null : gate.message,
    phantom8Avoided: stored === 6 && uti.inventoryCount === 6 && gate.ok,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (
    inv.totalFiles !== 6 ||
    inv.acceptedFileCount !== 4 ||
    inv.recoverableFileCount !== 2 ||
    inv.proceedableFileCount !== 6 ||
    stored !== 6 ||
    uti.inventoryCount !== 6 ||
    !gate.ok
  ) {
    process.exitCode = 1;
    await prisma.$disconnect();
    return;
  }

  if (REANALYZE) {
    const { processTenderAnalysis } = await import(
      "@/services/tender-processing/index"
    );
    // Terminal FAILED is idempotent-skip — clear for intentional re-run only.
    await prisma.tender.update({
      where: { id: TENDER_ID },
      data: {
        analysisStatus: "PROCESSING",
        analysisError: null,
        analysisPhase: null,
      },
    });
    console.log("Re-analyzing tender", TENDER_ID);
    try {
      await processTenderAnalysis(TENDER_ID);
      const tender = await prisma.tender.findUnique({
        where: { id: TENDER_ID },
        select: { analysisStatus: true, analysisError: true, analysisPhase: true },
      });
      console.log(
        JSON.stringify({
          reanalyze: true,
          analysisStatus: tender?.analysisStatus,
          analysisPhase: tender?.analysisPhase,
          analysisError: tender?.analysisError,
          inventoryGateCleared:
            !tender?.analysisError?.includes("intake stored 8") &&
            !tender?.analysisError?.includes("Package inventory invariant"),
        }),
      );
      if (tender?.analysisStatus !== "COMPLETED") {
        // Inventory gate pass is required; other COMPLETED blockers classified separately.
        if (tender?.analysisError?.includes("Package inventory invariant")) {
          process.exitCode = 1;
        } else if (tender?.analysisStatus === "FAILED") {
          // Non-inventory failure after gate — still report but mark env/capability.
          console.log(
            JSON.stringify({
              note: "Analysis did not COMPLETE; inventory invariant did not fire.",
              classification: "ENVIRONMENT_OR_DOWNSTREAM",
            }),
          );
          process.exitCode = 1;
        } else {
          process.exitCode = 1;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(msg);
      if (msg.includes("Package inventory invariant")) {
        process.exitCode = 1;
      } else {
        console.log(
          JSON.stringify({
            note: "Reanalyze threw non-inventory error",
            classification: "ENVIRONMENT_OR_DOWNSTREAM",
          }),
        );
        process.exitCode = 1;
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
