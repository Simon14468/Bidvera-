/**
 * Offline E2E: rebuild UTI inventory for the failed Philippines 7-file pack
 * using stored extracted texts + package-context classification.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { classifyDocument } from "@/domain/company-knowledge/classify";
import {
  assertPackageInventoryConsistency,
  buildUniversalTenderPackage,
  intakeStoredMemberCount,
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

const prisma = new PrismaClient();

async function main() {
  const tenderId = process.argv[2] ?? "cmtncwvg601vjrk0shb2rpetw";
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    include: {
      documents: {
        select: {
          id: true,
          fileName: true,
          documentKind: true,
          extractedText: true,
          processingStatus: true,
        },
      },
    },
  });
  if (!tender) {
    console.log(JSON.stringify({ skipped: true, reason: "tender not found", tenderId }));
    return;
  }

  const siblingFileNames = tender.documents.map((d) => d.fileName);
  const packageContext = {
    packageMemberCount: tender.documents.length,
    siblingFileNames,
  };

  const classified = tender.documents.map((d) => {
    const text = d.extractedText ?? "";
    const kind =
      text.trim().length >= 40
        ? classifyDocument({ text, fileName: d.fileName, packageContext }).kind
        : d.documentKind ?? "UNKNOWN";
    return {
      id: d.id,
      fileName: d.fileName,
      priorKind: d.documentKind,
      newKind: kind,
      textLen: text.length,
    };
  });

  const uti = buildUniversalTenderPackage({
    packageLabel: tender.title,
    parts: tender.documents.map((d) => {
      const text = d.extractedText ?? "";
      const row = classified.find((c) => c.id === d.id)!;
      return {
        fileId: d.id,
        fileName: d.fileName,
        documentKind: row.newKind,
        text,
        extractionStatus:
          text.trim().length >= 40
            ? ("EXTRACTED" as const)
            : ("FILE_EXTRACTION_FAILED" as const),
        archiveSource: "unknown" as const,
        error: text.trim().length < 40 ? "empty" : null,
      };
    }),
  });

  const intakePath = path.join(
    process.env.STORAGE_ROOT ?? ".data/uploads",
    tender.companyId,
    tenderId,
    "intake-report.json",
  );
  let intakeStored: number | null = null;
  if (fs.existsSync(intakePath)) {
    const report = JSON.parse(fs.readFileSync(intakePath, "utf8")) as {
      acceptedFileCount: number;
      recoverableFileCount: number;
      files: Array<{ state: string }>;
    };
    intakeStored = intakeStoredMemberCount(report);
  }

  const check = assertPackageInventoryConsistency({
    persistedDocumentCount: tender.documents.length,
    utiInventoryCount: uti.inventoryCount,
    snapshotDiscoveredCount: tender.documents.length,
    intakeStoredCount: intakeStored,
  });

  console.log(
    JSON.stringify(
      {
        tenderId,
        docCount: tender.documents.length,
        utiInventory: uti.inventoryCount,
        intakeStored,
        inventoryOk: check.ok,
        inventoryMessage: check.ok ? null : check.message,
        classified,
      },
      null,
      2,
    ),
  );
  if (!check.ok) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
