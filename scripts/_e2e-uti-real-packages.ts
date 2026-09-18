/**
 * Real-package UTI report — EIB / IGL / Scottish when fixtures exist.
 * Extends existing E2E scripts; does not invent packages.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { storageService } from "../src/services/storage";
import { processTenderAnalysis } from "../src/services/tender-processing/index";
import { discoverTenderPackage } from "../src/domain/tender-package/discover-tender-package";

type PackageSpec = {
  id: string;
  candidates: string[];
};

const PACKAGES: PackageSpec[] = [
  {
    id: "scottish",
    candidates: [
      path.join(
        ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtn06jtv0rk1rkpoa5diox8h/1788529325821-Documents-JUN557200.zip",
      ),
      path.join(process.env.USERPROFILE ?? "", "Downloads", "Documents-JUN557200.zip"),
    ],
  },
  {
    id: "igl",
    candidates: [
      process.env.BIDVERA_IGL_PACKAGE ?? "",
      "2026_IGL_508_1-documents.zip",
      path.join("fixtures", "2026_IGL_508_1-documents.zip"),
      path.join(".data", "2026_IGL_508_1-documents.zip"),
    ].filter(Boolean),
  },
  {
    id: "eib",
    candidates: [
      process.env.BIDVERA_EIB_PACKAGE ?? "",
      // Prefer cloning from a known stored tender via env; directory fixtures optional
      path.join(
        ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtm3gnbd0gyerkpojaub3hov",
      ),
      path.join(
        ".data/uploads/cmtfvf1vm0000rkgkqq291zux/cmtmv1v8z0ijrrkpog97gt7lk",
      ),
      path.join("fixtures", "eib"),
      path.join(".data", "eib-package"),
    ].filter(Boolean),
  },
];

const EIB_SOURCE_TENDER_ID = process.env.BIDVERA_EIB_SOURCE_TENDER ?? "cmtm3gnbd0gyerkpojaub3hov";

async function runEibFromStoredTender() {
  const source = await prisma.tender.findUnique({
    where: { id: EIB_SOURCE_TENDER_ID },
    include: { documents: true },
  });
  if (!source || source.documents.length === 0) {
    return { id: "eib", skipped: true, reason: "source tender documents not found" };
  }
  // Materialize docs into a temp folder for discoverTenderPackage
  const tmp = path.join(".data", "artifacts", "uti-eib-tmp");
  fs.mkdirSync(tmp, { recursive: true });
  for (const d of source.documents) {
    try {
      const obj = await storageService.getObject(d.storageKey);
      fs.writeFileSync(path.join(tmp, d.fileName), obj);
    } catch {
      // skip missing blob
    }
  }
  const files = fs.readdirSync(tmp);
  if (files.length === 0) {
    return { id: "eib", skipped: true, reason: "could not materialize EIB documents" };
  }
  return runOne("eib", tmp);
}

function findPackage(spec: PackageSpec): string | null {
  for (const c of spec.candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

async function runOne(id: string, filePath: string) {
  const started = Date.now();
  const company =
    (await prisma.company.findFirst({ where: { slug: "bidvera-demo" } })) ??
    (await prisma.company.findFirst());
  if (!company) throw new Error("no company");

  const stat = fs.statSync(filePath);
  let uploads: Array<{ fileName: string; mimeType: string; fileSize: number; bytes: Buffer }>;
  if (stat.isDirectory()) {
    const files = fs.readdirSync(filePath).filter((f) => !f.startsWith("."));
    uploads = files.map((f) => {
      const full = path.join(filePath, f);
      const bytes = fs.readFileSync(full);
      return {
        fileName: f,
        mimeType: "application/octet-stream",
        fileSize: bytes.byteLength,
        bytes,
      };
    });
  } else {
    const bytes = fs.readFileSync(filePath);
    uploads = [
      {
        fileName: path.basename(filePath),
        mimeType: filePath.toLowerCase().endsWith(".zip")
          ? "application/zip"
          : "application/octet-stream",
        fileSize: bytes.byteLength,
        bytes,
      },
    ];
  }

  const discovered = await discoverTenderPackage(uploads);
  const tender = await prisma.tender.create({
    data: {
      companyId: company.id,
      title: `UTI E2E ${id} ${new Date().toISOString()}`,
      status: "DRAFT",
      analysisStatus: "ANALYZING",
      client: id,
      country: "Unknown",
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

  let analysisError: string | null = null;
  try {
    await processTenderAnalysis(tender.id);
  } catch (err) {
    analysisError = err instanceof Error ? err.message : String(err);
  }

  const result = await prisma.tender.findUnique({
    where: { id: tender.id },
    include: {
      documents: true,
      requirements: true,
      risks: true,
      decision: true,
    },
  });

  const docsOk = (result?.documents ?? []).filter(
    (d) => d.processingStatus === "COMPLETED" && (d.extractedText ?? "").length > 0,
  );
  const docsFailed = (result?.documents ?? []).filter((d) => d.processingStatus === "FAILED");
  let uti: unknown = null;
  let guardian: unknown = null;
  let decisionLabel: string | null = result?.decision?.decision ?? null;

  const decisionRow = await prisma.tenderDecision.findUnique({ where: { tenderId: tender.id } });
  const intelJson = (decisionRow?.intelligenceBreakdown ?? null) as Record<string, unknown> | null;
  uti = intelJson?.universalTenderIntelligence ?? null;
  guardian = intelJson?.decisionGuardian ?? null;
  const analysisIntegrity = intelJson?.analysisIntegrity ?? null;
  const tenderCertification = intelJson?.tenderCertification ?? null;
  const snapshot = intelJson?.canonicalSnapshot ?? null;
  decisionLabel = decisionRow?.decision ?? decisionLabel;

  const counts =
    analysisIntegrity && typeof analysisIntegrity === "object"
      ? (analysisIntegrity as { counts?: Record<string, number>; partitionValid?: boolean })
          .counts
      : snapshot && typeof snapshot === "object"
        ? (snapshot as { counts?: Record<string, number> }).counts
        : null;
  const partitionOk =
    counts &&
    typeof counts.totalRequirements === "number" &&
    (counts.verifiedRequirements ?? counts.verified ?? 0) +
      (counts.needsVerification ?? 0) +
      (counts.confirmedGaps ?? 0) +
      (counts.notApplicable ?? 0) ===
      counts.totalRequirements;

  return {
    id,
    filePath,
    durationMs: Date.now() - started,
    tenderId: tender.id,
    status: result?.analysisStatus,
    analysisError: result?.analysisError ?? analysisError,
    discoveredFileCount: discovered.discoveredFileCount,
    docsPersisted: result?.documents.length ?? 0,
    docsExtractedOk: docsOk.length,
    docsExtractionFailed: docsFailed.length,
    unsupportedInventory: discovered.inventory.filter((i) => i.status === "UNSUPPORTED_SKIPPED")
      .length,
    canonicalRequirementCount: result?.requirements.length ?? 0,
    canonicalRiskCount: result?.risks.length ?? 0,
    decision: decisionLabel,
    uti,
    analysisIntegrity,
    tenderCertification,
    snapshotCounts: counts,
    partitionOk: Boolean(partitionOk),
    integrityOk:
      analysisIntegrity &&
      typeof analysisIntegrity === "object" &&
      (analysisIntegrity as { partitionValid?: boolean }).partitionValid === true,
    certificationOk:
      tenderCertification &&
      typeof tenderCertification === "object" &&
      ["CERTIFIED", "CERTIFIED_WITH_WARNINGS", "REVIEW_REQUIRED"].includes(
        String((tenderCertification as { status?: string }).status ?? ""),
      ),
    certificationStatus:
      tenderCertification && typeof tenderCertification === "object"
        ? (tenderCertification as { status?: string }).status ?? null
        : null,
    guardianOk:
      guardian && typeof guardian === "object" && (guardian as { ok?: boolean }).ok === true,
    noDuplicateRiskFailure: !String(result?.analysisError ?? analysisError ?? "").includes(
      "Duplicate risk",
    ),
  };
}

async function main() {
  const reports: unknown[] = [];
  for (const spec of PACKAGES) {
    if (spec.id === "eib") {
      const found = findPackage(spec);
      console.log("Running UTI E2E", spec.id, found ?? "(stored tender clone)");
      const report = found ? await runOne(spec.id, found) : await runEibFromStoredTender();
      reports.push(report);
      console.log(JSON.stringify(report, null, 2));
      continue;
    }
    const found = findPackage(spec);
    if (!found) {
      reports.push({ id: spec.id, skipped: true, reason: "fixture not found" });
      continue;
    }
    console.log("Running UTI E2E", spec.id, found);
    const report = await runOne(spec.id, found);
    reports.push(report);
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== "COMPLETED" && !report.analysisError?.includes("incomplete")) {
      console.warn("Package did not COMPLETE:", spec.id, report.analysisError);
    }
  }

  const outPath = path.join(".data", "artifacts", "uti-real-packages-e2e.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(reports, null, 2));
  console.log("Wrote", outPath);

  const hardFails = (reports as Array<Record<string, unknown>>).filter(
    (r) =>
      !r.skipped &&
      (r.noDuplicateRiskFailure === false ||
        r.integrityOk === false ||
        r.partitionOk === false ||
        r.certificationOk === false ||
        String(r.analysisError ?? "").includes("Duplicate risk") ||
        String(r.analysisError ?? "").includes("analysis-integrity") ||
        String(r.analysisError ?? "").includes("tender-certification")),
  );
  if (hardFails.length) {
    console.error("HARD FAIL", hardFails);
    process.exit(1);
  }
  console.log("UTI REAL PACKAGE E2E DONE");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
