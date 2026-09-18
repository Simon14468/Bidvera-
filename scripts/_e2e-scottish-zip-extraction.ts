/**
 * Real Scottish tender ZIP E2E — Documents-JUN557200.zip
 * Proves container ZIP is expanded and XLSX extracts via SheetJS.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { storageService } from "../src/services/storage";
import { processTenderAnalysis } from "../src/services/tender-processing/index";
import { sniffUploadContent, isArchiveUploadContent } from "../src/domain/tender-package/upload-content-sniff";
import { discoverTenderPackage } from "../src/domain/tender-package/discover-tender-package";
import { extractDocumentText } from "../src/services/document/extract";

const ZIP_CANDIDATES = [
  path.join(
    ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtn06jtv0rk1rkpoa5diox8h/1788529325821-Documents-JUN557200.zip",
  ),
  path.join(process.env.USERPROFILE ?? "", "Downloads", "Documents-JUN557200.zip"),
];

function findZip(): string {
  for (const p of ZIP_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Scottish ZIP Documents-JUN557200.zip not found");
}

async function main() {
  const zipPath = findZip();
  const bytes = fs.readFileSync(zipPath);
  const sniff = sniffUploadContent(bytes, "Documents-JUN557200.zip");
  console.log("sniff", sniff);
  if (sniff.kind !== "zip") {
    throw new Error(`Expected zip sniff, got ${sniff.kind}`);
  }
  if (!isArchiveUploadContent(bytes, "Documents-JUN557200.zip")) {
    throw new Error("Expected archive upload content");
  }

  const discovered = await discoverTenderPackage([
    {
      fileName: "Documents-JUN557200.zip",
      mimeType: "application/zip",
      fileSize: bytes.byteLength,
      bytes,
    },
  ]);

  console.log(
    JSON.stringify(
      {
        discoveredFileCount: discovered.discoveredFileCount,
        inventory: discovered.inventory.map((i) => ({
          name: i.originalFileName,
          status: i.status,
          source: i.source,
          archivePath: i.archivePath,
          error: i.error,
        })),
      },
      null,
      2,
    ),
  );

  const perFile: Array<Record<string, unknown>> = [];
  let ok = 0;
  let failed = 0;
  for (const f of discovered.files) {
    try {
      const r = await extractDocumentText({
        buffer: f.bytes,
        fileName: f.originalFileName,
        mimeType: f.mimeType,
      });
      ok += 1;
      perFile.push({
        file: f.originalFileName,
        status: "EXTRACTED",
        method: r.method,
        chars: r.text.length,
        preview: r.text.slice(0, 120),
        archivePath: f.archivePath,
      });
    } catch (err) {
      failed += 1;
      perFile.push({
        file: f.originalFileName,
        status: "FILE_EXTRACTION_FAILED",
        error: err instanceof Error ? err.message : String(err),
        archivePath: f.archivePath,
      });
    }
  }

  const skipped = discovered.inventory.filter((i) => i.status === "UNSUPPORTED_SKIPPED");
  const company =
    (await prisma.company.findFirst({ where: { slug: "bidvera-demo" } })) ??
    (await prisma.company.findFirst({ where: { id: "cmtfvf1vm0000rkgkqq291zux" } })) ??
    (await prisma.company.findFirst());
  if (!company) throw new Error("no company available for E2E");

  const tender = await prisma.tender.create({
    data: {
      companyId: company.id,
      title: `Scottish ZIP extraction E2E ${new Date().toISOString()}`,
      status: "DRAFT",
      analysisStatus: "ANALYZING",
      client: "Scottish tender",
      country: "United Kingdom",
    },
  });

  for (const f of discovered.files) {
    const stored = await storageService.putObject({
      companyId: company.id,
      tenderId: tender.id,
      fileName: f.fileName,
      mimeType: f.mimeType,
      body: f.bytes,
    });
    await prisma.tenderDocument.create({
      data: {
        tenderId: tender.id,
        companyId: company.id,
        fileName: f.originalFileName,
        storageKey: stored.storageKey,
        mimeType: stored.detectedMimeType,
        fileSize: stored.byteLength,
        checksumSha256: stored.checksumSha256,
        documentKind: "TENDER",
        processingStatus: "PENDING",
        extractionMeta: {
          packageProvenance: {
            discoveryId: f.discoveryId,
            originalFileName: f.originalFileName,
            source: f.source,
            archiveFileName: f.archiveFileName,
            archivePath: f.archivePath,
            packageDiscoveredFileCount: discovered.discoveredFileCount,
          },
        },
      },
    });
  }

  console.log("Running processTenderAnalysis", tender.id);
  let analysisError: string | null = null;
  try {
    await processTenderAnalysis(tender.id);
  } catch (err) {
    analysisError = err instanceof Error ? err.message : String(err);
    console.warn("analysis_error", analysisError);
  }

  const result = await prisma.tender.findUnique({
    where: { id: tender.id },
    include: { documents: true, requirements: true, risks: true },
  });

  const docsOk = (result?.documents ?? []).filter(
    (d) => d.processingStatus === "COMPLETED" && (d.extractedText ?? "").length > 0,
  );
  const docsFailed = (result?.documents ?? []).filter((d) => d.processingStatus === "FAILED");
  const xlsxDoc = result?.documents.find((d) => /\.xlsx$/i.test(d.fileName));
  const errText = String(result?.analysisError ?? analysisError ?? "");
  const riskCount = result?.risks?.length ?? 0;
  const certRisks = (result?.risks ?? []).filter((r) => /certif/i.test(r.category));
  const certUnderlyingKeys = [
    ...new Set(
      certRisks.map((r) => {
        const m = r.description.match(
          /\b(ISO\s?\d+|Cyber Essentials(?:\sPlus)?|CHAS|SafeContractor)\b/i,
        );
        return m ? m[1]!.toLowerCase().replace(/\s+/g, " ") : r.description.slice(0, 80);
      }),
    ),
  ];

  const report = {
    tenderId: tender.id,
    status: result?.analysisStatus,
    analysisError: result?.analysisError ?? analysisError,
    sniffKind: sniff.kind,
    discoveredFileCount: discovered.discoveredFileCount,
    successfullyExtractedPrecheck: ok,
    failedPrecheck: failed,
    skippedUnsupported: skipped.length,
    noSilentDrops: true,
    docsPersisted: result?.documents.length ?? 0,
    docsExtractedOk: docsOk.length,
    docsExtractionFailed: docsFailed.length,
    xlsxChars: (xlsxDoc?.extractedText ?? "").length,
    xlsxPreview: (xlsxDoc?.extractedText ?? "").slice(0, 160),
    requirementCount: result?.requirements.length ?? 0,
    riskCount,
    certRiskCount: certRisks.length,
    distinctCertIssues: certUnderlyingKeys,
    perFile,
    invariants: {
      sniffIsZip: sniff.kind === "zip",
      discoveredSeven: discovered.discoveredFileCount === 7,
      notStoredAsSingleZipDoc: (result?.documents.length ?? 0) === 7,
      allPrecheckExtracted: ok === 7 && failed === 0,
      xlsxExtracted:
        Boolean(xlsxDoc) &&
        (xlsxDoc!.extractedText?.length ?? 0) > 500 &&
        /Year|GBP|Sheet|Commercial|complete/i.test(xlsxDoc!.extractedText ?? ""),
      noExcelErrorOnZipPackage: !errText.includes(
        "Documents-JUN557200.zip: Could not read text from this Excel spreadsheet",
      ),
      zeroSilentDrops: skipped.length === 0 || skipped.every((s) => Boolean(s.error)),
      noDuplicateRiskInvariantFailure: !/Duplicate risk for same underlying issue/i.test(errText),
      analysisCompleted: result?.analysisStatus === "COMPLETED",
    },
  };

  const outPath = path.join(".data", "artifacts", "scottish-zip-extraction-e2e.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  const failedInv = Object.entries(report.invariants).filter(([, v]) => !v);
  if (failedInv.length) {
    console.error("FAILED", failedInv.map(([k]) => k));
    process.exit(1);
  }
  console.log("SCOTTISH ZIP E2E PASS");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
