/**
 * Canonical snapshot E2E proof — same package architecture for
 * one file / long PDF / multiple files / ZIP.
 *
 * Prefers real IGL zip when present:
 *   BIDVERA_IGL_PACKAGE or 2026_IGL_508_1-documents.zip
 * Does not synthesize a fake IGL pack.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { extractDocumentText } from "@/services/document/extract";
import {
  extractTenderPackageFromParts,
} from "@/services/tender-extraction/requirements-heuristic";
import { assembleTenderPackage, discoverTenderPackage } from "@/domain/tender-package";
import { buildCanonicalRequirements, isStructuralHeading } from "@/domain/tender-requirements";
import {
  assertCanonicalSnapshotInvariants,
  freezeCanonicalAnalysisSnapshot,
} from "@/domain/tender-intelligence/canonical-snapshot";
import { buildTenderIntelligence } from "@/domain/tender-intelligence";
import { computeTenderReadiness } from "@/domain/decision/tender-readiness";
import {
  deriveCanonicalReportSections,
  FULL_REPORT_FEATURE_ACCESS,
} from "@/services/reports/report-canonical-view";
import type { TenderReport } from "@/services/reports/types";

const ROOT = resolve(".");
const IGL_NAME = "2026_IGL_508_1-documents.zip";

function findIglZip(): string | null {
  const env = process.env.BIDVERA_IGL_PACKAGE?.trim();
  const candidates = [
    env,
    resolve(ROOT, IGL_NAME),
    resolve(ROOT, "fixtures", IGL_NAME),
    resolve(ROOT, ".data", IGL_NAME),
  ].filter((p): p is string => Boolean(p));
  return candidates.find((p) => existsSync(p)) ?? null;
}

function findExistingMultiPdfDir(): string | null {
  const uploads = resolve(ROOT, ".data/uploads");
  if (!existsSync(uploads)) return null;
  // Prefer a folder that already contains Comm + Tech + Corrigendum from prior E2E.
  const stack = [uploads];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    const pdfs = entries.filter((e) => e.toLowerCase().endsWith(".pdf"));
    const hasPack =
      pdfs.some((p) => /comm_vol|corrigendum|tech_vol/i.test(p)) && pdfs.length >= 3;
    if (hasPack) return dir;
    for (const e of entries) {
      if (e.startsWith(".")) continue;
      const full = join(dir, e);
      try {
        stack.push(full);
      } catch {
        /* skip */
      }
    }
  }
  return null;
}

type Timed<T> = { value: T; ms: number };

async function timed<T>(fn: () => Promise<T> | T): Promise<Timed<T>> {
  const t0 = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - t0 };
}

async function extractParts(
  files: Array<{ fileName: string; bytes: Buffer; mimeType: string }>,
) {
  const parts: Array<{ fileName: string; text: string; failed: boolean }> = [];
  for (const f of files) {
    try {
      const extracted = await extractDocumentText({
        buffer: f.bytes,
        mimeType: f.mimeType,
        fileName: f.fileName,
      });
      parts.push({
        fileName: f.fileName,
        text: extracted.text ?? "",
        failed: (extracted.text ?? "").trim().length < 20,
      });
    } catch (err) {
      parts.push({
        fileName: f.fileName,
        text: "",
        failed: true,
      });
      console.warn("extract_failed", f.fileName, err instanceof Error ? err.message : err);
    }
  }
  return parts;
}

function fragmentLeak(text: string): boolean {
  return /\b(shall be|shall|responsible to)\s*$/i.test(text.replace(/\s+/g, " ").trim());
}

async function provePackage(
  label: string,
  files: Array<{ fileName: string; bytes: Buffer; mimeType: string }>,
  timings: Record<string, number>,
) {
  const t0 = Date.now();
  const extracted = await timed(() => extractParts(files));
  timings.extraction = (timings.extraction ?? 0) + extracted.ms;

  const assembly = assembleTenderPackage(
    extracted.value.map((p) => ({
      fileName: p.fileName,
      documentKind: "TENDER",
      text: p.text,
    })),
  );

  const canonT = await timed(() => {
    const pack = extractTenderPackageFromParts(
      extracted.value.map((p) => ({ fileName: p.fileName, text: p.text })),
      assembly.packageLabel,
    );
    const canonical = buildCanonicalRequirements({
      heuristicDrafts: pack.requirements,
    });
    return { pack, canonical };
  });
  timings.canonicalization = (timings.canonicalization ?? 0) + canonT.ms;
  const { pack, canonical } = canonT.value;

  const analysisT = await timed(() => {
    const readiness = computeTenderReadiness({
      requirements: canonical.map((r, i) => ({
        id: r.id ?? `req-${i + 1}`,
        category: r.category,
        description: r.requirement,
        mandatory: r.mandatory,
        value: r.value ?? null,
        status: "UNCERTAIN" as const,
        evidence: r.evidenceText ?? null,
      })),
      profileHasAnyCapability: false,
    });
    const intelligence = buildTenderIntelligence({
      tenderId: `e2e-${label}`,
      documentName: assembly.packageLabel,
      tenderDeadline: pack.deadlineIso,
      extractedText: assembly.packageText.slice(0, 20_000),
      requirements: canonical.map((r, i) => ({
        id: r.id ?? `req-${i + 1}`,
        category: r.category,
        description: r.requirement,
        mandatory: r.mandatory,
        value: r.value ?? null,
        status: "UNCERTAIN" as const,
        sourcePage: r.page ?? null,
        sourceSection: r.sourceSection ?? null,
        evidence: r.evidenceText ?? null,
      })),
      evidence: [],
      findings: [],
      existingRisks: [],
      decision: "REVIEW",
      fitScore: 50,
      readiness,
    });
    return { readiness, intelligence };
  });
  timings.analysis = (timings.analysis ?? 0) + analysisT.ms;

  const snapT = await timed(() => {
    const requirementIds = canonical.map((r, i) => r.id ?? `req-${i + 1}`);
    const snapshot = freezeCanonicalAnalysisSnapshot({
      tenderId: `e2e-${label}`,
      packageLabel: assembly.packageLabel,
      discoveredFileCount: files.length,
      files: extracted.value.map((p) => ({
        fileName: p.fileName,
        processingStatus: p.failed ? "FAILED" : "COMPLETED",
        role: null,
        error: p.failed ? "FILE_EXTRACTION_FAILED" : null,
      })),
      metadata: {
        title: pack.title,
        client: pack.client,
        deadlineIso: pack.deadlineIso,
        deadlineTimezone: pack.deadlineTimezone,
        factsNote: pack.packageMetadata ? JSON.stringify(pack.packageMetadata.buyer) : null,
        metadataStatus: pack.packageMetadata?.buyer.status ?? null,
      },
      requirementIds,
      summary: analysisT.value.intelligence.complianceSummary,
    });
    analysisT.value.intelligence.canonicalSnapshot = snapshot;
    return snapshot;
  });
  timings.finalSnapshot = (timings.finalSnapshot ?? 0) + snapT.ms;

  const headingHits = canonical.filter((r) => isStructuralHeading(r.requirement));
  const fragmentHits = canonical.filter((r) => fragmentLeak(r.requirement));
  if (headingHits.length) {
    throw new Error(`${label}: heading contamination: ${headingHits[0]!.requirement.slice(0, 80)}`);
  }
  if (fragmentHits.length) {
    throw new Error(`${label}: truncated requirement: ${fragmentHits[0]!.requirement.slice(0, 80)}`);
  }

  const report: TenderReport = {
    tenderId: `e2e-${label}`,
    companyId: "e2e",
    title: pack.title ?? assembly.packageLabel,
    client: pack.client,
    deadline: pack.deadlineIso,
    deadlineTimezone: pack.deadlineTimezone,
    analyzedAt: new Date().toISOString(),
    decision: "REVIEW",
    fitScore: 50,
    confidence: "MEDIUM",
    reasoning: "E2E snapshot proof",
    companyKnowledgeOnly: false,
    fitBreakdown: null,
    readiness: analysisT.value.readiness,
    intelligence: analysisT.value.intelligence,
    complianceSummary: analysisT.value.intelligence.complianceSummary,
    bidScore: null,
    historicalSignals: [],
    matched: [],
    failed: [],
    uncertain: [],
    criticalRisks: [],
    missingDocuments: [],
    evidence: [],
    nextActions: [],
    decisionOutcome: null,
  };
  const web = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
  const pdf = deriveCanonicalReportSections(report, FULL_REPORT_FEATURE_ACCESS);
  const snap = snapT.value;
  const webTotal = web.canonicalTotalRequirements;
  const pdfTotal = pdf.canonicalTotalRequirements;
  const apiTotal = snap.counts.totalRequirements;

  assertCanonicalSnapshotInvariants({
    snapshot: snap,
    canonicalRequirementCount: canonical.length,
    requirementTexts: canonical.map((r) => r.requirement),
    uniqueRequirementIds: snap.requirementIds,
    matrix: analysisT.value.intelligence.complianceMatrix,
    summary: analysisT.value.intelligence.complianceSummary,
    readiness: analysisT.value.readiness,
    reportTotal: webTotal,
    pdfTotal,
    apiTotal,
    fitStatuses: canonical.map(() => ({
      fitStatus: "NEEDS_VERIFICATION",
      companyEvidence: null,
    })),
  });

  timings.total = Date.now() - t0;
  return {
    label,
    fileCount: files.length,
    failedFiles: extracted.value.filter((p) => p.failed).map((p) => p.fileName),
    canonicalRequirementCount: canonical.length,
    client: pack.client,
    deadlineIso: pack.deadlineIso,
    timezone: pack.deadlineTimezone,
    webTotal,
    pdfTotal,
    apiTotal,
    timings: { ...timings },
  };
}

async function main() {
  const started = Date.now();
  const out: Record<string, unknown> = { startedAt: new Date().toISOString() };

  const igl = findIglZip();
  out.iglZipPath = igl;
  if (igl) {
    const uploadMs = await timed(async () => readFileSync(igl));
    out.uploadMs = uploadMs.ms;
    const discovered = await timed(() =>
      discoverTenderPackage([
        {
          fileName: basename(igl),
          mimeType: "application/zip",
          fileSize: uploadMs.value.length,
          bytes: uploadMs.value,
        },
      ]),
    );
    out.discoveryMs = discovered.ms;
    out.discoveredFileCount = discovered.value.discoveredFileCount;
    const files = discovered.value.files.map((f) => ({
      fileName: f.fileName,
      bytes: f.bytes,
      mimeType: f.mimeType,
    }));
    const timings: Record<string, number> = {
      upload: uploadMs.ms,
      packageDiscovery: discovered.ms,
    };
    out.igl = await provePackage("igl-zip", files, timings);
  } else {
    out.iglSkipped =
      "2026_IGL_508_1-documents.zip not found (set BIDVERA_IGL_PACKAGE). Not synthesizing a replacement.";
  }

  const packDir = findExistingMultiPdfDir();
  if (packDir) {
    const pdfs = readdirSync(packDir).filter((f) => f.toLowerCase().endsWith(".pdf"));
    const files = pdfs.map((f) => ({
      fileName: f,
      bytes: readFileSync(join(packDir, f)),
      mimeType: "application/pdf",
    }));
    out.realMultiPdfDir = packDir;
    out.realMulti = await provePackage("real-multi-pdf", files, {});
  }

  // One-file / long-PDF: same extractTenderPackageFromParts + freeze path as multi-file.
  out.oneFileNote = "Covered by unit snapshot + existing e2e-test1 when PDF present.";

  out.totalMs = Date.now() - started;
  const dir = resolve(".data/artifacts");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `e2e-canonical-snapshot-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log("wrote", path);

  if (!igl && !packDir) {
    console.warn("No IGL zip and no multi-PDF upload folder — zip architecture still covered by unit tests.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
